// app/api/generate-tags/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ReqBody = {
    title: string;
    description: string;
    ingredientsDetailed: Array<{ name: string; amount?: string }>;
    cookingSteps: Array<{ title: string; description: string }>;
};

function sanitizeTags(input: string[]): string[] {
    const cleaned = input
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((t) => t.replace(/^#/, '')) // remove leading #
        .map((t) => t.replace(/\s+/g, ' ')) // normalize spaces
        .map((t) => t.slice(0, 32)); // keep short

    // unique (case-insensitive), keep original casing after trim
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const t of cleaned) {
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(t);
    }
    return unique;
}

export async function POST(request: Request) {
    const body = (await request.json()) as Partial<ReqBody>;

    const title = (body.title ?? '').trim();
    const description = (body.description ?? '').trim();
    const ingredientsDetailed = Array.isArray(body.ingredientsDetailed) ? body.ingredientsDetailed : [];
    const cookingSteps = Array.isArray(body.cookingSteps) ? body.cookingSteps : [];

    if (!title && !description) {
        return NextResponse.json(
            { error: 'title eller description må være med' },
            { status: 400 },
        );
    }

    const ingredientsText =
        ingredientsDetailed.length > 0
            ? ingredientsDetailed
                .map((i) => {
                    const amount = (i.amount ?? '').trim();
                    const name = (i.name ?? '').trim();
                    return `${amount} ${name}`.trim();
                })
                .filter(Boolean)
                .join(', ')
            : '';

    const stepsText =
        cookingSteps.length > 0
            ? cookingSteps
                .map((s, idx) => `${idx + 1}. ${(s.title ?? '').trim()} – ${(s.description ?? '').trim()}`.trim())
                .filter(Boolean)
                .join('\n')
            : '';

    const prompt = `
Tittel: ${title || '(tom)'}
Beskrivelse: ${description || '(tom)'}
Ingredienser: ${ingredientsText || '(tom)'}
Steg:
${stepsText || '(tom)'}
  `.trim();

    try {
        const chat = await openai.chat.completions.create({
            model: 'gpt-4.1-mini-2025-04-14',
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: `
Du er en norsk oppskriftsassistent.
Lag 5–10 relevante tags for oppskriften.

KRAV:
- Svar KUN med gyldig JSON: en array av strings. Eksempel: ["pasta","middag","italiensk"]
- Ingen ekstra tekst, ingen markdown, ingen forklaringer.
- Tags skal være korte (1–3 ord), uten emoji, uten #.
- Bruk norsk når mulig.
          `.trim(),
                },
                { role: 'user', content: prompt },
            ],
        });

        const raw = chat.choices[0]?.message?.content?.trim() ?? '';

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // fallback: prøv å plukke ut en JSON-array hvis modellen la til noe rart
            const start = raw.indexOf('[');
            const end = raw.lastIndexOf(']');
            if (start >= 0 && end > start) {
                parsed = JSON.parse(raw.slice(start, end + 1));
            } else {
                return NextResponse.json({ error: 'Kunne ikke parse tags fra modellen.' }, { status: 500 });
            }
        }

        if (!Array.isArray(parsed)) {
            return NextResponse.json({ error: 'Ugyldig format fra modellen.' }, { status: 500 });
        }

        const tags = sanitizeTags(parsed.filter((x) => typeof x === 'string') as string[]);

        // sørg for 5–10 hvis mulig
        const finalTags = tags.slice(0, 10);

        return NextResponse.json({ tags: finalTags });
    } catch (err) {
        console.error('generate-tags error', err);
        return NextResponse.json({ error: 'Feil ved generering av tags.' }, { status: 500 });
    }
}