import {
    getFirestore,
    collection,
    query,
    orderBy,
    getDocs,
    limit,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export async function fetchPopularRecipes(top = 50): Promise<Recipe[]> {
    const db = getFirestore();

    const q = query(
        collection(db, 'recipes'),
        orderBy('likes', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(top),
    );

    const snap = await getDocs(q);

    return snap.docs.map((doc) => {
        // tell TS there's no `id` in the spread object
        const data = doc.data() as Omit<Recipe, 'id'>;
        return { id: doc.id, ...data };
    });
}
