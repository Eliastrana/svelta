import * as admin from 'firebase-admin';
import {
    onDocumentCreated,
    onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/https';

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

type NotificationType = 'like' | 'comment' | 'new_recipe';

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
    payload: Pick<NotificationPayload, 'title' | 'body' | 'link' | 'type'>
) {
    const tokensSnap = await db
        .collection('notificationTokens')
        .where('userId', '==', recipientId)
        .get();

    const tokens = tokensSnap.docs
        .map((tokenDoc) => tokenDoc.id)
        .filter((token) => typeof token === 'string' && token.length > 0);

    if (tokens.length === 0) return;

    const iconPath = '/favicon/web-app-manifest-192x192.png';
    const badgePath = '/favicon/favicon-96x96.png';
    const tag = `svelta-${payload.type}`;

    const response = await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
            title: payload.title,
            body: payload.body,
            link: payload.link,
            type: payload.type,
            icon: iconPath,
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
                    .doc(tokens[index])
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

async function createAndSendNotification(payload: NotificationPayload) {
    const notificationId = await createNotification(payload);
    if (!notificationId) return;

    await sendPushNotification(payload.recipientId, payload);
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

        await createAndSendNotification({
            recipientId,
            actorId,
            actorName,
            actorPhotoURL: actorProfile.photoURL ?? '',
            type: 'comment',
            title: 'Ny kommentar på oppskriften din',
            body,
            link: `/recipe/${recipeId}`,
            recipeId,
            recipeTitle,
            commentText: commentData.text ?? '',
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
