'use client';

import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import {
    collectionGroup,
    query,
    where,
    onSnapshot,
    getDoc,
    doc,
    DocumentData,
    QueryDocumentSnapshot,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

type Creator = {
    name?: string;
    photoURL?: string;
};

export interface RecipeWithCreator extends Recipe {
    creator?: Creator;
}

type LikeDoc = {
    userId: string;
    createdAt?: unknown;
};

const getRecipeRefFromLike = (
    likeDoc: QueryDocumentSnapshot<DocumentData>
) => likeDoc.ref.parent.parent ?? null;

export function useUserLikedRecipes(userId: string): RecipeWithCreator[] {
    const [likedRecipes, setLikedRecipes] = useState<RecipeWithCreator[]>([]);

    useEffect(() => {
        if (!userId) {
            setLikedRecipes([]);
            return;
        }

        const likesRef = collectionGroup(firestore, 'likes');
        const q = query(likesRef, where('userId', '==', userId));

        const unsubscribe = onSnapshot(
            q,
            async (snapshot) => {
                const recipePromises = snapshot.docs.map(async (likeDoc) => {
                    // If your likes docs sometimes miss userId, this keeps TS happy:
                    const likeData = likeDoc.data() as Partial<LikeDoc>;
                    if (!likeData.userId) return null;

                    const recipeRef = getRecipeRefFromLike(likeDoc);
                    if (!recipeRef) return null;

                    const recipeSnap = await getDoc(recipeRef);
                    if (!recipeSnap.exists()) return null;

                    const recipeData = recipeSnap.data() as Omit<Recipe, 'id'>;
                    const recipeId = recipeSnap.id;

                    let creator: Creator | undefined;
                    if (recipeData.userId) {
                        const creatorSnap = await getDoc(doc(firestore, 'users', recipeData.userId));
                        if (creatorSnap.exists()) {
                            const c = creatorSnap.data() as Creator;
                            creator = { name: c.name, photoURL: c.photoURL };
                        }
                    }

                    return {
                        id: recipeId,
                        ...recipeData,
                        creator,
                    } as RecipeWithCreator;
                });

                const resolved = (await Promise.all(recipePromises)).filter(
                    (x): x is RecipeWithCreator => Boolean(x)
                );

                // Optional: sort newest first if you have createdAt on recipe
                resolved.sort((a, b) => {
                    const ta =
                        typeof (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis === 'function'
                            ? (a.createdAt as { toMillis: () => number }).toMillis()
                            : 0;
                    const tb =
                        typeof (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis === 'function'
                            ? (b.createdAt as { toMillis: () => number }).toMillis()
                            : 0;
                    return tb - ta;
                });

                setLikedRecipes(resolved);
            },
            (err) => {
                console.error('useUserLikedRecipes snapshot error:', err.code, err.message);
                setLikedRecipes([]);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    return likedRecipes;
}