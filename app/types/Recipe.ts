import { Timestamp } from 'firebase/firestore';
import { CookingStep } from '@/app/types/CookingStep';

export interface Recipe {
    creator?: {
        name?: string;
        photoURL?: string;
    };
    id: string;
    userId: string;
    title: string;
    description: string;
    image: string;
    coverImage?: string;
    createdAt?: Timestamp;
    likeCount?: number;
    commentCount?: number;
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
}
