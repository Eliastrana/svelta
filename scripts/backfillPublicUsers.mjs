import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

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

function buildPublicUser(data) {
    return {
        name: String(data?.name ?? '').trim(),
        photoURL: String(data?.photoURL ?? '').trim(),
        favoriteFood: String(data?.favoriteFood ?? '').trim(),
    };
}

async function main() {
    const { dryRun } = parseArgs(process.argv);
    const db = getFirestore(getAdminApp());

    const usersSnap = await db
        .collection('users')
        .orderBy(FieldPath.documentId())
        .get();

    if (usersSnap.empty) {
        console.log('No users found.');
        return;
    }

    console.log(`Found ${usersSnap.size} users.`);
    console.log(
        dryRun
            ? 'Running in dry-run mode. No writes will be made.'
            : 'Writing publicUsers documents...'
    );

    let batch = db.batch();
    let opCount = 0;
    let synced = 0;

    const flush = async () => {
        if (dryRun || opCount === 0) return;
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    };

    for (const userDoc of usersSnap.docs) {
        const publicUserRef = db.collection('publicUsers').doc(userDoc.id);
        const payload = buildPublicUser(userDoc.data());

        if (dryRun) {
            console.log(`[dry-run] ${userDoc.id}`, payload);
        } else {
            batch.set(publicUserRef, payload, { merge: true });
            opCount += 1;

            if (opCount >= 400) {
                await flush();
            }
        }

        synced += 1;
    }

    await flush();

    console.log(
        `Done. ${dryRun ? 'Would sync' : 'Synced'} ${synced} publicUsers documents.`
    );
}

main().catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
});
