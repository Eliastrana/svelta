// collectionHelpers.ts
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    DocumentReference,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
} from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export type CollectionDoc = {
    id: string;
    name: string;
    coverImage?: string;
    description?: string;
    isPublic?: boolean;
    ownerId?: string;
    createdAt?: unknown;
};

export type CollectionSummary = {
    previewImage: string;
    recipeCount: number;
};

const timestampToMillis = (value: Timestamp | Date | number | undefined): number => {
    if (!value) return 0;
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return value;
};

// ────────────────────────────────────────────────────────────────────────────────
// Collections CRUD helpers
// ────────────────────────────────────────────────────────────────────────────────
export async function createCollection(
    uid: string,
    name: string,
    coverImage?: string,
    description?: string,
    isPublic?: boolean,
) {
    const db = getFirestore();
    return addDoc(collection(db, 'users', uid, 'collections'), {
        name,
        coverImage: coverImage || '',
        description: description?.trim() || '',
        isPublic: !!isPublic,
        ownerId: uid,
        createdAt: serverTimestamp(),
    });
}

export async function addRecipeToCollection(
    collectionId: string,
    recipe: Pick<Recipe, 'id'>,
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

    return snap.docs.map((d): CollectionDoc => ({
        id: d.id,
        ...(d.data() as Omit<CollectionDoc, 'id'>),
    }));
}

export async function fetchPublicCollections(uid: string) {
    const collections = await fetchCollections(uid);
    return collections.filter((collection) => !!collection.isPublic);
}

export async function fetchCollectionByOwner(ownerId: string, collectionId: string) {
    const db = getFirestore();
    const snap = await getDoc(doc(db, 'users', ownerId, 'collections', collectionId));

    if (!snap.exists()) return null;

    return {
        id: snap.id,
        ...(snap.data() as Omit<CollectionDoc, 'id'>),
    } as CollectionDoc;
}

export async function updateCollection(
    ownerId: string,
    collectionId: string,
    updates: {
        name: string;
        description?: string;
        coverImage?: string;
        isPublic?: boolean;
    },
) {
    const db = getFirestore();
    await updateDoc(doc(db, 'users', ownerId, 'collections', collectionId), {
        name: updates.name.trim(),
        description: updates.description?.trim() || '',
        coverImage: updates.coverImage || '',
        isPublic: !!updates.isPublic,
    });
}

export async function toggleRecipeInCollection(
    collectionId: string,
    recipeId: string,
    inCollection: boolean,
    ownerId: string,
) {
    return inCollection
        ? removeRecipeFromCollection(collectionId, recipeId)
        : addRecipeToCollection(collectionId, { id: recipeId }, ownerId);
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

export async function fetchCollectionSummary(collectionId: string): Promise<CollectionSummary> {
    const db = getFirestore();
    const refsSnap = await getDocs(collection(db, 'collectionsRecipes', collectionId, 'recipes'));

    if (refsSnap.empty) {
        return { previewImage: '', recipeCount: 0 };
    }

    let newestDoc = refsSnap.docs[0];
    let newestAddedAt = timestampToMillis(
        refsSnap.docs[0].data().addedAt as Timestamp | Date | number | undefined,
    );

    for (const refDoc of refsSnap.docs.slice(1)) {
        const addedAt = timestampToMillis(
            refDoc.data().addedAt as Timestamp | Date | number | undefined,
        );
        if (addedAt > newestAddedAt) {
            newestAddedAt = addedAt;
            newestDoc = refDoc;
        }
    }

    const recipeRef = newestDoc.data().recipeRef as DocumentReference;
    const recipeSnap = await getDoc(recipeRef);

    if (!recipeSnap.exists()) {
        return { previewImage: '', recipeCount: refsSnap.size };
    }

    const data = recipeSnap.data() as Partial<Recipe>;
    return {
        previewImage: data.coverImage?.trim() || '',
        recipeCount: refsSnap.size,
    };
}
