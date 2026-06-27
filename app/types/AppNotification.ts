import type { Timestamp } from 'firebase/firestore';

export type AppNotificationType =
    | 'like'
    | 'comment'
    | 'new_recipe'
    | 'coauthor_invite';

export type CoAuthorInviteStatus = 'pending' | 'accepted' | 'declined';

export interface AppNotification {
    id: string;
    type: AppNotificationType;
    title: string;
    body: string;
    link: string;
    recipientId: string;
    actorId: string;
    actorName?: string;
    actorPhotoURL?: string;
    recipeId?: string;
    recipeTitle?: string;
    commentText?: string;
    coAuthorInviteStatus?: CoAuthorInviteStatus;
    respondedAt?: Timestamp | null;
    createdAt?: Timestamp | null;
    readAt?: Timestamp | null;
}
