import * as admin from 'firebase-admin';
import {
    onDocumentCreated,
    onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/https';
// Accounts have no v2 trigger of their own; deletion is still a v1 one.
import * as functionsV1 from 'firebase-functions/v1';

admin.initializeApp();
const db = admin.firestore();
const BACKFILL_KEY = process.env.BACKFILL_KEY;

type RecipeDoc = admin.firestore.DocumentData & {
    userId?: string;
    title?: string;
    description?: string;
    coverImage?: string;
    image?: string;
    visibility?: string;
    popularityScore?: number;
    createdAt?: admin.firestore.Timestamp | Date | number | null;
    likeCount?: number;
    commentCount?: number;
    ratingSum?: number;
    ratingCount?: number;
    cookingTime?: string;
    temperature?: string;
    portions?: string;
    tags?: string[];
};

type PublicUserDoc = {
    name?: string;
    photoURL?: string;
};

type NotificationType = 'like' | 'comment' | 'new_recipe' | 'coauthor_invite';

type NotificationPayload = {
    recipientId: string;
    actorId: string;
    actorName: string;
    actorPhotoURL?: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string;
    recipeId?: string;
    recipeTitle?: string;
    commentText?: string;

    /**
     * The same thing said without the cook's name in front of it. On a phone
     * the alert carries their face and their name already, the way a message
     * does, so repeating it reads as a stutter.
     */
    shortBody?: string;
};

function computePopularityScore(args: {
    likeCount?: number;
    commentCount?: number;
    createdAt: admin.firestore.Timestamp | Date | number | null | undefined;
    nowMs?: number;
}) {
    const likeCount = args.likeCount ?? 0;
    const commentCount = args.commentCount ?? 0;
    const nowMs = args.nowMs ?? Date.now();

    let createdMs = 0;
    const createdAt = args.createdAt;

    if (createdAt instanceof admin.firestore.Timestamp)
        createdMs = createdAt.toMillis();
    else if (createdAt instanceof Date) createdMs = createdAt.getTime();
    else if (typeof createdAt === 'number') createdMs = createdAt;

    const ageHours = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60));
    return (likeCount + commentCount * 2) / (ageHours + 2);
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
    );
}

function isPublicRecipe(data?: RecipeDoc | null): boolean {
    return data?.visibility !== 'private';
}

function truncateText(value: string, maxLength: number): string {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function getAppBaseUrl(): string {
    const explicitBaseUrl = process.env.APP_BASE_URL?.trim();
    if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/, '');

    const projectId =
        admin.app().options.projectId || process.env.GCLOUD_PROJECT || '';

    return projectId ? `https://${projectId}.web.app` : 'https://localhost';
}

function toAbsoluteUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${getAppBaseUrl()}${normalized}`;
}

async function fetchPublicUser(uid: string): Promise<PublicUserDoc> {
    const snap = await db.collection('publicUsers').doc(uid).get();
    return snap.exists ? ((snap.data() as PublicUserDoc) ?? {}) : {};
}

async function createNotification(
    payload: NotificationPayload
): Promise<string | null> {
    if (!payload.recipientId || payload.recipientId === payload.actorId) {
        return null;
    }

    const notificationRef = db
        .collection('users')
        .doc(payload.recipientId)
        .collection('notifications')
        .doc();

    await notificationRef.set({
        recipientId: payload.recipientId,
        actorId: payload.actorId,
        actorName: payload.actorName,
        actorPhotoURL: payload.actorPhotoURL ?? '',
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
        recipeId: payload.recipeId ?? '',
        recipeTitle: payload.recipeTitle ?? '',
        commentText: payload.commentText ?? '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readAt: null,
    });

    return notificationRef.id;
}

async function sendPushNotification(
    recipientId: string,
    payload: Pick<
        NotificationPayload,
        | 'title'
        | 'body'
        | 'link'
        | 'type'
        | 'actorId'
        | 'actorName'
        | 'actorPhotoURL'
        | 'shortBody'
    > & { notificationId: string }
) {
    const tokensSnap = await db
        .collection('notificationTokens')
        .where('userId', '==', recipientId)
        .get();

    const webTokens = tokensSnap.docs
        .filter((tokenDoc) => tokenDoc.data().kind !== 'expo')
        .map((tokenDoc) => tokenDoc.id)
        .filter((token) => token.length > 0);
    const expoTokens = tokensSnap.docs
        .filter((tokenDoc) => tokenDoc.data().kind === 'expo')
        .map((tokenDoc) => tokenDoc.id)
        // Expo hands out ExponentPushToken[...]; the shorter spelling is
        // accepted too, since both turn up in their own documentation.
        .filter(
            (token) =>
                token.startsWith('ExponentPushToken[') ||
                token.startsWith('ExpoPushToken[')
        );

    if (webTokens.length === 0 && expoTokens.length === 0) return;

    const iconPath = '/favicon/web-app-manifest-192x192.png';
    const badgePath = '/favicon/favicon-96x96.png';
    const tag = `svelta-${payload.type}`;

    const actorImage = payload.actorPhotoURL?.startsWith('https://')
        ? payload.actorPhotoURL
        : undefined;

    if (expoTokens.length > 0) {
        // Expo accepts up to 100 messages per request. Keep web and native
        // tokens separate: FCM cannot send to an Expo push token.
        for (let start = 0; start < expoTokens.length; start += 100) {
            const batch = expoTokens.slice(start, start + 100);
            try {
                const result = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batch.map((to) => ({
                        to,
                        title: payload.title,
                        body: payload.body,
                        sound: 'default',
                        channelId: 'svelta-alerts',
                        data: {
                            link: payload.link,
                            type: payload.type,
                            actorId: payload.actorId,
                            notificationId: payload.notificationId,
                            // Carried in the data as well: the extension that
                            // attaches it reads whichever of the two places
                            // this version of Expo put it in.
                            ...(actorImage ? { imageUrl: actorImage } : {}),
                            // The phone shows the alert under the cook's own
                            // name and face, so it needs both.
                            actorName: payload.actorName,
                            shortBody: payload.shortBody ?? payload.body,
                        },
                        ...(actorImage
                            ? {
                                  richContent: { image: actorImage },
                                  // Off by default, and without it iOS never
                                  // hands the alert to our extension, so the
                                  // picture is never fetched.
                                  mutableContent: true,
                              }
                            : {}),
                    }))),
                });
                if (!result.ok) throw new Error(`Expo push HTTP ${result.status}`);
                const tickets = (await result.json()) as {
                    data?: Array<{ status: string; details?: { error?: string } }>;
                };
                await Promise.all((tickets.data ?? []).map((ticket, index) => {
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        return db.collection('notificationTokens').doc(batch[index]).delete();
                    }
                    if (ticket.status === 'error') {
                        console.error('Expo push rejected notification:', ticket);
                    }
                    return Promise.resolve();
                }));
            } catch (error) {
                console.error('Could not send Expo push notification:', error);
            }
        }
    }

    if (webTokens.length === 0) return;

    const response = await admin.messaging().sendEachForMulticast({
        tokens: webTokens,
        data: {
            title: payload.title,
            body: payload.body,
            link: payload.link,
            type: payload.type,
            icon: actorImage ?? iconPath,
            badge: badgePath,
            tag,
        },
        webpush: {
            headers: {
                Urgency: 'high',
            },
            fcmOptions: {
                link: toAbsoluteUrl(payload.link),
            },
        },
    });

    const invalidTokenDeletes: Promise<unknown>[] = [];

    response.responses.forEach((result, index) => {
        if (result.success) return;

        const errorCode = result.error?.code ?? '';
        if (
            errorCode.includes('registration-token-not-registered') ||
            errorCode.includes('invalid-registration-token')
        ) {
            invalidTokenDeletes.push(
                db.collection('notificationTokens')
                    .doc(webTokens[index])
                    .delete()
                    .catch(() => undefined)
            );
        }

        console.error('Could not send push notification:', result.error);
    });

    if (invalidTokenDeletes.length > 0) {
        await Promise.all(invalidTokenDeletes);
    }
}

/** Which varsler the recipient still wants; missing or true means yes. */
type NotificationPrefs = {
    like?: boolean;
    comment?: boolean;
    newRecipe?: boolean;
};

const PREF_BY_TYPE: Record<string, keyof NotificationPrefs> = {
    like: 'like',
    comment: 'comment',
    new_recipe: 'newRecipe',
};

async function wantsNotification(
    recipientId: string,
    type: NotificationPayload['type']
): Promise<boolean> {
    const pref = PREF_BY_TYPE[type];

    // Anything without a setting of its own, such as a co-author invite,
    // always comes through: it is waiting on an answer.
    if (!pref) return true;

    const snap = await db.collection('users').doc(recipientId).get();
    const prefs = (snap.data()?.notificationPrefs ?? {}) as NotificationPrefs;

    return prefs[pref] !== false;
}

async function createAndSendNotification(payload: NotificationPayload) {
    if (!(await wantsNotification(payload.recipientId, payload.type))) return;

    const notificationId = await createNotification(payload);
    if (!notificationId) return;

    await sendPushNotification(payload.recipientId, {
        ...payload,
        notificationId,
    });
}

/** Shortest prefix a search matches on, so "ti" does not match everything. */
const SEARCH_MIN_PREFIX = 2;

/** Longest prefix stored per word; longer searches filter on the client. */
const SEARCH_MAX_PREFIX = 12;

/** Ceiling on stored prefixes, so one wordy recipe cannot bloat its doc. */
const SEARCH_MAX_TERMS = 400;

/**
 * The words a recipe can be found by: every prefix of every word in its title
 * and tags, lowercased and stripped of punctuation.
 *
 * Firestore can only match whole array entries, so the prefixes are what make
 * a search find something while it is still being typed.
 */
function buildSearchTerms(data: RecipeDoc): string[] {
    const source = [data.title ?? '', ...(data.tags ?? [])].join(' ');

    const words = source
        .toLowerCase()
        .normalize('NFC')
        .split(/[^\p{Letter}\p{Number}]+/u)
        .filter((word) => word.length >= SEARCH_MIN_PREFIX);

    const terms = new Set<string>();

    for (const word of words) {
        const end = Math.min(word.length, SEARCH_MAX_PREFIX);

        for (let length = SEARCH_MIN_PREFIX; length <= end; length += 1) {
            terms.add(word.slice(0, length));

            if (terms.size >= SEARCH_MAX_TERMS) return [...terms];
        }
    }

    return [...terms];
}

async function syncPublicPopularRecipe(
    recipeId: string,
    data?: RecipeDoc | null
) {
    const publicRef = db.collection('publicPopularRecipes').doc(recipeId);

    if (!data || !isPublicRecipe(data)) {
        await publicRef.delete().catch(() => undefined);
        return;
    }

    await publicRef.set(
        {
            userId: data.userId ?? '',
            title: data.title ?? '',
            description: data.description ?? '',
            coverImage: data.coverImage ?? '',
            image: data.image ?? '',
            visibility: 'public',
            popularityScore:
                typeof data.popularityScore === 'number'
                    ? data.popularityScore
                    : 0,
            createdAt:
                data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
            likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
            commentCount:
                typeof data.commentCount === 'number' ? data.commentCount : 0,
            ratingSum: typeof data.ratingSum === 'number' ? data.ratingSum : 0,
            ratingCount:
                typeof data.ratingCount === 'number' ? data.ratingCount : 0,
            cookingTime: data.cookingTime ?? '',
            temperature: data.temperature ?? '',
            portions: data.portions ?? '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            searchTerms: buildSearchTerms(data),
            feedUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

async function recomputeTopActiveCreatorsDoc(opts?: {
    topN?: number;
    scanLimit?: number;
}) {
    const topN = opts?.topN ?? 2;
    const scanLimit = opts?.scanLimit ?? 250;

    const snap = await db
        .collection('publicPopularRecipes')
        .orderBy('createdAt', 'desc')
        .limit(scanLimit)
        .get();

    const counts = new Map<string, number>();
    snap.forEach((recipeDoc) => {
        const data = recipeDoc.data() as RecipeDoc;
        const uid = (data.userId ?? '').trim();
        if (!uid) return;
        counts.set(uid, (counts.get(uid) ?? 0) + 1);
    });

    const creators = Array.from(counts.entries())
        .map(([uid, recipeCount]) => ({ uid, recipeCount }))
        .sort((a, b) => b.recipeCount - a.recipeCount)
        .slice(0, topN);

    await db.collection('publicFeedMeta').doc('topActiveCreators').set(
        {
            creators,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

async function rebuildPublicPopularRecipesMirror() {
    const pageSize = 400;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    while (true) {
        let recipeQuery = db
            .collection('recipes')
            .orderBy('createdAt', 'desc')
            .limit(pageSize);
        if (lastDoc) {
            recipeQuery = recipeQuery.startAfter(lastDoc);
        }

        const snap = await recipeQuery.get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach((recipeDoc) => {
            const data = recipeDoc.data() as RecipeDoc;
            const publicRef = db
                .collection('publicPopularRecipes')
                .doc(recipeDoc.id);

            if (!isPublicRecipe(data)) {
                batch.delete(publicRef);
                return;
            }

            batch.set(
                publicRef,
                {
                    userId: data.userId ?? '',
                    title: data.title ?? '',
                    description: data.description ?? '',
                    coverImage: data.coverImage ?? '',
                    image: data.image ?? '',
                    visibility: 'public',
                    popularityScore:
                        typeof data.popularityScore === 'number'
                            ? data.popularityScore
                            : 0,
                    createdAt:
                        data.createdAt ??
                        admin.firestore.FieldValue.serverTimestamp(),
                    likeCount:
                        typeof data.likeCount === 'number' ? data.likeCount : 0,
                    commentCount:
                        typeof data.commentCount === 'number'
                            ? data.commentCount
                            : 0,
                    ratingSum:
                        typeof data.ratingSum === 'number' ? data.ratingSum : 0,
                    ratingCount:
                        typeof data.ratingCount === 'number'
                            ? data.ratingCount
                            : 0,
                    cookingTime: data.cookingTime ?? '',
                    temperature: data.temperature ?? '',
                    portions: data.portions ?? '',
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    searchTerms: buildSearchTerms(data),
                    feedUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        });

        await batch.commit();
        lastDoc = snap.docs[snap.docs.length - 1];
    }
}

async function rebuildFollowerCounts() {
    const usersSnap = await db.collection('users').get();
    const followerCounts = new Map<string, number>();

    usersSnap.docs.forEach((userDoc) => {
        const following = asStringArray(userDoc.data().following);
        following.forEach((followedUid) => {
            followerCounts.set(
                followedUid,
                (followerCounts.get(followedUid) ?? 0) + 1
            );
        });
    });

    const batch = db.batch();
    usersSnap.docs.forEach((userDoc) => {
        const following = asStringArray(userDoc.data().following);
        batch.set(
            userDoc.ref,
            {
                followingCount: following.length,
                followerCount: followerCounts.get(userDoc.id) ?? 0,
            },
            { merge: true }
        );
    });

    await batch.commit();
}

export const recomputePopularityOnWrite = onDocumentWritten(
    'recipes/{recipeId}',
    async (event) => {
        const after = event.data?.after;
        if (!after?.exists) return;

        const data = after.data() as RecipeDoc;
        const score = computePopularityScore({
            likeCount: data.likeCount,
            commentCount: data.commentCount,
            createdAt: data.createdAt,
        });

        const prev =
            typeof data.popularityScore === 'number'
                ? data.popularityScore
                : null;
        if (prev !== null && Math.abs(prev - score) < 0.0001) return;

        await after.ref.set(
            {
                popularityScore: score,
                popularityUpdatedAt:
                    admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
);

export const syncPublicPopularRecipeOnWrite = onDocumentWritten(
    'recipes/{recipeId}',
    async (event) => {
        const recipeId = event.params.recipeId;
        const after = event.data?.after;
        const data = after?.exists ? (after.data() as RecipeDoc) : null;

        await syncPublicPopularRecipe(recipeId, data);
        await recomputeTopActiveCreatorsDoc();
    }
);

export const syncFollowerCountsOnUserWrite = onDocumentWritten(
    'users/{userId}',
    async (event) => {
        const userId = event.params.userId;
        const beforeData = event.data?.before.exists
            ? event.data.before.data()
            : null;
        const afterData = event.data?.after.exists
            ? event.data.after.data()
            : null;

        const beforeFollowing = new Set(asStringArray(beforeData?.following));
        const afterFollowing = new Set(asStringArray(afterData?.following));

        const added = Array.from(afterFollowing).filter(
            (uid) => uid !== userId && !beforeFollowing.has(uid)
        );
        const removed = Array.from(beforeFollowing).filter(
            (uid) => uid !== userId && !afterFollowing.has(uid)
        );

        const batch = db.batch();
        let writes = 0;

        if (event.data?.after.exists) {
            const nextFollowingCount = afterFollowing.size;
            const prevFollowingCount =
                typeof afterData?.followingCount === 'number'
                    ? afterData.followingCount
                    : null;

            if (prevFollowingCount !== nextFollowingCount) {
                batch.set(
                    event.data.after.ref,
                    { followingCount: nextFollowingCount },
                    { merge: true }
                );
                writes += 1;
            }
        }

        added.forEach((uid) => {
            batch.set(
                db.collection('users').doc(uid),
                { followerCount: admin.firestore.FieldValue.increment(1) },
                { merge: true }
            );
            writes += 1;
        });

        removed.forEach((uid) => {
            batch.set(
                db.collection('users').doc(uid),
                { followerCount: admin.firestore.FieldValue.increment(-1) },
                { merge: true }
            );
            writes += 1;
        });

        if (writes > 0) {
            await batch.commit();
        }
    }
);

export const notifyRecipeOwnerOnLike = onDocumentCreated(
    'recipes/{recipeId}/likes/{likeId}',
    async (event) => {
        const recipeId = event.params.recipeId;
        const likeData = event.data?.data() as { userId?: string } | undefined;
        const actorId = likeData?.userId ?? event.params.likeId;

        if (!actorId) return;

        const [recipeSnap, actorProfile] = await Promise.all([
            db.collection('recipes').doc(recipeId).get(),
            fetchPublicUser(actorId),
        ]);

        if (!recipeSnap.exists) return;

        const recipe = recipeSnap.data() as RecipeDoc;
        const recipientId = recipe.userId ?? '';
        if (!recipientId || recipientId === actorId) return;

        const actorName = actorProfile.name?.trim() || 'En kokk';
        const recipeTitle = recipe.title?.trim() || 'oppskriften din';

        await createAndSendNotification({
            recipientId,
            actorId,
            actorName,
            actorPhotoURL: actorProfile.photoURL ?? '',
            type: 'like',
            title: `${actorName} tok av seg hatten! 🧑‍🍳`,
            body: `${actorName} likte "${recipeTitle}".`,
            shortBody: `Tok av seg hatten for "${recipeTitle}" 🧑‍🍳`,
            link: `/recipe/${recipeId}`,
            recipeId,
            recipeTitle,
        });
    }
);

export const notifyRecipeOwnerOnComment = onDocumentCreated(
    'recipes/{recipeId}/comments/{commentId}',
    async (event) => {
        const recipeId = event.params.recipeId;
        const commentData = (event.data?.data() ?? {}) as {
            text?: string;
            userId?: string;
        };
        const actorId = commentData.userId ?? '';

        if (!actorId) return;

        const [recipeSnap, actorProfile] = await Promise.all([
            db.collection('recipes').doc(recipeId).get(),
            fetchPublicUser(actorId),
        ]);

        if (!recipeSnap.exists) return;

        const recipe = recipeSnap.data() as RecipeDoc;
        const recipientId = recipe.userId ?? '';
        if (!recipientId || recipientId === actorId) return;

        const actorName = actorProfile.name?.trim() || 'En kokk';
        const recipeTitle = recipe.title?.trim() || 'oppskriften din';
        const commentExcerpt = truncateText(commentData.text ?? '', 120);
        const body = commentExcerpt
            ? `${actorName} kommenterte: "${commentExcerpt}"`
            : `${actorName} la igjen en kommentar på "${recipeTitle}".`;
        const shortBody = commentExcerpt
            ? commentExcerpt
            : `La igjen en kommentar på "${recipeTitle}".`;

        await createAndSendNotification({
            recipientId,
            actorId,
            actorName,
            actorPhotoURL: actorProfile.photoURL ?? '',
            type: 'comment',
            title: 'Ny kommentar på oppskriften din',
            body,
            shortBody,
            link: `/recipe/${recipeId}`,
            recipeId,
            recipeTitle,
            commentText: commentData.text ?? '',
        });
    }
);

/**
 * An invitation to co-author a recipe is left in the invited cook's inbox by
 * the app of the cook inviting, which cannot send a push from there. This
 * sees it arrive, makes the alert say who it is from and what it is about
 * from what is stored rather than from what the app wrote, and sends it.
 *
 * Written rather than created, so that inviting again after an answer, which
 * rewrites the same invitation as pending, is told as well.
 */
export const notifyOnCoAuthorInvite = onDocumentWritten(
    'users/{userId}/notifications/{notificationId}',
    async (event) => {
        const after = event.data?.after.data() as
            | {
                  type?: string;
                  actorId?: string;
                  recipeId?: string;
                  coAuthorInviteStatus?: string;
              }
            | undefined;
        const before = event.data?.before.data() as
            | { coAuthorInviteStatus?: string }
            | undefined;

        if (
            after?.type !== 'coauthor_invite' ||
            after.coAuthorInviteStatus !== 'pending'
        ) {
            return;
        }

        // Rewriting the text below writes the invitation again; that is not
        // a new invitation.
        if (before && before.coAuthorInviteStatus === 'pending') return;

        const recipientId = event.params.userId;
        const actorId = after.actorId ?? '';
        const recipeId = after.recipeId ?? '';

        if (!actorId || !recipeId || actorId === recipientId) return;

        const [recipeSnap, actorProfile] = await Promise.all([
            db.collection('recipes').doc(recipeId).get(),
            fetchPublicUser(actorId),
        ]);

        // Only the recipe's own cook can invite to it.
        if (!recipeSnap.exists) return;
        const recipe = recipeSnap.data() as RecipeDoc;
        if (recipe.userId !== actorId) return;

        const actorName = actorProfile.name?.trim() || 'En kokk';
        const recipeTitle = recipe.title?.trim() || 'oppskriften';
        const title = `${actorName} inviterte deg som medforfatter`;
        const body = `Vil du stå som medforfatter på "${recipeTitle}"?`;

        // The app wrote the cook's name from their sign-in, which for an
        // account made with an e-mail address has none; what is stored on
        // their profile is the truth.
        await event.data!.after.ref.set(
            {
                actorName,
                actorPhotoURL: actorProfile.photoURL ?? '',
                recipeTitle,
                title,
                body,
            },
            { merge: true }
        );

        await sendPushNotification(recipientId, {
            type: 'coauthor_invite',
            title,
            body,
            shortBody: `Inviterte deg som medforfatter på "${recipeTitle}"`,
            link: `/recipe/${recipeId}`,
            actorId,
            actorName,
            actorPhotoURL: actorProfile.photoURL ?? '',
            notificationId: event.params.notificationId,
        });
    }
);

export const notifyFollowersOnNewRecipe = onDocumentCreated(
    'recipes/{recipeId}',
    async (event) => {
        const recipeId = event.params.recipeId;
        const recipe = event.data?.data() as RecipeDoc | undefined;

        if (!recipe || !isPublicRecipe(recipe)) return;

        const authorId = recipe.userId ?? '';
        if (!authorId) return;

        const [followersSnap, actorProfile] = await Promise.all([
            db.collection('users')
                .where('following', 'array-contains', authorId)
                .get(),
            fetchPublicUser(authorId),
        ]);

        if (followersSnap.empty) return;

        const actorName = actorProfile.name?.trim() || 'En kokk du folger';
        const recipeTitle = recipe.title?.trim() || 'en ny oppskrift';

        await Promise.all(
            followersSnap.docs.map(async (followerDoc) => {
                if (followerDoc.id === authorId) return;

                await createAndSendNotification({
                    recipientId: followerDoc.id,
                    actorId: authorId,
                    actorName,
                    actorPhotoURL: actorProfile.photoURL ?? '',
                    type: 'new_recipe',
                    title: `Ny oppskrift fra ${actorName}`,
                    body: `${actorName} delte "${recipeTitle}".`,
                    shortBody: `Delte "${recipeTitle}"`,
                    link: `/recipe/${recipeId}`,
                    recipeId,
                    recipeTitle,
                });
            })
        );
    }
);

export const refreshPopularityScheduled = onSchedule(
    'every 15 minutes',
    async () => {
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const cutoff = admin.firestore.Timestamp.fromMillis(now - sevenDaysMs);

        const snap = await db
            .collection('recipes')
            .where('createdAt', '>=', cutoff)
            .orderBy('createdAt', 'desc')
            .limit(500)
            .get();

        const batch = db.batch();
        snap.docs.forEach((recipeDoc) => {
            const data = recipeDoc.data() as RecipeDoc;
            const score = computePopularityScore({
                likeCount: data.likeCount,
                commentCount: data.commentCount,
                createdAt: data.createdAt,
                nowMs: now,
            });

            batch.set(
                recipeDoc.ref,
                {
                    popularityScore: score,
                    popularityUpdatedAt:
                        admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        });

        await batch.commit();
    }
);

export const refreshDerivedFeedScheduled = onSchedule(
    'every 15 minutes',
    async () => {
        await recomputeTopActiveCreatorsDoc();
    }
);

export const backfillPopularity = onRequest(async (req, res) => {
    if (req.query.key !== BACKFILL_KEY) {
        res.status(403).send('Forbidden');
        return;
    }

    const now = Date.now();
    const pageSize = 400;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let updated = 0;

    while (true) {
        let recipeQuery = db
            .collection('recipes')
            .orderBy('createdAt', 'desc')
            .limit(pageSize);
        if (lastDoc) {
            recipeQuery = recipeQuery.startAfter(lastDoc);
        }

        const snap = await recipeQuery.get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach((recipeDoc) => {
            const data = recipeDoc.data() as RecipeDoc;
            const score = computePopularityScore({
                likeCount: data.likeCount,
                commentCount: data.commentCount,
                createdAt: data.createdAt,
                nowMs: now,
            });

            batch.set(
                recipeDoc.ref,
                {
                    popularityScore: score,
                    popularityUpdatedAt:
                        admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            updated += 1;
        });

        await batch.commit();
        lastDoc = snap.docs[snap.docs.length - 1];
    }

    res.status(200).json({ ok: true, updated });
});

export const backfillDerivedData = onRequest(async (req, res) => {
    if (req.query.key !== BACKFILL_KEY) {
        res.status(403).send('Forbidden');
        return;
    }

    await Promise.all([
        rebuildFollowerCounts(),
        rebuildPublicPopularRecipesMirror(),
        recomputeTopActiveCreatorsDoc(),
    ]);

    res.status(200).json({ ok: true });
});

/* -------------------------------------------------------------------------
 * Cook directory ranking
 *
 * Kokker lists public profiles in `directoryRank` order, straight from a
 * Firestore query, so the order holds no matter how many cooks there are.
 * These triggers keep the rank and the recipe count behind it current.
 * ---------------------------------------------------------------------- */

/**
 * A background photo and a profile photo are each worth more than any
 * realistic number of recipes, so a fuller profile always ranks first and
 * recipe count decides between cooks at the same level. Keep in step with
 * scripts/backfillDirectoryRank.mjs.
 */
const DIRECTORY_PROFILE_WEIGHT = 1_000_000;

type DirectoryFields = {
    photoURL?: string;
    backgroundPhotoURL?: string;
    recipeCount?: number;
    directoryRank?: number;
};

function computeDirectoryRank(data: DirectoryFields) {
    const completeness =
        (data.backgroundPhotoURL ? 1 : 0) + (data.photoURL ? 1 : 0);
    const recipes = Math.min(
        Math.max(data.recipeCount ?? 0, 0),
        DIRECTORY_PROFILE_WEIGHT - 1
    );

    return completeness * DIRECTORY_PROFILE_WEIGHT + recipes;
}

/**
 * Recipes other cooks can see. Private ones are subtracted rather than public
 * ones counted, because recipes from before the visibility field have none
 * and both apps treat them as public.
 */
async function countVisibleRecipes(uid: string) {
    const owned = db.collection('recipes').where('userId', '==', uid);
    const [all, hidden] = await Promise.all([
        owned.count().get(),
        owned.where('visibility', '==', 'private').count().get(),
    ]);

    return all.data().count - hidden.data().count;
}

/**
 * Recounts a cook's recipes and rewrites their rank. Recounting instead of
 * incrementing stays correct when Firestore delivers an event twice. The
 * profile is read inside a transaction, so a photo change landing at the same
 * moment is ranked from its new value rather than overwritten with the old.
 */
async function refreshDirectoryEntry(uid: string) {
    const recipeCount = await countVisibleRecipes(uid);
    const ref = db.collection('publicUsers').doc(uid);

    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);

        // No public profile yet. Creating one here would list a nameless
        // cook; the apps create it on sign-in, and that write ranks it.
        if (!snap.exists) return;

        const data = snap.data() as DirectoryFields;
        const directoryRank = computeDirectoryRank({ ...data, recipeCount });

        if (
            data.recipeCount === recipeCount &&
            data.directoryRank === directoryRank
        ) {
            return;
        }

        transaction.set(ref, { recipeCount, directoryRank }, { merge: true });
    });
}

export const syncDirectoryRankOnRecipeWrite = onDocumentWritten(
    'recipes/{recipeId}',
    async (event) => {
        const before = event.data?.before.exists
            ? (event.data.before.data() as RecipeDoc)
            : null;
        const after = event.data?.after.exists
            ? (event.data.after.data() as RecipeDoc)
            : null;

        // Likes, comments and popularity writes land here constantly. Only a
        // new or deleted recipe, a new owner, or a visibility change can move
        // anyone's count.
        if (
            before &&
            after &&
            before.userId === after.userId &&
            (before.visibility === 'private') ===
                (after.visibility === 'private')
        ) {
            return;
        }

        const owners = new Set<string>();
        if (before?.userId) owners.add(before.userId);
        if (after?.userId) owners.add(after.userId);

        await Promise.all([...owners].map(refreshDirectoryEntry));
    }
);

export const syncDirectoryRankOnPublicUserWrite = onDocumentWritten(
    'publicUsers/{uid}',
    async (event) => {
        const after = event.data?.after;
        if (!after?.exists) return;

        const data = after.data() as DirectoryFields;

        // A cook listed for the first time has never been counted.
        if (typeof data.recipeCount !== 'number') {
            await refreshDirectoryEntry(event.params.uid);
            return;
        }

        // Otherwise only a photo change can move the rank. Its own write
        // comes back through here, finds the rank current, and stops.
        if (data.directoryRank === computeDirectoryRank(data)) return;

        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(after.ref);
            if (!snap.exists) return;

            const current = snap.data() as DirectoryFields;
            const directoryRank = computeDirectoryRank(current);
            if (current.directoryRank === directoryRank) return;

            transaction.set(after.ref, { directoryRank }, { merge: true });
        });
    }
);

/**
 * Everything a cook leaves behind, cleared out when their account goes.
 *
 * Deleting an account removes the sign-in and nothing else, so without this
 * their profile stays in the cook directory and their comments keep their
 * name. Closing an account from inside the app does its own tidying up;
 * this catches the deletions that happen anywhere else, the console
 * included.
 */
async function purgeCook(uid: string) {
    const gone: admin.firestore.DocumentReference[] = [];

    // Their own recipes, with everything hanging off them.
    const own = await db.collection('recipes').where('userId', '==', uid).get();
    const ownIds = new Set(own.docs.map((doc) => doc.id));

    for (const recipe of own.docs) {
        const [likes, comments, ratings, saved] = await Promise.all([
            recipe.ref.collection('likes').get(),
            recipe.ref.collection('comments').get(),
            recipe.ref.collection('ratings').get(),
            db
                .collectionGroup('recipes')
                .where('recipeRef', '==', recipe.ref)
                .get(),
        ]);

        for (const snap of [likes, comments, ratings, saved]) {
            snap.docs.forEach((doc) => gone.push(doc.ref));
        }

        gone.push(recipe.ref);
        gone.push(db.collection('publicPopularRecipes').doc(recipe.id));
    }

    // What they left on other cooks' recipes, and the counts to mend.
    const deltas = new Map<string, Record<string, number>>();

    const note = (recipeId: string | undefined, field: string, by: number) => {
        if (!recipeId || ownIds.has(recipeId)) return;

        const current = deltas.get(recipeId) ?? {};
        current[field] = (current[field] ?? 0) + by;
        deltas.set(recipeId, current);
    };

    const [likes, comments] = await Promise.all([
        db.collectionGroup('likes').where('userId', '==', uid).get(),
        db.collectionGroup('comments').where('userId', '==', uid).get(),
    ]);

    likes.docs.forEach((doc) => {
        gone.push(doc.ref);
        note(doc.ref.parent.parent?.id, 'likeCount', -1);
    });

    comments.docs.forEach((doc) => {
        gone.push(doc.ref);
        note(doc.ref.parent.parent?.id, 'commentCount', -1);
    });

    // A rating is written under the cook's own id, so it is looked up rather
    // than searched for.
    const rated = await db.collection('recipes').get();

    for (const recipe of rated.docs) {
        if (ownIds.has(recipe.id)) continue;

        const rating = await recipe.ref.collection('ratings').doc(uid).get();
        if (!rating.exists) continue;

        gone.push(rating.ref);
        note(recipe.id, 'ratingCount', -1);
        note(recipe.id, 'ratingSum', -Number(rating.data()?.value ?? 0));
    }

    // Their cookbooks, and what was saved into them.
    const books = await db
        .collection('users')
        .doc(uid)
        .collection('collections')
        .get();

    for (const book of books.docs) {
        const saved = await db
            .collection('collectionsRecipes')
            .doc(book.id)
            .collection('recipes')
            .get();

        saved.docs.forEach((doc) => gone.push(doc.ref));
        gone.push(book.ref);
    }

    const [notifications, tokens] = await Promise.all([
        db.collection('users').doc(uid).collection('notifications').get(),
        db.collection('notificationTokens').where('userId', '==', uid).get(),
    ]);

    notifications.docs.forEach((doc) => gone.push(doc.ref));
    tokens.docs.forEach((doc) => gone.push(doc.ref));

    // Their place in everyone else's lists.
    const [followers, incoming, outgoing] = await Promise.all([
        db.collection('users').where('following', 'array-contains', uid).get(),
        db
            .collection('users')
            .where('incomingFollowRequests', 'array-contains', uid)
            .get(),
        db
            .collection('users')
            .where('outgoingFollowRequests', 'array-contains', uid)
            .get(),
    ]);

    for (const doc of followers.docs) {
        await doc.ref.update({
            following: admin.firestore.FieldValue.arrayRemove(uid),
            followingCount: admin.firestore.FieldValue.increment(-1),
        });
    }

    for (const doc of incoming.docs) {
        await doc.ref.update({
            incomingFollowRequests:
                admin.firestore.FieldValue.arrayRemove(uid),
        });
    }

    for (const doc of outgoing.docs) {
        await doc.ref.update({
            outgoingFollowRequests:
                admin.firestore.FieldValue.arrayRemove(uid),
        });
    }

    for (const [recipeId, fields] of deltas) {
        const update: Record<string, admin.firestore.FieldValue> = {};

        for (const [field, by] of Object.entries(fields)) {
            update[field] = admin.firestore.FieldValue.increment(by);
        }

        await db
            .collection('recipes')
            .doc(recipeId)
            .update(update)
            .catch(() => undefined);
    }

    gone.push(db.collection('publicUsers').doc(uid));
    gone.push(db.collection('users').doc(uid));

    for (let index = 0; index < gone.length; index += 400) {
        const batch = db.batch();
        gone.slice(index, index + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
    }

    console.log(`Purged ${gone.length} documents for ${uid}.`);
}

export const purgeCookOnAccountDeleted = functionsV1
    .auth.user()
    .onDelete(async (user) => {
        await purgeCook(user.uid);
    });
