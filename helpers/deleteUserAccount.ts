'use client';

import { deleteUser, reauthenticateWithPopup, User } from 'firebase/auth';
import {
    arrayRemove,
    collection,
    collectionGroup,
    deleteDoc,
    doc,
    DocumentReference,
    documentId,
    getDoc,
    getDocs,
    increment,
    query,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { auth, firestore, provider } from '@/firebase';

const BATCH_LIMIT = 400;

function createBatchCommitter() {
    let batch = writeBatch(firestore);
    let opCount = 0;

    const commitIfNeeded = async () => {
        if (opCount < BATCH_LIMIT) return;
        await batch.commit();
        batch = writeBatch(firestore);
        opCount = 0;
    };

    return {
        async delete(ref: DocumentReference) {
            batch.delete(ref);
            opCount += 1;
            await commitIfNeeded();
        },
        async update(ref: DocumentReference, data: Record<string, unknown>) {
            batch.update(ref, data);
            opCount += 1;
            await commitIfNeeded();
        },
        async flush() {
            if (opCount === 0) return;
            await batch.commit();
            batch = writeBatch(firestore);
            opCount = 0;
        },
    };
}

export async function deleteUserAccountAndActivity(currentUser: User) {
    const uid = currentUser.uid;

    if (!uid) throw new Error('Mangler bruker-ID.');
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
        throw new Error('Du må være logget inn for å slette kontoen.');
    }

    const hasGoogleProvider = currentUser.providerData.some((p) => p.providerId === 'google.com');
    if (!hasGoogleProvider) {
        throw new Error('Logg inn på nytt med Google før du sletter kontoen.');
    }

    await reauthenticateWithPopup(currentUser, provider);

    const allRecipesSnap = await getDocs(collection(firestore, 'recipes'));
    const allRecipeDocs = allRecipesSnap.docs;
    const allRecipeIds = new Set(allRecipeDocs.map((recipeDoc) => recipeDoc.id));
    const ownRecipeDocs = allRecipeDocs.filter((recipeDoc) => {
        const data = recipeDoc.data() as { userId?: string };
        return data.userId === uid;
    });
    const ownRecipeIds = new Set(ownRecipeDocs.map((recipeDoc) => recipeDoc.id));

    const batcher = createBatchCommitter();

    const likesByUserSnap = await getDocs(query(collectionGroup(firestore, 'likes'), where('userId', '==', uid)));
    const likeDeltas = new Map<string, number>();

    for (const likeDoc of likesByUserSnap.docs) {
        const recipeId = likeDoc.ref.parent.parent?.id;
        if (recipeId && ownRecipeIds.has(recipeId)) continue;

        await batcher.delete(likeDoc.ref);

        if (!recipeId || !allRecipeIds.has(recipeId)) continue;
        likeDeltas.set(recipeId, (likeDeltas.get(recipeId) ?? 0) - 1);
    }

    const commentsByUserSnap = await getDocs(
        query(collectionGroup(firestore, 'comments'), where('userId', '==', uid)),
    );
    const commentDeltas = new Map<string, number>();

    for (const commentDoc of commentsByUserSnap.docs) {
        const recipeId = commentDoc.ref.parent.parent?.id;
        if (recipeId && ownRecipeIds.has(recipeId)) continue;

        await batcher.delete(commentDoc.ref);

        if (!recipeId || !allRecipeIds.has(recipeId)) continue;
        commentDeltas.set(recipeId, (commentDeltas.get(recipeId) ?? 0) - 1);
    }

    const ratingDeltas = new Map<string, { count: number; sum: number }>();

    try {
        const ratingsByUserSnap = await getDocs(
            query(collectionGroup(firestore, 'ratings'), where(documentId(), '==', uid)),
        );

        for (const ratingDoc of ratingsByUserSnap.docs) {
            const recipeId = ratingDoc.ref.parent.parent?.id;
            const value = Number((ratingDoc.data() as { value?: number }).value ?? 0);
            if (recipeId && ownRecipeIds.has(recipeId)) continue;

            await batcher.delete(ratingDoc.ref);

            if (!recipeId || !allRecipeIds.has(recipeId)) continue;
            const prev = ratingDeltas.get(recipeId) ?? { count: 0, sum: 0 };
            ratingDeltas.set(recipeId, { count: prev.count - 1, sum: prev.sum - value });
        }
    } catch {
        for (const recipeDoc of allRecipeDocs) {
            if (ownRecipeIds.has(recipeDoc.id)) continue;

            const ratingRef = doc(firestore, 'recipes', recipeDoc.id, 'ratings', uid);
            const ratingSnap = await getDoc(ratingRef);
            if (!ratingSnap.exists()) continue;

            const value = Number((ratingSnap.data() as { value?: number }).value ?? 0);

            await batcher.delete(ratingRef);

            const prev = ratingDeltas.get(recipeDoc.id) ?? { count: 0, sum: 0 };
            ratingDeltas.set(recipeDoc.id, { count: prev.count - 1, sum: prev.sum - value });
        }
    }

    for (const [recipeId, delta] of likeDeltas) {
        await batcher.update(doc(firestore, 'recipes', recipeId), {
            likeCount: increment(delta),
        });
    }

    for (const [recipeId, delta] of commentDeltas) {
        await batcher.update(doc(firestore, 'recipes', recipeId), {
            commentCount: increment(delta),
        });
    }

    for (const [recipeId, delta] of ratingDeltas) {
        await batcher.update(doc(firestore, 'recipes', recipeId), {
            ratingCount: increment(delta.count),
            ratingSum: increment(delta.sum),
        });
    }

    for (const recipeDoc of ownRecipeDocs) {
        const [likesSnap, commentsSnap, ratingsSnap, collectionRefsSnap] = await Promise.all([
            getDocs(collection(firestore, 'recipes', recipeDoc.id, 'likes')),
            getDocs(collection(firestore, 'recipes', recipeDoc.id, 'comments')),
            getDocs(collection(firestore, 'recipes', recipeDoc.id, 'ratings')),
            getDocs(
                query(
                    collectionGroup(firestore, 'recipes'),
                    where('recipeRef', '==', doc(firestore, 'recipes', recipeDoc.id)),
                ),
            ),
        ]);

        for (const snap of [likesSnap, commentsSnap, ratingsSnap, collectionRefsSnap]) {
            for (const childDoc of snap.docs) {
                await batcher.delete(childDoc.ref);
            }
        }

        await batcher.delete(recipeDoc.ref);
    }

    const ownCollectionsSnap = await getDocs(collection(firestore, 'users', uid, 'collections'));
    for (const collectionDoc of ownCollectionsSnap.docs) {
        const collectionRecipesSnap = await getDocs(
            collection(firestore, 'collectionsRecipes', collectionDoc.id, 'recipes'),
        );

        for (const recipeRefDoc of collectionRecipesSnap.docs) {
            await batcher.delete(recipeRefDoc.ref);
        }

        await batcher.delete(collectionDoc.ref);
    }

    const followerDocsSnap = await getDocs(
        query(collection(firestore, 'users'), where('following', 'array-contains', uid)),
    );
    const outgoingRequestDocsSnap = await getDocs(
        query(collection(firestore, 'users'), where('incomingFollowRequests', 'array-contains', uid)),
    );
    const incomingRequestDocsSnap = await getDocs(
        query(collection(firestore, 'users'), where('outgoingFollowRequests', 'array-contains', uid)),
    );

    await batcher.flush();

    for (const followerDoc of followerDocsSnap.docs) {
        await updateDoc(followerDoc.ref, {
            following: arrayRemove(uid),
        });
    }

    for (const targetDoc of outgoingRequestDocsSnap.docs) {
        await updateDoc(targetDoc.ref, {
            incomingFollowRequests: arrayRemove(uid),
        });
    }

    for (const requesterDoc of incomingRequestDocsSnap.docs) {
        await updateDoc(requesterDoc.ref, {
            outgoingFollowRequests: arrayRemove(uid),
        });
    }

    await deleteDoc(doc(firestore, 'publicUsers', uid));
    await deleteDoc(doc(firestore, 'users', uid));
    await deleteUser(currentUser);
}
