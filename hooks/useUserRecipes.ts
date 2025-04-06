'use client';
import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getCountFromServer,
} from 'firebase/firestore';
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

        // Since we need async calls for likes/comments, we use an async callback here.
        const unsubscribe = onSnapshot(recipesQuery, async (snapshot) => {
            // Fetch likeCount and commentCount for each doc in parallel.
            const recipesData = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data() as Omit<
                        Recipe,
                        'id' | 'likeCount' | 'commentCount'
                    >;
                    const id = docSnap.id;

                    const likesSnap = await getCountFromServer(
                        collection(firestore, 'recipes', id, 'likes')
                    );
                    const commentsSnap = await getCountFromServer(
                        collection(firestore, 'recipes', id, 'comments')
                    );

                    return {
                        id,
                        ...data,
                        likeCount: likesSnap.data().count,
                        commentCount: commentsSnap.data().count,
                    } as Recipe;
                })
            );

            setRecipes(recipesData);
        });

        return () => unsubscribe();
    }, [userId]);

    return recipes;
}
