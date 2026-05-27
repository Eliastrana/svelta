import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { DEFAULT_PROFILE_THEME_ID } from '@/helpers/profileAppearance';

export async function ensureUserDocument(user: User) {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        return {
            created: false,
            data: docSnap.data(),
        };
    }

    const data = {
        name: user.displayName || 'Unnamed User',
        following: [],
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

    return {
        created: true,
        data,
    };
}
