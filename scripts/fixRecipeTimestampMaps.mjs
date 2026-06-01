import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';

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
                privateKey: String(parsed.private_key || '').replace(/\\n/g, '\n'),
            }),
        });
    }

    return initializeApp({
        credential: applicationDefault(),
    });
}

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    return {
        dryRun: args.has('--dry-run'),
    };
}

function isTimestampMap(value) {
    if (!value || typeof value !== 'object') return false;
    if (value instanceof Timestamp) return false;
    const seconds = value.seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds;
    return Number.isInteger(seconds) && Number.isInteger(nanoseconds);
}

function toTimestamp(value) {
    return Timestamp.fromMillis((value.seconds * 1000) + Math.floor((value.nanoseconds ?? value._nanoseconds) / 1_000_000));
}

async function main() {
    const { dryRun } = parseArgs(process.argv);
    const db = getFirestore(getAdminApp());
    const recipesSnap = await db.collection('recipes').orderBy(FieldPath.documentId()).get();

    if (recipesSnap.empty) {
        console.log('No recipes found.');
        return;
    }

    console.log(`Found ${recipesSnap.size} recipes.`);
    console.log(dryRun ? 'Running in dry-run mode. No writes will be made.' : 'Repairing malformed timestamp maps...');

    let batch = db.batch();
    let opCount = 0;
    let fixed = 0;

    const flush = async () => {
        if (dryRun || opCount === 0) return;
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    };

    for (const recipeDoc of recipesSnap.docs) {
        const data = recipeDoc.data();
        const payload = {};

        if (isTimestampMap(data.createdAt)) {
            payload.createdAt = toTimestamp(data.createdAt);
        }

        if (isTimestampMap(data.updatedAt)) {
            payload.updatedAt = toTimestamp(data.updatedAt);
        }

        if (!Object.keys(payload).length) continue;

        if (dryRun) {
            console.log(`[dry-run] ${recipeDoc.id}`, payload);
        } else {
            batch.update(recipeDoc.ref, payload);
            opCount += 1;
            if (opCount >= 400) await flush();
        }

        fixed += 1;
    }

    await flush();
    console.log(`Done. ${dryRun ? 'Would repair' : 'Repaired'} ${fixed} recipe documents.`);
}

main().catch((error) => {
    console.error('Repair failed:', error);
    process.exitCode = 1;
});
