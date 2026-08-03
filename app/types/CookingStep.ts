export interface LinkedRecipeReference {
    id: string;
    title: string;
    coverImage?: string;
}

export interface StepIngredientMention {
    ingredientName: string;
    matchText: string;
    amount: string;
}

export interface CookingStep {
    title: string;
    description: string;
    imageUrl?: string;
    linkedRecipe?: LinkedRecipeReference;
    ingredientMentions?: StepIngredientMention[];
}
