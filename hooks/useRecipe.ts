'use client';
import { useQuery } from '@tanstack/react-query';

import { Recipe } from '@/app/types/Recipe';
import { fetchRecipeById } from '@/helpers/fetchRecipeById';

export function useRecipe(
    recipeId: string,
    initialRecipe?: Recipe | null
): [Recipe | null, boolean] {
    const { data, isPending } = useQuery({
        queryKey: ['recipe', recipeId],
        queryFn: () => fetchRecipeById(recipeId),
        enabled: Boolean(recipeId),
        ...(initialRecipe ? { initialData: initialRecipe } : {}),
    });

    return [data ?? null, isPending];
}
