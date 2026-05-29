'use client';

import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import {
    collectionGroup,
    query,
    where,
    onSnapshot,
    getDoc,
    DocumentData,
    QueryDocumentSnapshot,
    DocumentReference,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';

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

// ✅ Shape of your recipe docs in Firestore (add fields you use)
type RecipeDocData = Omit<Recipe, 'id'> & {
    likeCount?: number;
    commentCount?: number;
    ratingSum?: number;
    ratingCount?: number;
};

function getRecipeRefFromLike(
    likeDoc: QueryDocumentSnapshot<DocumentData>
): DocumentReference<DocumentData> | null {
    return likeDoc.ref.parent.parent ?? null;
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

        const unsubscribe = onSnapshot(
            q,
            async (snapshot) => {
                const recipePromises = snapshot.docs.map(async (likeDoc) => {
                    const likeData = likeDoc.data() as Partial<LikeDoc>;
                    if (!likeData.userId) return null;

                    const recipeRef = getRecipeRefFromLike(likeDoc);
                    if (!recipeRef) return null;

                    const recipeSnap = await getDoc(recipeRef);
                    if (!recipeSnap.exists()) return null;

                    const recipeId = recipeSnap.id;
                    const recipeData = recipeSnap.data() as RecipeDocData;

                    // ✅ safe numeric defaults (no any)
                    const likeCount = typeof recipeData.likeCount === 'number' ? recipeData.likeCount : 0;
                    const commentCount = typeof recipeData.commentCount === 'number' ? recipeData.commentCount : 0;
                    const ratingSum = typeof recipeData.ratingSum === 'number' ? recipeData.ratingSum : 0;
                    const ratingCount = typeof recipeData.ratingCount === 'number' ? recipeData.ratingCount : 0;

                    return {
                        id: recipeId,
                        ...recipeData,
                        likeCount,
                        commentCount,
                        ratingSum,
                        ratingCount,
                    } as RecipeWithCreator;
                });

                const resolved = (await Promise.all(recipePromises)).filter(
                    (x): x is RecipeWithCreator => x !== null
                );

                const creatorIds = Array.from(
                    new Set(
                        resolved
                            .map((recipe) => recipe.userId)
                            .filter((value): value is string => Boolean(value)),
                    ),
                );
                const creatorsMap = creatorIds.length > 0 ? await fetchManyUsers(creatorIds) : {};

                resolved.forEach((recipe) => {
                    const creator = creatorsMap[recipe.userId];
                    if (creator) {
                        recipe.creator = { name: creator.name, photoURL: creator.photoURL };
                    }
                });

                // Optional: sort newest first if createdAt is Firestore Timestamp
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
                console.error('useUserLikedRecipes snapshot error:', (err as { code?: string }).code, err.message);
                setLikedRecipes([]);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    return likedRecipes;
}
