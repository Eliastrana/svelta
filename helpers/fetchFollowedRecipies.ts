import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    limit,
    Timestamp,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

type RawRecipe = Omit<Recipe, 'id'> & { id: string };

function toMillis(value: unknown): number {
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
}

export async function fetchFollowedRecipes(
    followingIds: string[],
    perChunkLimit = 20
): Promise<Recipe[]> {
    if (!followingIds.length) return [];

    const db = getFirestore();

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
            limit(perChunkLimit)
        );

        const snap = await getDocs(q);
        snap.forEach((d) => {
            raws.push({ id: d.id, ...(d.data() as Omit<Recipe, 'id'>) });
        });
    }

    return raws
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .map((r) => ({ ...r })); // allerede Recipe-shape (id + fields)
}
