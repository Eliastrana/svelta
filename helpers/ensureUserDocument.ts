import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { DEFAULT_PROFILE_THEME_ID } from '@/helpers/profileAppearance';
import { syncPublicUserProfile } from '@/helpers/publicUserProfile';

type EnsureUserOverrides = {
    displayName?: string;
    photoURL?: string;
};

export async function ensureUserDocument(
    user: User,
    overrides?: EnsureUserOverrides
) {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    const preferredDisplayName =
        overrides?.displayName || user.displayName || 'Unnamed User';
    const preferredPhotoURL = overrides?.photoURL || user.photoURL || '';

    if (docSnap.exists()) {
        const existingData = docSnap.data();
        await syncPublicUserProfile(user.uid, {
            name: existingData.name || preferredDisplayName,
            photoURL: existingData.photoURL || preferredPhotoURL,
            favoriteFood: existingData.favoriteFood || '',
        });

        return {
            created: false,
            data: existingData,
        };
    }

    const data = {
        name: preferredDisplayName,
        following: [],
        followingCount: 0,
        followerCount: 0,
        incomingFollowRequests: [],
        outgoingFollowRequests: [],
        isProfilePrivate: false,
        photoURL: preferredPhotoURL,
        backgroundPhotoURL: '',
        bio: '',
        favoriteFood: '',
        profileThemeId: DEFAULT_PROFILE_THEME_ID,
        profileFontId: 'urbanist',
        hasCompletedOnboarding: false,
    };

    await setDoc(userDocRef, data);
    await syncPublicUserProfile(user.uid, {
        name: data.name,
        photoURL: data.photoURL,
        favoriteFood: data.favoriteFood,
    });

    return {
        created: true,
        data,
    };
}
