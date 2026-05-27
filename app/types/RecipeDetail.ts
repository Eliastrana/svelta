import { CookingStep } from '@/app/types/CookingStep';
import { RecipeVisibility } from '@/helpers/recipeVisibility';

export interface RecipeDetail {
    id: string;
    title: string;
    description: string;
    image: string;
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
    ingredients?: string[];
    temperature?: string;
    cookingTime?: string;
    userId: string;
    coverImage?: string;
    visibility?: RecipeVisibility;
}
