import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Ingredient = { name: string; amount?: string };
type Step = { title: string; description: string };

type ReqBody = {
    ingredientsDetailed: Ingredient[];
    cookingSteps: Step[];
};

type Mention = {
    ingredientName: string;
    matchText: string;
    amount: string;
};

type RawMention = {
    ingredient?: unknown;
    ingredientName?: unknown;
    matchText?: unknown;
};

const clean = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

/** Lower case, so "Løk" and "løk" are the same name. Letters stay as written. */
const fold = (value: string) => value.toLocaleLowerCase('nb');

/**
 * Words in an ingredient's name that say nothing about *which* ingredient it
 * is, so a step saying "hakket" or "ferske" is not taken to mean it.
 */
const FILLER = new Set([
    'fersk', 'ferske', 'frisk', 'friske', 'hakket', 'finhakket', 'revet',
    'skivet', 'stor', 'store', 'liten', 'lite', 'sma', 'hel', 'hele', 'god',
    'gode', 'noen', 'litt', 'ekstra', 'frossen', 'frosne', 'tørket', 'torket',
    'med', 'uten', 'eller', 'til', 'fra', 'etter', 'smak', 'smaken',
]);

/**
 * What a recipe writer is likely to type for an ingredient in running text:
 * each meaningful word of its name, cut back past a Norwegian ending, so that
 * "Avokado" is found in "avokadoen" and "Tomater" in "tomatene".
 */
function stemsOf(name: string): string[] {
    const stems = new Set<string>();

    for (const word of fold(name).split(/[^a-z0-9æøå]+/i)) {
        if (word.length < 4 || FILLER.has(word)) continue;

        let stem = word;

        for (const ending of ['ene', 'ane', 'er', 'en', 'et', 'ar', 'e']) {
            if (stem.endsWith(ending) && stem.length - ending.length >= 4) {
                stem = stem.slice(0, -ending.length);
                break;
            }
        }

        stems.add(stem);
    }

    return [...stems];
}

/**
 * Finds `needle` in `text` without caring about case, and gives back the text
 * as it is actually written there, which is what the app looks for.
 */
function asWritten(text: string, needle: string): string {
    const wanted = needle.trim();

    if (!wanted) return '';

    const at = text.toLocaleLowerCase('nb').indexOf(wanted.toLocaleLowerCase('nb'));

    return at >= 0 ? text.slice(at, at + wanted.length) : '';
}

/**
 * Safety net under the model: an ingredient whose own name (or a word of it,
 * with its ending cut) turns up as a word in the step is linked even if the
 * model let it slip.
 */
function foundByName(description: string, ingredient: Ingredient): string {
    for (const stem of stemsOf(ingredient.name)) {
        // A word that starts with the stem: "avokado" in "avokadoen",
        // "tomat" in "tomatene". Letters are matched as letters, not as the
        // ASCII range, so æ, ø and å count as part of a word.
        const word = new RegExp(`(?<![\\p{L}])${stem}[\\p{L}]*`, 'iu').exec(
            description,
        );

        if (word) return word[0];
    }

    return '';
}

const SYSTEM_PROMPT = `
Du kobler ingredienser til stegene i en norsk oppskrift. For hvert steg skal du finne ALLE ingredienser fra listen som steget bruker, slik de er nevnt i stegets beskrivelse.

Regn med at ingredienser sjelden står skrevet nøyaktig som i listen:
- Bøyde former og flertall teller: "avokadoen" og "tomatene" peker på Avokado og Tomater.
- Bestemt form og kortformer teller: "kyllingen" peker på Kylling, "osten" på en ostevariant i listen, "løken" på Rødløk eller Gul løk.
- Sammensatte ord teller: "tacokrydderet" peker på Tacokrydder.
- Samlebegreper kobles til alle ingredienser de tydelig dekker: "grønnsakene" kan peke på flere grønnsaker, "kryddere" på krydder-ingrediensene.
- Når en ingrediens er nevnt flere ganger i samme steg, bruk første omtale.
- Ta med en ingrediens når det er rimelig sikkert at ordet peker på den. Ta IKKE med ingredienser som steget ikke bruker, og ikke ord som bare ligner.

Hver ingrediens har et nummer (id). Svar med id-en, ikke navnet.

matchText er ordet eller den korte frasen i beskrivelsen som peker på ingrediensen, kopiert tegn for tegn med samme store og små bokstaver som i beskrivelsen. Ta bare med selve ingrediensordet, ikke hele setningen.

SVAR KUN med et JSON-objekt på denne formen, med ett element per steg i samme rekkefølge som stegene:
{"steps":[{"stepIndex":0,"mentions":[{"ingredient":3,"matchText":"avokadoen"}]},{"stepIndex":1,"mentions":[]}]}
`.trim();

