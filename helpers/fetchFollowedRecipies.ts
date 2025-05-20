import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    limit,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export async function fetchFollowedRecipes(
    followingIds: string[],
    perChunkLimit = 20,
): Promise<Recipe[]> {
    if (!followingIds.length) return [];

    const db = getFirestore();

    // Firestore `in` supports ≤10 values
    const chunks: string[][] = [];
    for (let i = 0; i < followingIds.length; i += 10) {
        chunks.push(followingIds.slice(i, i + 10));
    }

    const all: Recipe[] = [];

    for (const chunk of chunks) {
        const q = query(
            collection(db, 'recipes'),
            where('userId', 'in', chunk),
            orderBy('createdAt', 'desc'),
            limit(perChunkLimit),
        );

        const snap = await getDocs(q);

        snap.forEach((doc) => {
            const data = doc.data() as Omit<Recipe, 'id'>;
            all.push({ id: doc.id, ...data });
        });
    }

    // newest first
    return all.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}
