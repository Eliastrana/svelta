import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Clears out cooks whose sign-in has been deleted.
 *
 * Deleting an account in the Firebase console removes the sign-in and
 * nothing else, so the cook keeps their public profile and goes on showing
 * up under Kokker. This finds every user document with no account behind it
 * any more and removes what they left: their profile, their recipes, the
 * likes, comments and ratings they gave elsewhere, their cookbooks, and
 * their place in anyone else's following list.
 *
 *   node --env-file=.env.local scripts/purgeDeletedUsers.mjs --dry-run
 *   node --env-file=.env.local scripts/purgeDeletedUsers.mjs
 */

function getAdminApp() {
    const apps = getApps();
    if (apps.length) return apps[0];

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (raw) {
        const parsed = JSON.parse(raw);
        return initializeApp({
            credential: cert({
                projectId: parsed.project_id,
                clientEmail: parsed.client_email,
                privateKey: String(parsed.private_key || '').replace(
                    /\\n/g,
                    '\n'
                ),
            }),
        });
    }

    return initializeApp({ credential: applicationDefault() });
}

/** Every uid that still has an account to sign in with. */
async function livingAccounts() {
    const uids = new Set();
    let page = await getAuth().listUsers(1000);

    for (;;) {
        page.users.forEach((user) => uids.add(user.uid));
        if (!page.pageToken) return uids;
        page = await getAuth().listUsers(1000, page.pageToken);
    }
}

async function deleteAll(db, refs, dryRun) {
    if (dryRun || !refs.length) return;

    for (let index = 0; index < refs.length; index += 400) {
        const batch = db.batch();
        refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
    }
}

/** What one cook leaves behind, and the undoing of it. */
async function purge(db, uid, dryRun) {
    const counts = {};
    const toDelete = [];

    // Their own recipes, with everything hanging off them.
    const own = await db.collection('recipes').where('userId', '==', uid).get();

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

        [likes, comments, ratings, saved].forEach((snap) =>
            snap.docs.forEach((doc) => toDelete.push(doc.ref))
        );

        toDelete.push(recipe.ref);
        toDelete.push(db.collection('publicPopularRecipes').doc(recipe.id));
    }

    counts.recipes = own.size;

    // What they left on other cooks' recipes, and the counts to mend.
    const ownIds = new Set(own.docs.map((doc) => doc.id));
    const deltas = new Map();

    const note = (recipeId, field, by) => {
        if (ownIds.has(recipeId)) return;

        const current = deltas.get(recipeId) ?? {};
        current[field] = (current[field] ?? 0) + by;
        deltas.set(recipeId, current);
    };

    const [likes, comments] = await Promise.all([
        db.collectionGroup('likes').where('userId', '==', uid).get(),
        db.collectionGroup('comments').where('userId', '==', uid).get(),
    ]);

    likes.docs.forEach((doc) => {
        toDelete.push(doc.ref);
        note(doc.ref.parent.parent?.id, 'likeCount', -1);
    });

    comments.docs.forEach((doc) => {
        toDelete.push(doc.ref);
        note(doc.ref.parent.parent?.id, 'commentCount', -1);
    });

    counts.likes = likes.size;
    counts.comments = comments.size;

    // Ratings are keyed by the cook's own id, so they are looked up directly.
    const others = await db.collection('recipes').get();
    let ratings = 0;

    for (const recipe of others.docs) {
        if (ownIds.has(recipe.id)) continue;

        const rating = await recipe.ref.collection('ratings').doc(uid).get();
        if (!rating.exists) continue;

        ratings += 1;
        toDelete.push(rating.ref);
        note(recipe.id, 'ratingCount', -1);
        note(recipe.id, 'ratingSum', -Number(rating.data().value ?? 0));
    }

    counts.ratings = ratings;

    // Their cookbooks, and what was saved into them.
    const books = await db.collection('users').doc(uid).collection('collections').get();

    for (const book of books.docs) {
        const saved = await db
            .collection('collectionsRecipes')
            .doc(book.id)
            .collection('recipes')
            .get();

        saved.docs.forEach((doc) => toDelete.push(doc.ref));
        toDelete.push(book.ref);
    }

    counts.cookbooks = books.size;

    const notifications = await db
        .collection('users')
        .doc(uid)
        .collection('notifications')
        .get();

    notifications.docs.forEach((doc) => toDelete.push(doc.ref));
    counts.notifications = notifications.size;

    const tokens = await db
        .collection('notificationTokens')
        .where('userId', '==', uid)
        .get();

    tokens.docs.forEach((doc) => toDelete.push(doc.ref));
    counts.tokens = tokens.size;

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

    counts.followers = followers.size;

    if (!dryRun) {
        for (const doc of followers.docs) {
            await doc.ref.update({
                following: FieldValue.arrayRemove(uid),
                followingCount: FieldValue.increment(-1),
            });
        }

        for (const doc of incoming.docs) {
            await doc.ref.update({
                incomingFollowRequests: FieldValue.arrayRemove(uid),
            });
        }

        for (const doc of outgoing.docs) {
            await doc.ref.update({
                outgoingFollowRequests: FieldValue.arrayRemove(uid),
            });
        }

        for (const [recipeId, fields] of deltas) {
            const update = {};
            for (const [field, by] of Object.entries(fields)) {
                update[field] = FieldValue.increment(by);
            }

            await db
                .collection('recipes')
                .doc(recipeId)
                .update(update)
                .catch(() => undefined);
        }
    }

    toDelete.push(db.collection('publicUsers').doc(uid));
    toDelete.push(db.collection('users').doc(uid));

    await deleteAll(db, toDelete, dryRun);

    return { counts, documents: toDelete.length };
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    getAdminApp();
    const db = getFirestore();

    const living = await livingAccounts();
    const users = await db.collection('users').get();
    const orphans = users.docs.filter((doc) => !living.has(doc.id));

    if (!orphans.length) {
        console.log('Every cook still has an account. Nothing to do.');
        return;
    }

    for (const orphan of orphans) {
        const name = orphan.data().name ?? '(uten navn)';
        const { counts, documents } = await purge(db, orphan.id, dryRun);

        console.log(
            `${name} (${orphan.id})\n  ` +
                Object.entries(counts)
                    .map(([what, many]) => `${what}: ${many}`)
                    .join(', ') +
                `\n  ${documents} documents ${dryRun ? 'would be' : ''} deleted`
        );
    }

    console.log(
        dryRun
            ? `\nDry run: ${orphans.length} cook(s) without an account.`
            : `\nRemoved ${orphans.length} cook(s) without an account.`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
