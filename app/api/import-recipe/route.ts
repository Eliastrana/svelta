import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------- Types (no any) --------

type Imported = {
    title?: string;
    description?: string;
    ingredientsDetailed?: Array<{ name: string; amount?: string }>;
    cookingSteps?: Array<{ title: string; description: string }>;
    temperature?: string;
    cookingTime?: string;
    portions?: string;
    coverImageUrl?: string;
};

// JSON-safe types
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

// -------- Guards & helpers --------

const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const isJsonObject = (v: unknown): v is JsonObject =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const isJsonValue = (v: unknown): v is JsonValue => {
    if (v === null) return true;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return true;
    if (Array.isArray(v)) return v.every(isJsonValue);
    if (isObject(v)) return Object.values(v).every(isJsonValue);
    return false;
};

const getString = (obj: JsonObject, key: string): string | undefined => {
    const v = obj[key];
    return typeof v === 'string' ? v : undefined;
};

const getArray = (obj: JsonObject, key: string): JsonArray | undefined => {
    const v = obj[key];
    return Array.isArray(v) ? (v as JsonArray) : undefined;
};

const toStringArray = (v: JsonValue | undefined): string[] => {
    if (typeof v === 'string') return [v];
    if (Array.isArray(v))
        return v.filter((x): x is string => typeof x === 'string');
    return [];
};

function isSafeHttpUrl(raw: string): string | null {
    try {
        const u = new URL(raw);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

        const host = u.hostname.toLowerCase();
        if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '0.0.0.0' ||
            host.endsWith('.local')
        )
            return null;

        return u.toString();
    } catch {
        return null;
    }
}

function pickRecipeFromJsonLd(json: JsonValue): JsonObject | null {
    const nodes: JsonObject[] = [];

    const pushNode = (x: JsonValue) => {
        if (Array.isArray(x)) {
            x.forEach(pushNode);
            return;
        }
        if (isJsonObject(x)) {
            nodes.push(x);
            return;
        }
    };

    pushNode(json);

    // @graph er vanlig
    const graphNodes: JsonObject[] = [];
    for (const n of nodes) {
        const graph = getArray(n, '@graph');
        if (!graph) continue;
        for (const g of graph) {
            if (isJsonObject(g)) graphNodes.push(g);
        }
    }

    const all = [...nodes, ...graphNodes];

    const isRecipe = (obj: JsonObject): boolean => {
        const t = obj['@type'];
        if (!t) return false;
        if (typeof t === 'string') return t === 'Recipe';
        if (Array.isArray(t)) return t.some((x) => x === 'Recipe');
        return false;
    };

    return all.find(isRecipe) ?? null;
}

function normalizeImage(img: JsonValue | undefined): string | undefined {
    if (!img) return undefined;
    if (typeof img === 'string') return img;

    if (Array.isArray(img)) {
        const first = img[0];
        return typeof first === 'string' ? first : undefined;
    }

    if (isJsonObject(img)) {
        const url = getString(img, 'url');
        if (url) return url;
        const id = getString(img, '@id');
        if (id) return id;
    }

    return undefined;
}

function normalizeInstructions(inst: JsonValue | undefined): string[] {
    if (!inst) return [];
    if (typeof inst === 'string') return [inst];

    if (Array.isArray(inst)) {
        const out: string[] = [];
        for (const x of inst) {
            if (typeof x === 'string') {
                out.push(x);
                continue;
            }
            if (isJsonObject(x)) {
                const text = getString(x, 'text');
                if (text) out.push(text);

                const hasItemList = typeof x['itemListElement'] !== 'undefined';
                const name = getString(x, 'name');
                if (!text && name && !hasItemList) out.push(name);

                const itemList = x['itemListElement'];
                if (Array.isArray(itemList)) {
                    out.push(...normalizeInstructions(itemList));
                }
            }
        }
        return out.filter(Boolean);
    }

    if (isJsonObject(inst)) {
        const text = getString(inst, 'text');
        if (text) return [text];

        const itemList = inst['itemListElement'];
        if (Array.isArray(itemList)) return normalizeInstructions(itemList);
    }

    return [];
}

function trySplitIngredient(line: string): { amount?: string; name: string } {
    const s = line.replace(/\s+/g, ' ').trim();
    if (!s) return { name: '' };

    const m = s.match(
        /^(\d+(?:[.,]\d+)?(?:\/\d+)?\s*(?:[a-zA-ZæøåÆØÅ]+\.?)?(?:\s*\([^)]+\))?)\s+(.+)$/
    );
    if (!m) return { name: s };

    const amount = m[1].trim();
    const name = m[2].trim();
    if (amount.length <= 0 || name.length <= 0) return { name: s };

    return { amount, name };
}

async function fetchHtml(url: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);

    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (RecipeImporter/1.0)',
                Accept: 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
        });

        if (!res.ok) throw new Error(`Fetch feilet (${res.status})`);

        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html'))
            throw new Error('URL må peke til en HTML-side.');

        return await res.text();
    } finally {
        clearTimeout(t);
    }
}

function extractJsonLd(html: string): JsonValue[] {
    const $ = cheerio.load(html);
    const scripts = $('script[type="application/ld+json"]');
    const out: JsonValue[] = [];

    scripts.each((_, el) => {
        const raw = $(el).text();
        if (!raw) return;

        try {
            const parsed: unknown = JSON.parse(raw);
            if (isJsonValue(parsed)) out.push(parsed);
        } catch {
            // ignorer
        }
    });

    return out;
}

