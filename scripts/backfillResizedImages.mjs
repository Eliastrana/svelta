/**
 * Backfills resized image variants for images uploaded before the
 * storage-resize-images extension was installed.
 *
 * The extension only reacts to the Storage finalize event, which a
 * metadata-only update does not fire. So each object is rewritten in place by
 * copying it onto itself. That creates a new generation, fires finalize, and
 * the extension produces the variants.
 *
 * The critical detail is the download token. Both apps store full download
 * URLs in Firestore, and those URLs carry a token that lives in the object's
 * custom metadata. A copy that drops it mints a new one and every stored URL
 * breaks. This script reads the metadata first and writes it back explicitly.
 *
 * Usage:
 *   node scripts/backfillResizedImages.mjs                 # dry run, no writes
 *   node scripts/backfillResizedImages.mjs --file <path>   # one object only
 *   node scripts/backfillResizedImages.mjs --apply         # the whole bucket
 *   node scripts/backfillResizedImages.mjs --apply --limit 50
 */

import {
    getApps,
    initializeApp,
    applicationDefault,
    cert,
} from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const BUCKET = 'cooked-df6a0.firebasestorage.app';

/** Every folder either app uploads images to. */
const PREFIXES = [
    'recipe-covers/',
    'recipe-steps/',
    'profile-pictures/',
    'profile-backgrounds/',
    'collection-covers/',
];

/** Sizes configured on the extension, used to spot existing variants. */
const VARIANT_SUFFIXES = ['_200x200', '_800x800'];

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
            storageBucket: BUCKET,
        });
    }

    return initializeApp({
        credential: applicationDefault(),
        storageBucket: BUCKET,
    });
}

function parseArgs(argv) {
    const args = argv.slice(2);
    const get = (flag) => {
        const i = args.indexOf(flag);
        return i === -1 ? undefined : args[i + 1];
    };
    return {
        apply: args.includes('--apply'),
        file: get('--file'),
        limit: Number(get('--limit')) || Infinity,
    };
}

const isImage = (name) => /\.(jpe?g|png|webp|gif|tiff?|avif)$/i.test(name);

/** A file the extension itself produced. */
const isVariant = (name) =>
    VARIANT_SUFFIXES.some((suffix) => name.includes(suffix));

function variantNames(name) {
    const dot = name.lastIndexOf('.');
    const base = name.slice(0, dot);
    const ext = name.slice(dot);
    return VARIANT_SUFFIXES.map((suffix) => `${base}${suffix}${ext}`);
}

/**
 * Rewrites the object in place so the extension's finalize trigger fires.
 *
 * Uses download + save rather than copy. A copy onto the same path strips the
 * custom metadata that holds `firebaseStorageDownloadTokens`, which would
 * invalidate every URL stored in Firestore for that image. Writing the bytes
 * back with the metadata supplied explicitly keeps the token, so stored URLs
 * and the variants the extension derives from them all stay valid.
 */
async function retrigger(file) {
    const [meta] = await file.getMetadata();
    const token = meta.metadata?.firebaseStorageDownloadTokens;

    if (!token) {
        console.warn(`  ! ${file.name} has no download token, skipping`);
        return false;
    }

    const [buffer] = await file.download();

    await file.save(buffer, {
        resumable: false,
        contentType: meta.contentType,
        metadata: {
            contentType: meta.contentType,
            cacheControl: meta.cacheControl,
            contentDisposition: meta.contentDisposition,
            contentEncoding: meta.contentEncoding,
            contentLanguage: meta.contentLanguage,
            metadata: meta.metadata,
        },
    });

    const [after] = await file.getMetadata();

    if (after.metadata?.firebaseStorageDownloadTokens !== token) {
        throw new Error(
            `Download token changed for ${file.name}. Stored URLs for this ` +
                `image are now broken. Stopping before touching anything else.`
        );
    }

    return true;
}

async function main() {
    const { apply, file: single, limit } = parseArgs(process.argv);

    const bucket = getStorage(getAdminApp()).bucket(BUCKET);

    let candidates = [];

    if (single) {
        candidates = [bucket.file(single)];
    } else {
        for (const prefix of PREFIXES) {
            const [files] = await bucket.getFiles({ prefix });
            candidates.push(...files);
        }
    }

    const existing = new Set(candidates.map((f) => f.name));

    const todo = candidates.filter((f) => {
        if (!isImage(f.name)) return false;
        if (isVariant(f.name)) return false;
        if (single) return true;
        // Already done if every variant is present.
        return !variantNames(f.name).every((v) => existing.has(v));
    });

    console.log(
        `${candidates.length} objects scanned, ${todo.length} need variants`
    );

    if (!apply) {
        console.log('\nDry run. Nothing written. Re-run with --apply.\n');
        todo.slice(0, 20).forEach((f) => console.log(`  would rewrite ${f.name}`));
        if (todo.length > 20) console.log(`  ... and ${todo.length - 20} more`);
        return;
    }

    let done = 0;
    let failed = 0;

    for (const f of todo.slice(0, limit)) {
        try {
            const ok = await retrigger(f);
            if (!ok) continue;
            done += 1;
            console.log(`  rewrote ${f.name} (${done}/${Math.min(todo.length, limit)})`);
        } catch (error) {
            failed += 1;
            console.error(`  FAILED ${f.name}: ${error.message}`);
            // A token change is unrecoverable and affects stored URLs, so stop.
            if (String(error.message).includes('Download token changed')) throw error;
        }
    }

    console.log(`\nRewrote ${done}, failed ${failed}.`);
    console.log('The extension generates variants asynchronously; give it a');
    console.log('few minutes, then re-run without --apply to confirm.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
