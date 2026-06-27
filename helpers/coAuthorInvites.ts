'use client';

import {
    doc,
    runTransaction,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { firestore } from '@/firebase';
import type {
    AppNotification,
    CoAuthorInviteStatus,
} from '@/app/types/AppNotification';
import type { RecipeCoAuthor } from '@/app/types/Recipe';

type CreateCoAuthorInviteArgs = {
    actorId: string;
    actorName: string;
    actorPhotoURL?: string;
    inviteeId: string;
    recipeId: string;
    recipeTitle: string;
};

export async function createCoAuthorInviteNotification(
    args: CreateCoAuthorInviteArgs
) {
    const notificationRef = doc(
        firestore,
        'users',
        args.inviteeId,
        'notifications',
        `${args.recipeId}_${args.actorId}_coauthor`
    );

    await setDoc(
        notificationRef,
        {
            recipientId: args.inviteeId,
            actorId: args.actorId,
            actorName: args.actorName,
            actorPhotoURL: args.actorPhotoURL ?? '',
            type: 'coauthor_invite',
            title: `${args.actorName} inviterte deg som medforfatter`,
            body: `Vil du stå som medforfatter på "${args.recipeTitle}"?`,
            link: `/recipe/${args.recipeId}`,
            recipeId: args.recipeId,
            recipeTitle: args.recipeTitle,
            coAuthorInviteStatus: 'pending',
            createdAt: serverTimestamp(),
            readAt: null,
            respondedAt: null,
        },
        { merge: true }
    );
}

type RespondToInviteArgs = {
    userId: string;
    notificationId: string;
    accept: boolean;
};

export async function respondToCoAuthorInvite({
    userId,
    notificationId,
    accept,
}: RespondToInviteArgs) {
    const notificationRef = doc(
        firestore,
        'users',
        userId,
        'notifications',
        notificationId
    );

    await runTransaction(firestore, async (transaction) => {
        const notificationSnap = await transaction.get(notificationRef);
        if (!notificationSnap.exists()) {
            throw new Error('Invitasjonen finnes ikke lenger.');
        }

        const notification = notificationSnap.data() as AppNotification;
        if (notification.type !== 'coauthor_invite' || !notification.recipeId) {
            throw new Error('Ugyldig medforfatterinvitasjon.');
        }

        const recipeRef = doc(firestore, 'recipes', notification.recipeId);
        const recipeSnap = await transaction.get(recipeRef);
        if (!recipeSnap.exists()) {
            transaction.set(
                notificationRef,
                {
                    coAuthorInviteStatus: 'declined' satisfies CoAuthorInviteStatus,
                    respondedAt: serverTimestamp(),
                    readAt: serverTimestamp(),
                },
                { merge: true }
            );
            return;
        }

        const recipeData = recipeSnap.data() as {
            coAuthors?: RecipeCoAuthor[];
            coAuthorIds?: string[];
            pendingCoAuthorInviteIds?: string[];
        };

        const currentPending = Array.isArray(recipeData.pendingCoAuthorInviteIds)
            ? recipeData.pendingCoAuthorInviteIds
            : [];
        const nextPending = currentPending.filter((id) => id !== userId);
        const currentCoAuthorIds = Array.isArray(recipeData.coAuthorIds)
            ? recipeData.coAuthorIds
            : [];

        const nextStatus: CoAuthorInviteStatus = accept
            ? 'accepted'
            : 'declined';

        if (!currentPending.includes(userId)) {
            transaction.set(
                notificationRef,
                {
                    coAuthorInviteStatus: currentCoAuthorIds.includes(userId)
                        ? ('accepted' satisfies CoAuthorInviteStatus)
                        : ('declined' satisfies CoAuthorInviteStatus),
                    respondedAt: serverTimestamp(),
                    readAt: serverTimestamp(),
                },
                { merge: true }
            );
            return;
        }

        if (accept) {
            const publicProfileSnap = await transaction.get(
                doc(firestore, 'publicUsers', userId)
            );
            const publicProfile = publicProfileSnap.exists()
                ? ((publicProfileSnap.data() as {
                      name?: string;
                      photoURL?: string;
                  }) ?? {})
                : null;
            const currentCoAuthors = Array.isArray(recipeData.coAuthors)
                ? recipeData.coAuthors
                : [];

            const nextCoAuthorIds = currentCoAuthorIds.includes(userId)
                ? currentCoAuthorIds
                : [...currentCoAuthorIds, userId];

            const nextCoAuthors = currentCoAuthors.some(
                (coAuthor) => coAuthor.uid === userId
            )
                ? currentCoAuthors
                : [
                      ...currentCoAuthors,
                      {
                          uid: userId,
                          name: publicProfile?.name?.trim() || 'Medforfatter',
                          photoURL: publicProfile?.photoURL?.trim() || '',
                      },
                  ];

            transaction.set(
                recipeRef,
                {
                    coAuthorIds: nextCoAuthorIds,
                    coAuthors: nextCoAuthors,
                    pendingCoAuthorInviteIds: nextPending,
                },
                { merge: true }
            );
        } else {
            transaction.set(
                recipeRef,
                { pendingCoAuthorInviteIds: nextPending },
                { merge: true }
            );
        }

        transaction.set(
            notificationRef,
            {
                coAuthorInviteStatus: nextStatus,
                respondedAt: serverTimestamp(),
                readAt: serverTimestamp(),
            },
            { merge: true }
        );
    });
}
