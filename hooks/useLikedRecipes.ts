'use client';
import { useState, useEffect } from 'react';
import { firestore } from '@/firebase';
import {
    collectionGroup,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    collection,
    getCountFromServer,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

interface RecipeWithCreator extends Recipe {
    creator?: {
        name?: string;
        photoURL?: string;
    };
}

export function useUserLikedRecipes(userId: string): RecipeWithCreator[] {
    const [likedRecipes, setLikedRecipes] = useState<RecipeWithCreator[]>([]);

    useEffect(() => {
        if (!userId) {
            setLikedRecipes([]);
            return;
        }

        const likesRef = collectionGroup(firestore, 'likes');
        const q = query(likesRef, where('userId', '==', userId));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const recipePromises = snapshot.docs.map(async (likeDoc) => {
                const recipeRef = likeDoc.ref.parent.parent;
                if (!recipeRef) return null;

                const recipeSnap = await getDoc(recipeRef);
                if (!recipeSnap.exists()) return null;

                const recipeId = recipeSnap.id;
                const recipeData = recipeSnap.data() as Omit<
                    Recipe,
                    'id' | 'likeCount' | 'commentCount'
                >;

                const likesSnap = await getCountFromServer(
                    collection(firestore, 'recipes', recipeId, 'likes')
                );
                const commentsSnap = await getCountFromServer(
                    collection(firestore, 'recipes', recipeId, 'comments')
                );

                let creator = null;
                if (recipeData.userId) {
                    const creatorDocSnap = await getDoc(
                        doc(firestore, 'users', recipeData.userId)
                    );
                    if (creatorDocSnap.exists()) {
                        creator = creatorDocSnap.data();
                    }
                }

                return {
                    id: recipeId,
                    ...recipeData,
                    likeCount: likesSnap.data().count,
                    commentCount: commentsSnap.data().count,
                    creator,
                } as RecipeWithCreator;
            });

            const resolvedRecipes = (await Promise.all(recipePromises)).filter(
                Boolean
            ) as RecipeWithCreator[];
            setLikedRecipes(resolvedRecipes);
        });

        return () => unsubscribe();
    }, [userId]);

    return likedRecipes;
}
