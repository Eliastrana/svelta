import {
    collection,
    query,
    where,
    getDocs,
    documentId,            // ← modular helper
} from 'firebase/firestore';
import { firestore } from '@/firebase';
import { UserDoc } from '@/hooks/useUserData';

/**
 * Fetch user documents whose document-IDs are in `uids`.
 * Firestore allows up to 30 IDs per `in` filter, so we chunk if needed.
 */
export const fetchManyUsers = async (
    uids: string[],
): Promise<Record<string, UserDoc>> => {
    if (!uids.length) return {};

    const CHUNK = 30;                                        // Firestore limit
    const chunks = Array.from(
        { length: Math.ceil(uids.length / CHUNK) },
        (_, i) => uids.slice(i * CHUNK, i * CHUNK + CHUNK),
    );

    const out: Record<string, UserDoc> = {};

    await Promise.all(
        chunks.map(async (ids) => {
            const snap = await getDocs(
                query(
                    collection(firestore, 'users'),
                    where(documentId(), 'in', ids),                   // ✔ match doc-ID
                ),
            );
            snap.forEach((d) => (out[d.id] = d.data() as UserDoc));
        }),
    );

    return out;
};
