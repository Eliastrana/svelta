'use client';
import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CookingStep } from './useFollowedRecipes';

export interface Recipe {
    id: string;
    title: string;
    description: string;
    image: string;
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
    userId: string;
}

export function useUserRecipes(userId: string): Recipe[] {
    const [recipes, setRecipes] = useState<Recipe[]>([]);

    useEffect(() => {
        if (!userId) {
            setRecipes([]);
            return;
        }
        const recipesQuery = query(
            collection(firestore, 'recipes'),
            where('userId', '==', userId)
        );
        const unsubscribe = onSnapshot(recipesQuery, (snapshot) => {
            const recipesData: Recipe[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            })) as Recipe[];
            setRecipes(recipesData);
        });
        return () => unsubscribe();
    }, [userId]);

    return recipes;
}
