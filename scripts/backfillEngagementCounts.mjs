import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Recounts the likes, comments and ratings stored on each recipe from the
 * documents themselves. The counts are kept by the clients as they like and
 * comment, so a write that never landed leaves the number behind for good.
 *
 *   node --env-file=.env.local scripts/backfillEngagementCounts.mjs --dry-run
 *   node --env-file=.env.local scripts/backfillEngagementCounts.mjs
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

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    getAdminApp();
    const db = getFirestore();

    const recipes = await db.collection('recipes').get();

    let corrected = 0;

    for (const recipe of recipes.docs) {
        const [likes, comments, ratings] = await Promise.all([
            recipe.ref.collection('likes').get(),
            recipe.ref.collection('comments').get(),
            recipe.ref.collection('ratings').get(),
        ]);

        const data = recipe.data();

        const ratingSum = ratings.docs.reduce(
            (total, rating) => total + Number(rating.data().value ?? 0),
            0
        );

        const counts = {
            likeCount: likes.size,
            commentCount: comments.size,
            ratingCount: ratings.size,
            ratingSum,
        };

        const wrong = Object.entries(counts).filter(
            ([field, value]) => (data[field] ?? 0) !== value
        );

        if (!wrong.length) continue;

        corrected += 1;

        console.log(
            `${recipe.id}: ${data.title ?? '(uten tittel)'}\n  ` +
                wrong
                    .map(
                        ([field, value]) =>
                            `${field} ${data[field] ?? 0} → ${value}`
                    )
                    .join(', ')
        );

        if (dryRun) continue;

        await recipe.ref.set(counts, { merge: true });
    }

    console.log(
        dryRun
            ? `Dry run: ${corrected} of ${recipes.size} recipes are out of step.`
            : `Corrected ${corrected} of ${recipes.size} recipes.`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
