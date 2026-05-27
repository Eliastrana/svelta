import { Recipe } from '@/app/types/Recipe';

export type RecipeVisibility = 'public' | 'private';

export function normalizeRecipeVisibility(value?: string | null): RecipeVisibility {
    return value === 'private' ? 'private' : 'public';
}

export function canViewRecipe(
    recipe: Pick<Recipe, 'userId'> & { visibility?: string },
    viewerUid?: string,
    followingIds: string[] = [],
) {
    const visibility = normalizeRecipeVisibility(recipe.visibility);
    if (visibility === 'public') return true;
    if (!viewerUid) return false;
    if (recipe.userId === viewerUid) return true;
    return followingIds.includes(recipe.userId);
}

export function filterVisibleRecipes<T extends Pick<Recipe, 'userId'> & { visibility?: string }>(
    recipes: T[],
    viewerUid?: string,
    followingIds: string[] = [],
) {
    return recipes.filter((recipe) => canViewRecipe(recipe, viewerUid, followingIds));
}
