// helpers/fetchPopularRecipesPage.ts
import {
    getFirestore,
    collection,
    query,
    orderBy,
    getDocs,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
} from "firebase/firestore";
import { Recipe } from "@/app/types/Recipe";

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

    // Primary sort = popularityScore
    // Secondary sort = createdAt for stable ordering / tie-break
    const baseQuery = query(
        collection(db, "recipes"),
        orderBy("popularityScore", "desc"),
        orderBy("createdAt", "desc"),
        limit(pageSize)
    );

    const q = params.cursor ? query(baseQuery, startAfter(params.cursor)) : baseQuery;
    const snap = await getDocs(q);

    const items: Recipe[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Recipe, "id">),
    }));

    const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    return { items, nextCursor };
}