function htmlToPlainText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();

    const title = $('title').first().text().trim();
    const h1 = $('h1').first().text().trim();

    const main =
        $('main').text().trim() ||
        $('article').text().trim() ||
        $(
            '[itemprop="recipeInstructions"], [class*="instruction"], [class*="directions"]'
        )
            .text()
            .trim() ||
        $('body').text().trim();

    const text = [h1 || '', title || '', main || '']
        .filter(Boolean)
        .join('\n\n');
    return text.replace(/\s+\n/g, '\n').slice(0, 12000);
}

function coerceImportedFromUnknown(u: unknown): Imported {
    if (!isObject(u)) return {};

    const title = typeof u.title === 'string' ? u.title : '';
    const description = typeof u.description === 'string' ? u.description : '';
    const temperature = typeof u.temperature === 'string' ? u.temperature : '';
    const cookingTime = typeof u.cookingTime === 'string' ? u.cookingTime : '';
    const portions = typeof u.portions === 'string' ? u.portions : '';
    const coverImageUrl =
        typeof u.coverImageUrl === 'string' ? u.coverImageUrl : '';

    type IngredientDetailed = { name: string; amount?: string };

    const ingredientsDetailed: IngredientDetailed[] = Array.isArray(
        u.ingredientsDetailed
    )
        ? u.ingredientsDetailed.flatMap((item): IngredientDetailed[] => {
              if (!isObject(item)) return [];

              const name =
                  typeof item.name === 'string' ? item.name.trim() : '';
              const amount =
                  typeof item.amount === 'string' ? item.amount.trim() : '';

              if (!name) return [];

              return [amount ? { name, amount } : { name }];
          })
        : [];

    const cookingSteps: Imported['cookingSteps'] = Array.isArray(u.cookingSteps)
        ? u.cookingSteps
              .map((item) => {
                  if (!isObject(item)) return null;
                  const t =
                      typeof item.title === 'string' ? item.title.trim() : '';
                  const d =
                      typeof item.description === 'string'
                          ? item.description.trim()
                          : '';
                  if (!d) return null;
                  return { title: t || 'Steg', description: d };
              })
              .filter(
                  (x): x is { title: string; description: string } => x !== null
              )
        : [];

    return {
        title,
        description,
        ingredientsDetailed,
        cookingSteps,
        temperature,
        cookingTime,
        portions,
        coverImageUrl,
    };
}

async function llmParseRecipe(text: string): Promise<Imported> {
    const chat = await openai.chat.completions.create({
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: `
Du er en norsk oppskrifts-assistent.
Ekstraher en oppskrift fra teksten.

Svar KUN med gyldig JSON (ingen markdown) i dette formatet:
{
  "title": string,
  "description": string,
  "ingredientsDetailed": [{"amount": string, "name": string}],
  "cookingSteps": [{"title": string, "description": string}],
  "temperature": string,
  "cookingTime": string,
  "portions": string,
  "coverImageUrl": string
}

Regler:
- Hvis du ikke finner et felt: bruk "" (tom streng) eller [].
- ingredientsDetailed: amount kan være "" hvis usikkert.
- cookingSteps: title kan være "Steg 1", "Steg 2"...
`.trim(),
            },
            { role: 'user', content: text },
        ],
    });

    const raw = chat.choices[0]?.message?.content?.trim() ?? '';

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            parsed = JSON.parse(raw.slice(start, end + 1));
        } else {
            throw new Error('Kunne ikke parse JSON fra modellen.');
        }
    }

    return coerceImportedFromUnknown(parsed);
}

export async function POST(req: Request) {
    try {
        const bodyUnknown: unknown = await req.json();
        const url =
            isObject(bodyUnknown) && typeof bodyUnknown.url === 'string'
                ? bodyUnknown.url
                : '';
        const safeUrl = isSafeHttpUrl(url.trim());

        if (!safeUrl) {
            return NextResponse.json(
                { error: 'Ugyldig eller usikker URL.' },
                { status: 400 }
            );
        }

        const html = await fetchHtml(safeUrl);

        // 1) JSON-LD (best)
        const jsonLds = extractJsonLd(html);

        for (const json of jsonLds) {
            const recipe = pickRecipeFromJsonLd(json);
            if (!recipe) continue;

            const name = getString(recipe, 'name') ?? '';
            const description = getString(recipe, 'description') ?? '';

            const recipeIngredient = recipe['recipeIngredient'];
            const ing = toStringArray(recipeIngredient);

            const ingredientsDetailed = ing
                .map((line) => {
                    const { amount, name } = trySplitIngredient(line);
                    return { amount: amount ?? '', name };
                })
                .filter((x) => x.name.length > 0);

            const inst = normalizeInstructions(recipe['recipeInstructions']);
            const cookingSteps = inst
                .map((text, idx) => ({
                    title: `Steg ${idx + 1}`,
                    description: text.trim(),
                }))
                .filter((s) => s.description.length > 0);

            const yieldVal = recipe['recipeYield'];
            const yieldStrings = toStringArray(yieldVal);
            const portions =
                yieldStrings[0] ??
                (typeof yieldVal === 'number' ? String(yieldVal) : '');

            const coverImageUrl = normalizeImage(recipe['image']) ?? '';

            const cookingTime =
                getString(recipe, 'totalTime') ??
                getString(recipe, 'cookTime') ??
                '';

            const out: Imported = {
                title: name,
                description,
                ingredientsDetailed,
                cookingSteps,
                portions,
                cookingTime,
                temperature: '',
                coverImageUrl,
            };

            return NextResponse.json(out);
        }

        // 2) Fallback: LLM parse fra tekst
        const text = htmlToPlainText(html);
        const llm = await llmParseRecipe(text);

        return NextResponse.json(llm);
    } catch (e) {
        console.error('import-recipe error', e);
        return NextResponse.json(
            { error: 'Feil ved import av oppskrift.' },
            { status: 500 }
        );
    }
}