export async function POST(request: Request) {
    const body = (await request.json()) as Partial<ReqBody>;

    const ingredients = (
        Array.isArray(body.ingredientsDetailed) ? body.ingredientsDetailed : []
    )
        .map((ingredient) => ({
            name: clean(ingredient?.name),
            amount: clean(ingredient?.amount),
        }))
        .filter((ingredient) => ingredient.name);

    const steps: Step[] = (
        Array.isArray(body.cookingSteps) ? body.cookingSteps : []
    ).map((step) => ({
        title: clean(step?.title),
        description: clean(step?.description),
    }));

    const empty = () => steps.map(() => []);

    if (!ingredients.length || !steps.length) {
        return NextResponse.json({ mentionsByStep: empty() }, { status: 200 });
    }

    const prompt = JSON.stringify(
        {
            ingredients: ingredients.map((ingredient, id) => ({
                id,
                name: ingredient.name,
            })),
            steps: steps.map((step, stepIndex) => ({
                stepIndex,
                title: step.title,
                description: step.description,
            })),
        },
        null,
        2,
    );

    // What the model said, per step. A failure is not fatal: the name search
    // below still links what it can.
    let said: RawMention[][] = steps.map(() => []);

    try {
        const chat = await openai.chat.completions.create({
            model: 'gpt-4.1-mini-2025-04-14',
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
        });

        const parsed = JSON.parse(chat.choices[0]?.message?.content ?? '{}') as {
            steps?: Array<{ stepIndex?: unknown; mentions?: unknown }>;
        };

        if (Array.isArray(parsed.steps)) {
            said = steps.map((_, index) => {
                // By the index it names, falling back to its position.
                const entry =
                    parsed.steps?.find((item) => item?.stepIndex === index) ??
                    parsed.steps?.[index];

                return Array.isArray(entry?.mentions)
                    ? (entry.mentions as RawMention[])
                    : [];
            });
        }
    } catch (error) {
        console.error('annotate-step-ingredients error', error);
    }

    const byName = new Map(
        ingredients.map((ingredient, id) => [fold(ingredient.name), id]),
    );

    const mentionsByStep: Mention[][] = steps.map((step, index) => {
        const found = new Map<number, Mention>();

        const add = (id: number, written: string) => {
            if (found.has(id) || !written) return;

            found.set(id, {
                ingredientName: ingredients[id].name,
                matchText: written,
                amount: ingredients[id].amount,
            });
        };

        for (const mention of said[index] ?? []) {
            const named = clean(mention.ingredientName);
            const id =
                typeof mention.ingredient === 'number' &&
                Number.isInteger(mention.ingredient) &&
                ingredients[mention.ingredient]
                    ? mention.ingredient
                    : named
                      ? byName.get(fold(named))
                      : undefined;

            if (id === undefined) continue;

            // Snapped to the text as written, so a model that changed the
            // case still counts; one that made the words up does not.
            const written = asWritten(step.description, clean(mention.matchText));

            // "Smelt smøret" is trimmed to "smøret": the amount is shown right
            // after the match, so it should sit after the ingredient itself,
            // not after the verb in front of it. Only for one-word names, where
            // the word is certain to be the whole ingredient.
            const single = !/\s/.test(ingredients[id].name);
            const narrowed =
                single && /\s/.test(written)
                    ? foundByName(written, ingredients[id])
                    : '';

            add(id, narrowed || written);
        }

        ingredients.forEach((ingredient, id) => {
            if (!found.has(id)) add(id, foundByName(step.description, ingredient));
        });

        return [...found.values()];
    });

    return NextResponse.json({ mentionsByStep });
}
