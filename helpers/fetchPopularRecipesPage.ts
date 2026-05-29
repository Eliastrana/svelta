// helpers/fetchPopularRecipesPage.ts
import {
    getFirestore,
    collection,
    CollectionReference,
    query,
    orderBy,
    getDocs,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
} from "firebase/firestore";
import { Recipe } from "@/app/types/Recipe";
import { normalizeRecipeVisibility } from '@/helpers/recipeVisibility';

export type PopularRecipesPage = {
    items: Recipe[];
    nextCursor: QueryDocumentSnapshot<DocumentData> | null;
};

export async function fetchPopularRecipesPage(params: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<PopularRecipesPage> {
    const db = getFirestore();
    const pageSize = params.pageSize ?? 10;

    const fetchPage = async (collectionName: string, shouldFilterVisibility: boolean) => {
        const collectionRef = collection(db, collectionName) as CollectionReference<DocumentData>;
        const baseQuery = query(
            collectionRef,
            orderBy("popularityScore", "desc"),
            orderBy("createdAt", "desc"),
            limit(pageSize)
        );

        const q = params.cursor ? query(baseQuery, startAfter(params.cursor)) : baseQuery;
        const snap = await getDocs(q);

        const items: Recipe[] = snap.docs
            .map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Recipe, "id">),
            }))
            .filter((recipe) => shouldFilterVisibility ? normalizeRecipeVisibility(recipe.visibility) === 'public' : true);

        return {
            items,
            nextCursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
        };
    };

    try {
        const precomputed = await fetchPage("publicPopularRecipes", false);
        if (precomputed.items.length > 0 || params.cursor) {
            return precomputed;
        }
    } catch {
        // Fall back to querying recipes directly until the precomputed feed exists.
    }

    return fetchPage("recipes", true);
}
