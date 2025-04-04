// helpers/fetchUserData.ts
import { firestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserDoc } from '@/hooks/useUserData';

export async function fetchUserData(uid: string): Promise<UserDoc | null> {
    if (!uid) return null;
    const userDocRef = doc(firestore, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    return docSnap.exists() ? (docSnap.data() as UserDoc) : null;
}
