import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';

export type PublicUserDoc = {
    name?: string;
    photoURL?: string;
    favoriteFood?: string;

    // Profile appearance, mirrored so the cook directory can show it without
    // reading anyone's private user document.
    backgroundPhotoURL?: string;
    profileThemeId?: string;
};

const PUBLIC_FIELDS = [
    'name',
    'photoURL',
    'favoriteFood',
    'backgroundPhotoURL',
    'profileThemeId',
] as const;

/**
 * Only the fields a caller passes are written. The write merges, so a field
 * left out keeps its stored value rather than being blanked.
 */
export function buildPublicUserProfile(data: PublicUserDoc): PublicUserDoc {
    const profile: PublicUserDoc = {};

    for (const field of PUBLIC_FIELDS) {
        const value = data[field];
        if (value !== undefined) profile[field] = String(value).trim();
    }

    return profile;
}

export async function syncPublicUserProfile(uid: string, data: PublicUserDoc) {
    await setDoc(
        doc(firestore, 'publicUsers', uid),
        buildPublicUserProfile(data),
        { merge: true }
    );
}

export async function fetchPublicUserProfile(
    uid: string
): Promise<PublicUserDoc | null> {
    const snap = await getDoc(doc(firestore, 'publicUsers', uid));
    if (!snap.exists()) return null;
    return snap.data() as PublicUserDoc;
}
