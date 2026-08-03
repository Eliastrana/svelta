import type { StepIngredientMention } from '@/app/types/CookingStep';

type IngredientInput = {
    name: string;
    amount?: string;
};

type StepInput = {
    title: string;
    description: string;
};

type ApiMention = {
    ingredientName?: string;
    matchText?: string;
};

const normalizeName = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

export async function generateStepIngredientMentions(args: {
    ingredientsDetailed: IngredientInput[];
    cookingSteps: StepInput[];
}): Promise<StepIngredientMention[][]> {
    const stepsCount = args.cookingSteps.length;

    if (!stepsCount) return [];

    const emptyResult = Array.from({ length: stepsCount }, () => []);
    const ingredientsDetailed = args.ingredientsDetailed
        .map((ingredient) => ({
            name: ingredient.name.trim(),
            amount: (ingredient.amount ?? '').trim(),
        }))
        .filter((ingredient) => ingredient.name.length > 0);

    if (!ingredientsDetailed.length) return emptyResult;

    try {
        const res = await fetch('/api/annotate-step-ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredientsDetailed,
                cookingSteps: args.cookingSteps.map((step) => ({
                    title: step.title.trim(),
                    description: step.description.trim(),
                })),
            }),
        });

        const data = (await res.json()) as {
            mentionsByStep?: ApiMention[][];
        };

        if (!res.ok || !Array.isArray(data.mentionsByStep)) {
            return emptyResult;
        }

        const ingredientMap = new Map(
            ingredientsDetailed.map((ingredient) => [
                normalizeName(ingredient.name),
                ingredient.amount,
            ])
        );

        return Array.from({ length: stepsCount }, (_, index) => {
            const mentions = Array.isArray(data.mentionsByStep?.[index])
                ? data.mentionsByStep[index]
                : [];

            const seen = new Set<string>();

            return mentions.flatMap((mention) => {
                const ingredientName = (mention.ingredientName ?? '').trim();
                const matchText = (mention.matchText ?? '').trim();
                const amount =
                    ingredientMap.get(normalizeName(ingredientName)) ?? '';

                if (!ingredientName || !matchText || !amount) return [];

                const key = `${normalizeName(ingredientName)}|${matchText.toLowerCase()}`;
                if (seen.has(key)) return [];
                seen.add(key);

                return [
                    {
                        ingredientName,
                        matchText,
                        amount,
                    },
                ];
            });
        });
    } catch (error) {
        console.error('Could not generate step ingredient mentions:', error);
        return emptyResult;
    }
}
