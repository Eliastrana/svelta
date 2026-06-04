import {
    doc,
    increment,
    runTransaction,
    serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '@/firebase';

export async function setRecipeRating(
    recipeId: string,
    uid: string,
    value: number
) {
    if (!uid) throw new Error('Missing uid');
    if (!Number.isInteger(value) || value < 1 || value > 5)
        throw new Error('Invalid rating value');

    const recipeRef = doc(firestore, 'recipes', recipeId);
    const ratingRef = doc(firestore, 'recipes', recipeId, 'ratings', uid);

    await runTransaction(firestore, async (tx) => {
        const [recipeSnap, ratingSnap] = await Promise.all([
            tx.get(recipeRef),
            tx.get(ratingRef),
        ]);

        if (!recipeSnap.exists()) throw new Error('Recipe not found');

        if (ratingSnap.exists()) {
            const oldValue =
                (ratingSnap.data() as { value?: number }).value ?? 0;
            const delta = value - oldValue;

            tx.update(ratingRef, { value, updatedAt: serverTimestamp() });
            tx.update(recipeRef, { ratingSum: increment(delta) });
        } else {
            tx.set(ratingRef, {
                value,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            tx.update(recipeRef, {
                ratingCount: increment(1),
                ratingSum: increment(value),
            });
        }
    });
}
