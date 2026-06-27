import {
    collection,
    getDocs,
    getFirestore,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export async function fetchRecipesByUsers(userIds: string[]): Promise<Recipe[]> {
    if (!userIds.length) return [];

    const db = getFirestore();
    const chunks: string[][] = [];

    for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
    }

    const recipes: Recipe[] = [];

    for (const chunk of chunks) {
        const snap = await getDocs(
            query(
                collection(db, 'recipes'),
                where('userId', 'in', chunk),
                orderBy('createdAt', 'desc')
            )
        );

        snap.forEach((docSnap) => {
            recipes.push({
                id: docSnap.id,
                ...(docSnap.data() as Omit<Recipe, 'id'>),
            });
        });
    }

    return recipes;
}
