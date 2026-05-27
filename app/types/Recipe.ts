import { Timestamp } from 'firebase/firestore';
import { RecipeVisibility } from '@/helpers/recipeVisibility';


export type RecipeStep = {
    title: string;
    description: string;
    imageUrl?: string;
};

export type Recipe = {
    creator?: {
        name?: string;
        photoURL?: string;
    };
    id: string;
    title: string;
    description?: string;
    coverImage?: string;
    image: string;
    userId: string;
    visibility?: RecipeVisibility;

    ingredients?: string[];
    cookingSteps: RecipeStep[];

    temperature?: string;
    cookingTime?: string;

    ratingSum?: number;
    ratingCount?: number;


    createdAt?: Timestamp;

    // Denormalized counts
    likeCount?: number;
    commentCount?: number;

    tags?: string[];


    // Optional (used for popular sorting only, not stored)
    popularityScore?: number;
};
