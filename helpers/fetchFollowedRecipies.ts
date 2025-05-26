import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    getCountFromServer,
    limit,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

// A RawRecipe includes the id but omits likes and comments
type RawRecipe = Omit<Recipe, 'likes' | 'comments'> & { id: string };

/**
 * Fetch the latest recipes from users you follow, including live like/comment counts.
 *
 * @param followingIds - Array of user IDs you follow
 * @param perChunkLimit - Max recipes to fetch per Firestore 'in' chunk (default 20)
 * @returns Array of Recipe with up-to-date likes and comments counts
 */
export async function fetchFollowedRecipes(
    followingIds: string[],
    perChunkLimit = 20,
): Promise<Recipe[]> {
    if (!followingIds.length) return [];

    const db = getFirestore();

    // Break the follow list into Firestore 'in' chunks of <=10
    const chunks: string[][] = [];
    for (let i = 0; i < followingIds.length; i += 10) {
        chunks.push(followingIds.slice(i, i + 10));
    }

    // 1) Fetch raw recipe data (with id) for each chunk
    const raws: RawRecipe[] = [];
    for (const chunk of chunks) {
        const q = query(
            collection(db, 'recipes'),
            where('userId', 'in', chunk),
            orderBy('createdAt', 'desc'),
            limit(perChunkLimit),
        );

        const snap = await getDocs(q);
        snap.forEach((doc) => {
            raws.push({ id: doc.id, ...(doc.data() as Omit<Recipe, 'id' | 'likes' | 'comments'>) });
        });
    }

    // 2) Hydrate each recipe with live like/comment counts
    const withCounts: Recipe[] = await Promise.all(
        raws.map(async ({ id, ...data }) => {
            const [likesSnap, commentsSnap] = await Promise.all([
                getCountFromServer(collection(db, 'recipes', id, 'likes')),
                getCountFromServer(collection(db, 'recipes', id, 'comments')),
            ]);

            return {
                id,
                ...data,
                likes:    likesSnap.data().count,
                comments: commentsSnap.data().count,
            } as Recipe;
        }),
    );

    // 3) Sort by creation date descending before returning
    return withCounts.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}