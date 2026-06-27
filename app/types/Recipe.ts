import { Timestamp } from 'firebase/firestore';
import { RecipeVisibility } from '@/helpers/recipeVisibility';
import { LinkedRecipeReference } from '@/app/types/CookingStep';

export type RecipeStep = {
    title: string;
    description: string;
    imageUrl?: string;
    linkedRecipe?: LinkedRecipeReference;
};

export type RecipeCoAuthor = {
    uid: string;
    name?: string;
    photoURL?: string;
};

export type Recipe = {
    creator?: {
        name?: string;
        photoURL?: string;
    };
    coAuthors?: RecipeCoAuthor[];
    coAuthorIds?: string[];
    pendingCoAuthorInviteIds?: string[];
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
