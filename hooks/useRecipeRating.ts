'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase';

type RecipeRatingAgg = {
    ratingSum?: number;
    ratingCount?: number;
};

type RatingDoc = {
    value?: number;
};

export function useRecipeRating(recipeId: string, uid?: string) {
    const [myRating, setMyRating] = useState<number>(0);
    const [ratingSum, setRatingSum] = useState<number>(0);
    const [ratingCount, setRatingCount] = useState<number>(0);

    // recipe aggregates
    useEffect(() => {
        if (!recipeId) return;

        const recipeRef = doc(firestore, 'recipes', recipeId);
        const unsub = onSnapshot(recipeRef, (snap) => {
            const data = (snap.data() as RecipeRatingAgg | undefined) ?? {};
            setRatingSum(
                typeof data.ratingSum === 'number' ? data.ratingSum : 0
            );
            setRatingCount(
                typeof data.ratingCount === 'number' ? data.ratingCount : 0
            );
        });

        return () => unsub();
    }, [recipeId]);

    // my rating
    useEffect(() => {
        if (!recipeId || !uid) {
            setMyRating(0);
            return;
        }

        const ratingRef = doc(firestore, 'recipes', recipeId, 'ratings', uid);
        const unsub = onSnapshot(ratingRef, (snap) => {
            if (!snap.exists()) {
                setMyRating(0);
                return;
            }
            const data = snap.data() as RatingDoc;
            setMyRating(typeof data.value === 'number' ? data.value : 0);
        });

        return () => unsub();
    }, [recipeId, uid]);

    const avg = useMemo(() => {
        if (!ratingCount) return 0;
        return ratingSum / ratingCount;
    }, [ratingSum, ratingCount]);

    return { myRating, ratingSum, ratingCount, avg };
}
