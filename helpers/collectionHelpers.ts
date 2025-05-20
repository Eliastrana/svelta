// collectionHelpers.ts
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    serverTimestamp,
    deleteDoc,
    getDocs,
    query,
    orderBy,
    getDoc,
    DocumentReference,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

// ────────────────────────────────────────────────────────────────────────────────
// Collections CRUD helpers
// ────────────────────────────────────────────────────────────────────────────────
export async function createCollection(uid: string, name: string) {
    const db = getFirestore();
    return addDoc(collection(db, 'users', uid, 'collections'), {
        name,
        createdAt: serverTimestamp(),
    });
}

export async function addRecipeToCollection(
    collectionId: string,
    recipe: Recipe,
    ownerId: string,
) {
    const db = getFirestore();
    await setDoc(doc(db, 'collectionsRecipes', collectionId, 'recipes', recipe.id), {
        ownerId, // for security rules
        recipeRef: doc(db, 'recipes', recipe.id),
        addedAt: serverTimestamp(),
    });
}

export async function removeRecipeFromCollection(
    collectionId: string,
    recipeId: string,
) {
    const db = getFirestore();
    await deleteDoc(doc(db, 'collectionsRecipes', collectionId, 'recipes', recipeId));
}

export async function fetchCollections(uid: string) {
    const db = getFirestore();
    const snap = await getDocs(
        query(collection(db, 'users', uid, 'collections'), orderBy('createdAt', 'desc')),
    );

    return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as { name: string; createdAt?: unknown }),
    }));
}

export async function toggleRecipeInCollection(
    collectionId: string,
    recipeId: string,
    inCollection: boolean,
    ownerId: string,
) {
    return inCollection
        ? removeRecipeFromCollection(collectionId, recipeId)
        : addRecipeToCollection(collectionId, { id: recipeId } as any, ownerId);
}

// ────────────────────────────────────────────────────────────────────────────────
// Fetch recipes that belong to a collection
// ────────────────────────────────────────────────────────────────────────────────
export async function fetchCollectionRecipes(collectionId: string) {
    const db = getFirestore();
    const snap = await getDocs(collection(db, 'collectionsRecipes', collectionId, 'recipes'));

    const results: { recipe: Recipe }[] = [];

    for (const refDoc of snap.docs) {
        const recipeRef = refDoc.data().recipeRef as DocumentReference;
        const recipeSnap = await getDoc(recipeRef);

        if (recipeSnap.exists()) {
            // Avoid duplicating the `id` key when spreading
            const data = recipeSnap.data() as Omit<Recipe, 'id'>;
            results.push({ recipe: { ...data, id: recipeSnap.id } });
        }
    }

    return results;
}
