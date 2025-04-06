import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    getCountFromServer,
    orderBy,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export function useFollowedRecipes(
    currentUserId: string,
    following: string[]
): [Recipe[], boolean] {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUserId || following.length === 0) {
            setRecipes([]);
            setLoading(false);
            return;
        }

        const recipesQuery = query(
            collection(firestore, 'recipes'),
            where('userId', 'in', following),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(recipesQuery, async (snapshot) => {
            const recipesData: Recipe[] = await Promise.all(
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
                    };
                })
            );
            setRecipes(recipesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUserId, JSON.stringify(following)]);

    return [recipes, loading];
}
