'use client';
import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CookingStep } from './useFollowedRecipes';

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

export function useRecipe(recipeId: string): [RecipeDetail | null, boolean] {
    const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!recipeId) return;
        (async () => {
            const recipeDocRef = doc(firestore, 'recipes', recipeId);
            const recipeSnap = await getDoc(recipeDocRef);
            if (recipeSnap.exists()) {
                const data = recipeSnap.data() as Omit<RecipeDetail, 'id'>;
                setRecipe({ id: recipeSnap.id, ...data });
            } else {
                setRecipe(null);
            }
            setLoading(false);
        })();
    }, [recipeId]);

    return [recipe, loading];
}
