// hooks/usePopularRecipes.ts
import { useState, useEffect } from 'react';
import {
    collection,
    getCountFromServer,
    onSnapshot,
    query,
} from 'firebase/firestore';
import { firestore } from '@/firebase';
import { Recipe } from '@/app/types/Recipe';

export const usePopularRecipes = (): [Recipe[], boolean] => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const recipesRef = collection(firestore, 'recipes');
        const q = query(recipesRef);
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            setLoading(true);

            // We could do all docs in parallel:
            const recipesData: Recipe[] = await Promise.all(
                querySnapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data() as Omit<Recipe, 'id'>;
                    const id = docSnap.id;

                    // getCountFromServer for likes
                    const likesSnap = await getCountFromServer(
                        collection(firestore, 'recipes', id, 'likes')
                    );
                    const commentsSnap = await getCountFromServer(
                        collection(firestore, 'recipes', id, 'comments')
                    );

                    const likeCount = likesSnap.data().count;
                    const commentCount = commentsSnap.data().count;

                    // Build the final recipe object
                    return {
                        id,
                        ...data,
                        likeCount,
                        commentCount,
                    };
                })
            );

            // Then do your popularity scoring on recipesData:
            const recipesWithScore = recipesData.map((recipe) => {
                const likes = recipe.likeCount || 0;
                const comments = recipe.commentCount || 0;
                const createdAt = recipe.createdAt
                    ? recipe.createdAt.toDate()
                    : new Date();
                const ageInHours =
                    (new Date().getTime() - createdAt.getTime()) /
                    (1000 * 60 * 60);
                const score = (likes + comments * 2) / (ageInHours + 2);
                return {
                    ...recipe,
                    popularityScore: score,
                };
            });

            recipesWithScore.sort(
                (a, b) => b.popularityScore - a.popularityScore
            );
            setRecipes(recipesWithScore);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return [recipes, loading];
};
