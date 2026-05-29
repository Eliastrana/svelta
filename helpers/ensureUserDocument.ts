import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { DEFAULT_PROFILE_THEME_ID } from '@/helpers/profileAppearance';
import { syncPublicUserProfile } from '@/helpers/publicUserProfile';

export async function ensureUserDocument(user: User) {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        const existingData = docSnap.data();
        await syncPublicUserProfile(user.uid, {
            name: existingData.name || user.displayName || 'Unnamed User',
            photoURL: existingData.photoURL || user.photoURL || '',
            favoriteFood: existingData.favoriteFood || '',
        });

        return {
            created: false,
            data: existingData,
        };
    }

    const data = {
        name: user.displayName || 'Unnamed User',
        following: [],
        followingCount: 0,
        followerCount: 0,
        incomingFollowRequests: [],
        outgoingFollowRequests: [],
        isProfilePrivate: false,
        photoURL: user.photoURL || '',
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
