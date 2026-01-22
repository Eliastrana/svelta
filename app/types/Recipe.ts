import { Timestamp } from 'firebase/firestore';


export type RecipeStep = {
    title: string;
    description: string;
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

    ingredients?: string[];
    cookingSteps: RecipeStep[];

    temperature?: string;
    cookingTime?: string;

    createdAt?: Timestamp;

    // Denormalized counts
    likeCount?: number;
    commentCount?: number;

    // Optional (used for popular sorting only, not stored)
    popularityScore?: number;
};
