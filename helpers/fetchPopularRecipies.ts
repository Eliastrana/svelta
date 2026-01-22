import {
    getFirestore,
    collection,
    query,
    getDocs,
    limit,
    orderBy,
    getCountFromServer,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export async function fetchPopularRecipes(top = 50): Promise<Recipe[]> {
    const db = getFirestore();
    const scanLimit = Math.max(top, 100);

    const q = query(
        collection(db, 'recipes'),
        orderBy('createdAt', 'desc'),
        limit(scanLimit),
    );

    const snap = await getDocs(q);

    const recipes = await Promise.all(
        snap.docs.map(async (doc) => {
            const data = doc.data() as Omit<Recipe, 'id' | 'likeCount' | 'commentCount'>;
            const id = doc.id;

            const [likesSnap, commentsSnap] = await Promise.all([
                getCountFromServer(collection(db, 'recipes', id, 'likes')),
                getCountFromServer(collection(db, 'recipes', id, 'comments')),
            ]);

            const likeCount = likesSnap.data().count;
            const commentCount = commentsSnap.data().count;

            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
            const ageInHours =
                (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            const popularityScore = (likeCount + commentCount * 2) / (ageInHours + 2);

            return {
                id,
                ...data,
                likeCount,
                commentCount,
                popularityScore,
            };
        })
    );

    return recipes
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, top);
}
