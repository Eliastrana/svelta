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

type RawRecipe = Omit<Recipe, 'id'> & { id: string };

const toMillis = (t: any) => (t?.toMillis ? t.toMillis() : Number(t) || 0);

export async function fetchFollowedRecipes(
    followingIds: string[],
    perChunkLimit = 20,
): Promise<Recipe[]> {
    if (!followingIds.length) return [];

    const db = getFirestore();

    // Firestore 'in' supports <=10 values
    const chunks: string[][] = [];
    for (let i = 0; i < followingIds.length; i += 10) {
        chunks.push(followingIds.slice(i, i + 10));
    }

    const raws: RawRecipe[] = [];
    for (const chunk of chunks) {
        const q = query(
            collection(db, 'recipes'),
            where('userId', 'in', chunk),
            orderBy('createdAt', 'desc'),
            limit(perChunkLimit),
        );

        const snap = await getDocs(q);
        snap.forEach((d) => {
            raws.push({ id: d.id, ...(d.data() as Omit<Recipe, 'id'>) });
        });
    }

    // Ensure stable sorting even if createdAt is Timestamp
    return raws.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}
