import { CookingStep } from '@/app/types/CookingStep';

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
}
