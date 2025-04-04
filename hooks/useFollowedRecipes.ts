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

export interface CookingStep {
    title: string;
    description: string;
}

export interface Recipe {
    id: string;
    title: string;
    description: string;
    image: string;
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
    userId: string;
    createdAt?: Date;
    coverImage?: string;
    likeCount?: number;
    commentCount?: number;
}

export function useFollowedRecipes(
    currentUserId: string,
    following: string[]
): [Recipe[], boolean] {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // If there's no current user or the following array is empty, update state and return.
        if (!currentUserId || following.length === 0) {
            setRecipes([]);
            setLoading(false);
            return;
        }

        // Create a query on recipes where the userId is in the following array.
        const recipesQuery = query(
            collection(firestore, 'recipes'),
            where('userId', 'in', following),
            // Uncomment the following line if you want to order by createdAt descending:
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
