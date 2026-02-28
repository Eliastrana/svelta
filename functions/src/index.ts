import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from 'firebase-functions/https';

admin.initializeApp();
const db = admin.firestore();

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
    const c = args.createdAt;

    if (c instanceof admin.firestore.Timestamp) createdMs = c.toMillis();
    else if (c instanceof Date) createdMs = c.getTime();
    else if (typeof c === "number") createdMs = c;
    else createdMs = 0;

    const ageHours = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60));
    return (likeCount + commentCount * 2) / (ageHours + 2);
}

// 1) Recompute whenever recipe doc is written (e.g. your app updates likeCount/commentCount)
export const recomputePopularityOnWrite = onDocumentWritten(
    "recipes/{recipeId}",
    async (event) => {
        const after = event.data?.after;
        if (!after?.exists) return;

        const data = after.data() as any;

        const score = computePopularityScore({
            likeCount: data.likeCount,
            commentCount: data.commentCount,
            createdAt: data.createdAt,
        });

        // Avoid endless loops: only write if score meaningfully changed
        const prev = typeof data.popularityScore === "number" ? data.popularityScore : null;
        if (prev !== null && Math.abs(prev - score) < 0.0001) return;

        await after.ref.set(
            {
                popularityScore: score,
                popularityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
);

// 2) Scheduled refresh so scores decay with time (update RECENT posts only)
export const refreshPopularityScheduled = onSchedule("every 15 minutes", async () => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = admin.firestore.Timestamp.fromMillis(now - sevenDaysMs);

    const snap = await db
        .collection("recipes")
        .where("createdAt", ">=", cutoff)
        .orderBy("createdAt", "desc")
        .limit(500) // batch size
        .get();

    const batch = db.batch();

    snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const score = computePopularityScore({
            likeCount: data.likeCount,
            commentCount: data.commentCount,
            createdAt: data.createdAt,
            nowMs: now,
        });

        batch.set(
            doc.ref,
            {
                popularityScore: score,
                popularityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    });

    await batch.commit();
});

export const backfillPopularity = onRequest(async (req, res) => {
    // ✅ simple protection (optional but recommended)
    // Call with: https://.../backfillPopularity?key=YOUR_KEY
    const key = req.query.key;
    if (key !== 'CHANGE_ME') {
        res.status(403).send('Forbidden');
        return;
    }

    const now = Date.now();
    const pageSize = 400; // <= 500 (Firestore batch limit)

    let lastDoc: any = null;
    let updated = 0;

    while (true) {
        let qRef = db.collection('recipes').orderBy('createdAt', 'desc').limit(pageSize);
        if (lastDoc) qRef = qRef.startAfter(lastDoc);

        const snap = await qRef.get();
        if (snap.empty) break;

        const batch = db.batch();

        for (const doc of snap.docs) {
            const data = doc.data() as any;

            const score = computePopularityScore({
                likeCount: data.likeCount,
                commentCount: data.commentCount,
                createdAt: data.createdAt,
                nowMs: now,
            });

            batch.set(
                doc.ref,
                {
                    popularityScore: score,
                    popularityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            updated += 1;
        }

        await batch.commit();
        lastDoc = snap.docs[snap.docs.length - 1];
    }

    res.status(200).json({ ok: true, updated });
});