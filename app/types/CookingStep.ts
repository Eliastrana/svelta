export interface LinkedRecipeReference {
    id: string;
    title: string;
    coverImage?: string;
}

export interface CookingStep {
    title: string;
    description: string;
    imageUrl?: string;
    linkedRecipe?: LinkedRecipeReference;
}
