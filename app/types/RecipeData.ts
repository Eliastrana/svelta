import { CookingStep } from '@/app/types/CookingStep';
import { RecipeVisibility } from '@/helpers/recipeVisibility';

export interface RecipeData {
    title: string;
    description: string;
    image: string;
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
    ingredients?: string[];
    temperature?: string;
    cookingTime?: string;
    coverImage?: string;
    portions?: string;
    visibility?: RecipeVisibility;
}
