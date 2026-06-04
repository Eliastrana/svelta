import {
    arrayRemove,
    arrayUnion,
    doc,
    getDoc,
    increment,
    writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/firebase';

export type FollowableUserDoc = {
    following?: string[];
    followingCount?: number;
    followerCount?: number;
    incomingFollowRequests?: string[];
    outgoingFollowRequests?: string[];
    isProfilePrivate?: boolean;
    name?: string;
    photoURL?: string;
};

export type FollowState = 'self' | 'following' | 'requested' | 'not_following';
export type FollowActionResult =
    | 'followed'
    | 'unfollowed'
    | 'requested'
    | 'request_cancelled';

function includesId(list: string[] | undefined, id: string) {
    return Array.isArray(list) && list.includes(id);
}

export function getFollowState(
    currentUid: string,
    targetUid: string,
    currentUser?: FollowableUserDoc | null,
    targetUser?: FollowableUserDoc | null
): FollowState {
    if (!currentUid || currentUid === targetUid) return 'self';
    if (includesId(currentUser?.following, targetUid)) return 'following';
    if (
        includesId(currentUser?.outgoingFollowRequests, targetUid) ||
        includesId(targetUser?.incomingFollowRequests, currentUid)
    ) {
        return 'requested';
    }
    return 'not_following';
}

export async function toggleFollowAction(
    currentUid: string,
    targetUid: string
): Promise<FollowActionResult> {
    if (!currentUid || !targetUid || currentUid === targetUid) {
        throw new Error('Ugyldig følgehandling.');
    }

    const currentRef = doc(firestore, 'users', currentUid);
    const targetRef = doc(firestore, 'users', targetUid);
    const [currentSnap, targetSnap] = await Promise.all([
        getDoc(currentRef),
        getDoc(targetRef),
    ]);

    if (!currentSnap.exists() || !targetSnap.exists()) {
        throw new Error('Fant ikke brukeren.');
    }

    const currentData = currentSnap.data() as FollowableUserDoc;
    const targetData = targetSnap.data() as FollowableUserDoc;
    const isFollowing = includesId(currentData.following, targetUid);
    const hasPendingRequest =
        includesId(currentData.outgoingFollowRequests, targetUid) ||
        includesId(targetData.incomingFollowRequests, currentUid);
    const batch = writeBatch(firestore);

    if (isFollowing) {
        batch.update(currentRef, {
            following: arrayRemove(targetUid),
            followingCount: increment(-1),
            outgoingFollowRequests: arrayRemove(targetUid),
        });
        batch.update(targetRef, {
            followerCount: increment(-1),
            incomingFollowRequests: arrayRemove(currentUid),
        });
        await batch.commit();
        return 'unfollowed';
    }

    if (hasPendingRequest) {
        batch.update(currentRef, {
            outgoingFollowRequests: arrayRemove(targetUid),
        });
        batch.update(targetRef, {
            incomingFollowRequests: arrayRemove(currentUid),
        });
        await batch.commit();
        return 'request_cancelled';
    }

    if (targetData.isProfilePrivate) {
        batch.update(currentRef, {
            outgoingFollowRequests: arrayUnion(targetUid),
        });
        batch.update(targetRef, {
            incomingFollowRequests: arrayUnion(currentUid),
        });
        await batch.commit();
        return 'requested';
    }

    batch.update(currentRef, {
        following: arrayUnion(targetUid),
        followingCount: increment(1),
        outgoingFollowRequests: arrayRemove(targetUid),
    });
    batch.update(targetRef, {
        followerCount: increment(1),
        incomingFollowRequests: arrayRemove(currentUid),
    });
    await batch.commit();
    return 'followed';
}

export async function respondToFollowRequest(
    profileOwnerUid: string,
    requesterUid: string,
    accept: boolean
) {
    if (!profileOwnerUid || !requesterUid || profileOwnerUid === requesterUid) {
        throw new Error('Ugyldig forespørsel.');
    }

    const ownerRef = doc(firestore, 'users', profileOwnerUid);
    const requesterRef = doc(firestore, 'users', requesterUid);
    const batch = writeBatch(firestore);

    batch.update(ownerRef, {
        incomingFollowRequests: arrayRemove(requesterUid),
    });
    batch.update(requesterRef, {
        outgoingFollowRequests: arrayRemove(profileOwnerUid),
    });

    if (accept) {
        batch.update(requesterRef, {
            following: arrayUnion(profileOwnerUid),
            followingCount: increment(1),
        });
        batch.update(ownerRef, {
            followerCount: increment(1),
        });
    }

    await batch.commit();
}
