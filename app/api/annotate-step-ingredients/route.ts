import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ReqBody = {
    ingredientsDetailed: Array<{ name: string; amount?: string }>;
    cookingSteps: Array<{ title: string; description: string }>;
};

type RawMention = {
    ingredientName?: unknown;
    matchText?: unknown;
};

function toCleanString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
    const body = (await request.json()) as Partial<ReqBody>;

    const ingredientsDetailed = Array.isArray(body.ingredientsDetailed)
        ? body.ingredientsDetailed
        : [];
    const cookingSteps = Array.isArray(body.cookingSteps)
        ? body.cookingSteps
        : [];

    if (!ingredientsDetailed.length || !cookingSteps.length) {
        return NextResponse.json(
            { mentionsByStep: cookingSteps.map(() => []) },
            { status: 200 }
        );
    }

    const ingredientNames = ingredientsDetailed
        .map((ingredient) => toCleanString(ingredient.name))
        .filter(Boolean);

    if (!ingredientNames.length) {
        return NextResponse.json(
            { mentionsByStep: cookingSteps.map(() => []) },
            { status: 200 }
        );
    }

    const prompt = JSON.stringify(
        {
            ingredients: ingredientNames,
            steps: cookingSteps.map((step, index) => ({
                stepIndex: index,
                title: toCleanString(step.title),
                description: toCleanString(step.description),
            })),
        },
        null,
        2
    );

    try {
        const chat = await openai.chat.completions.create({
            model: 'gpt-4.1-mini-2025-04-14',
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: `
Du mapper ingredienser til oppskriftssteg.

SVAR KUN med gyldig JSON.
Format:
[
  [{"ingredientName":"...","matchText":"..."}],
  [],
  [{"ingredientName":"...","matchText":"..."}]
]

KRAV:
- Returner en ytre array med NØYAKTIG samme lengde som antall steg.
- Hvert steg skal være en array av objekter eller en tom array.
- ingredientName må være NØYAKTIG lik et navn fra ingredients-listen.
- matchText må være en NØYAKTIG substring fra step.description.
- Ta kun med ingredienser som faktisk er eksplisitt nevnt i beskrivelsen.
- Ikke gjett løst. Hvis en ingrediens ikke er tydelig nevnt, la den være ute.
- Ta kun med én oppføring per ingrediens per steg.
- Ingen markdown. Ingen forklaringer. Kun JSON.
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
            const start = raw.indexOf('[');
            const end = raw.lastIndexOf(']');
            if (start >= 0 && end > start) {
                parsed = JSON.parse(raw.slice(start, end + 1));
            } else {
                return NextResponse.json(
                    { error: 'Kunne ikke parse AI-svar.' },
                    { status: 500 }
                );
            }
        }

        const mentionsByStep = Array.isArray(parsed) ? parsed : [];
        const normalized = cookingSteps.map((step, index) => {
            const stepMentions = Array.isArray(mentionsByStep[index])
                ? (mentionsByStep[index] as RawMention[])
                : [];

            const seen = new Set<string>();

            return stepMentions.flatMap((mention) => {
                const ingredientName = toCleanString(mention.ingredientName);
                const matchText = toCleanString(mention.matchText);

                if (!ingredientName || !matchText) return [];
                if (!ingredientNames.includes(ingredientName)) return [];
                if (!toCleanString(step.description).includes(matchText)) {
                    return [];
                }

                const key = `${ingredientName.toLowerCase()}|${matchText.toLowerCase()}`;
                if (seen.has(key)) return [];
                seen.add(key);

                return [{ ingredientName, matchText }];
            });
        });

        return NextResponse.json({ mentionsByStep: normalized });
    } catch (error) {
        console.error('annotate-step-ingredients error', error);
        return NextResponse.json(
            { error: 'Feil ved annotering av steg.' },
            { status: 500 }
        );
    }
}
