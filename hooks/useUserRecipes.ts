'use client';

import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export function useUserRecipes(userId: string): Recipe[] {
    const [recipes, setRecipes] = useState<Recipe[]>([]);

    useEffect(() => {
        if (!userId) {
            setRecipes([]);
            return;
        }

        const recipesQuery = query(
            collection(firestore, 'recipes'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            recipesQuery,
            (snapshot) => {
                const recipesData: Recipe[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data() as Omit<Recipe, 'id'>;

                    return {
                        id: docSnap.id,
                        ...data,
                        likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
                        commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
                    };
                });

                setRecipes(recipesData);
            },
            (err) => {
                console.error('useUserRecipes snapshot error:', err.code, err.message);
                setRecipes([]);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    return recipes;
}