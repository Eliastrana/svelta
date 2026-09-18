import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * One-off: gives every existing public profile the `recipeCount` and
 * `directoryRank` the Cloud Functions maintain from here on. Ordered queries
 * skip documents missing the field, so this has to run before the apps sort
 * Kokker by rank.
 *
 *   node --env-file=.env.local scripts/backfillDirectoryRank.mjs --dry-run
 *   node --env-file=.env.local scripts/backfillDirectoryRank.mjs
 */

/** Keep in step with DIRECTORY_PROFILE_WEIGHT in functions/src/index.ts. */
const DIRECTORY_PROFILE_WEIGHT = 1_000_000;

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

function computeDirectoryRank(data) {
    const completeness =
        (data.backgroundPhotoURL ? 1 : 0) + (data.photoURL ? 1 : 0);
    const recipes = Math.min(
        Math.max(data.recipeCount ?? 0, 0),
        DIRECTORY_PROFILE_WEIGHT - 1
    );

    return completeness * DIRECTORY_PROFILE_WEIGHT + recipes;
}

async function countVisibleRecipes(db, uid) {
    const owned = db.collection('recipes').where('userId', '==', uid);
    const [all, hidden] = await Promise.all([
        owned.count().get(),
        owned.where('visibility', '==', 'private').count().get(),
    ]);

    return all.data().count - hidden.data().count;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const db = getFirestore(getAdminApp());

    const profiles = await db.collection('publicUsers').get();
    console.log(
        `Found ${profiles.size} public profiles.${dryRun ? ' Dry run: no writes.' : ''}`
    );

    const rows = [];
    for (const profile of profiles.docs) {
        const data = profile.data();
        const recipeCount = await countVisibleRecipes(db, profile.id);
        const directoryRank = computeDirectoryRank({ ...data, recipeCount });
        rows.push({ ref: profile.ref, name: data.name, recipeCount, directoryRank });
    }

    rows.sort((a, b) => b.directoryRank - a.directoryRank);

    for (const row of rows) {
        console.log(
            `${String(row.directoryRank).padStart(8)}  ${String(row.recipeCount).padStart(3)} recipes  ${row.name ?? '(no name)'}`
        );
    }

    if (dryRun) return;

    const batch = db.batch();
    for (const row of rows) {
        batch.set(
            row.ref,
            { recipeCount: row.recipeCount, directoryRank: row.directoryRank },
            { merge: true }
        );
    }
    await batch.commit();

    console.log(`Wrote rank to ${rows.length} profiles.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
