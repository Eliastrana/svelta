import { getFirestore, collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';

export async function fetchPopularRecipes(top = 50): Promise<Recipe[]> {
    const db = getFirestore();

    // You can tune this; no more expensive per-doc count calls now
    const scanLimit = Math.max(top, 100);

    const q = query(
        collection(db, 'recipes'),
        orderBy('createdAt', 'desc'),
        limit(scanLimit),
    );

    const snap = await getDocs(q);

    const recipes = snap.docs.map((d) => {
        const data = d.data() as Omit<Recipe, 'id'>;
        return { id: d.id, ...data } as Recipe;
    });

    // popularity score from stored counts
    const scored = recipes.map((r) => {
        const likeCount = r.likeCount ?? 0;
        const commentCount = r.commentCount ?? 0;

        const createdAtDate =
            (r.createdAt as any)?.toDate ? (r.createdAt as any).toDate() : new Date(r.createdAt as any);
        const ageInHours = (Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60);

        const popularityScore = (likeCount + commentCount * 2) / (ageInHours + 2);

        return { ...r, popularityScore };
    });

    return scored
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, top);
}
