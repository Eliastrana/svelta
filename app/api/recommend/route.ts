// app/api/recommend/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Recipe } from '@/app/types/Recipe';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ReqBody = {
    prompt: string;
    recipes: Array<Pick<Recipe, 'id' | 'title' | 'description'>>;
};

export async function POST(request: Request) {
    const body: ReqBody = await request.json();

    if (!body.prompt) {
        return NextResponse.json(
            { error: 'Prompt is required' },
            { status: 400 }
        );
    }
    if (!Array.isArray(body.recipes) || body.recipes.length === 0) {
        return NextResponse.json(
            { error: 'No recipes provided' },
            { status: 400 }
        );
    }

    // build the numbered list from the passed-in array
    const list = body.recipes
        .map((r, i) => `${i + 1}. ${r.title}: ${r.description}`)
        .join('\n');

    const chat = await openai.chat.completions.create({
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: `
You are a recipe assistant.
Given a numbered list of recipes (title + description) and a user request,
select the single recipe number that best matches. Respond *only* with that number.
        `.trim(),
            },
            { role: 'user', content: `Recipes:\n${list}` },
            { role: 'user', content: `User wants: ${body.prompt}` },
        ],
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const choice = chat.choices[0]?.message?.content.trim();
    const idx = parseInt(choice || '', 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= body.recipes.length) {
        return NextResponse.json(
            { error: 'Tror ikke det der handlet om oppskrifter 🫢' },
            { status: 500 }
        );
    }

    // return the single chosen recipe object
    return NextResponse.json({ recipe: body.recipes[idx] });
}
