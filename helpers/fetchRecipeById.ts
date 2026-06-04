// helpers/fetchRecipeById.ts
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export async function fetchRecipeById(id: string): Promise<Recipe> {
    if (!id) throw new Error('Missing recipe id');

    const db = getFirestore();
    const ref = doc(db, 'recipes', id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        throw new Error('Recipe not found');
    }

    const data = snap.data() as Omit<Recipe, 'id'>;
    return { id: snap.id, ...data };
}
