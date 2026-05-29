import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';

export type PublicUserDoc = {
    name?: string;
    photoURL?: string;
    favoriteFood?: string;
};

export function buildPublicUserProfile(data: PublicUserDoc): PublicUserDoc {
    return {
        name: (data.name ?? '').trim(),
        photoURL: (data.photoURL ?? '').trim(),
        favoriteFood: (data.favoriteFood ?? '').trim(),
    };
}

export async function syncPublicUserProfile(uid: string, data: PublicUserDoc) {
    await setDoc(doc(firestore, 'publicUsers', uid), buildPublicUserProfile(data), { merge: true });
}

export async function fetchPublicUserProfile(uid: string): Promise<PublicUserDoc | null> {
    const snap = await getDoc(doc(firestore, 'publicUsers', uid));
    if (!snap.exists()) return null;
    return snap.data() as PublicUserDoc;
}
