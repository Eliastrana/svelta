import { getFirestore, collection, query, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { Recipe } from '@/app/types/Recipe';
import { normalizeRecipeVisibility } from '@/helpers/recipeVisibility';

function toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();

    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? new Date(0) : d;
    }

    // Fallback (ukjent type)
    return new Date(0);
}

export async function fetchPopularRecipes(top = 50): Promise<Recipe[]> {
    const db = getFirestore();

    const scanLimit = Math.max(top, 100);

    const q = query(
        collection(db, 'recipes'),
        orderBy('createdAt', 'desc'),
        limit(scanLimit),
    );

    const snap = await getDocs(q);

    const recipes: Recipe[] = snap.docs.map((d) => {
        const data = d.data() as Omit<Recipe, 'id'>;
        return { id: d.id, ...data };
    }).filter((recipe) => normalizeRecipeVisibility(recipe.visibility) === 'public');

    const scored = recipes.map((r) => {
        const likeCount = r.likeCount ?? 0;
        const commentCount = r.commentCount ?? 0;

        const createdAtDate = toDate(r.createdAt);
        const ageInHours = (Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60);

        const popularityScore = (likeCount + commentCount * 2) / (ageInHours + 2);

        return { ...r, popularityScore };
    });

    return scored
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, top);
}
