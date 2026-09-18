import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * One-off: gives every public recipe already in the feed mirror the
 * `searchTerms` the Cloud Functions write from here on. Search asks for whole
 * array entries, so a recipe without this field can never be found.
 *
 *   node --env-file=.env.local scripts/backfillRecipeSearchTerms.mjs --dry-run
 *   node --env-file=.env.local scripts/backfillRecipeSearchTerms.mjs
 */

/** Keep in step with the search constants in functions/src/index.ts. */
const SEARCH_MIN_PREFIX = 2;
const SEARCH_MAX_PREFIX = 12;
const SEARCH_MAX_TERMS = 400;

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

function buildSearchTerms(data) {
    const source = [data.title ?? '', ...(data.tags ?? [])].join(' ');

    const words = source
        .toLowerCase()
        .normalize('NFC')
        .split(/[^\p{Letter}\p{Number}]+/u)
        .filter((word) => word.length >= SEARCH_MIN_PREFIX);

    const terms = new Set();

    for (const word of words) {
        const end = Math.min(word.length, SEARCH_MAX_PREFIX);

        for (let length = SEARCH_MIN_PREFIX; length <= end; length += 1) {
            terms.add(word.slice(0, length));

            if (terms.size >= SEARCH_MAX_TERMS) return [...terms];
        }
    }

    return [...terms];
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    getAdminApp();
    const db = getFirestore();

    const snap = await db.collection('publicPopularRecipes').get();

    let written = 0;
    let batch = db.batch();
    let queued = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const searchTerms = buildSearchTerms(data);

        console.log(
            `${doc.id}: ${data.title ?? '(uten tittel)'} → ${searchTerms.length} terms`
        );

        if (dryRun) continue;

        batch.set(doc.ref, { searchTerms }, { merge: true });
        written += 1;
        queued += 1;

        // Firestore takes 500 writes per batch.
        if (queued === 400) {
            await batch.commit();
            batch = db.batch();
            queued = 0;
        }
    }

    if (!dryRun && queued > 0) await batch.commit();

    console.log(
        dryRun
            ? `Dry run: ${snap.size} recipes would be indexed.`
            : `Indexed ${written} recipes.`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
