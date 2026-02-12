'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useCollections } from '@/hooks/collections/useCollections';
import { useCollectionRecipes } from '@/hooks/collections/useCollectionRecipies';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import RecipeCard from '@/app/components/RecipeCard';
import AppModal from '@/app/components/AppModal';
import { Recipe } from '@/app/types/Recipe';
import {
    Timestamp,
    getFirestore,
    collection,
    getDocs,
    doc,
    deleteDoc,
    writeBatch,
} from 'firebase/firestore';
import { UserDoc } from '@/hooks/useUserData';

type CollectionEntry = { recipe: Recipe };

const createdAtToMillis = (createdAt: Timestamp | Date | number | undefined): number => {
    if (!createdAt) return 0;
    if (createdAt instanceof Timestamp) return createdAt.toMillis();
    if (createdAt instanceof Date) return createdAt.getTime();
    return createdAt; // number (assumes millis)
};

export default function CollectionPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const user = useAuthUser();
    const uid = user?.uid ?? '';

    const queryClient = useQueryClient();
    const db = React.useMemo(() => getFirestore(), []);

    // user's own collections
    const { data: collections = [], isLoading: collectionsLoading } = useCollections(uid);

    // raw entries of recipes in this collection
    const { data: entries = [], isLoading: recipesLoading } = useCollectionRecipes(id);

    // recipes from entries
    const recipes: Recipe[] = React.useMemo(() => {
        const list = (entries as CollectionEntry[]).map((e) => e.recipe);
        return list.sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
    }, [entries]);

    // fetch creators
    const uniqueUserIds = React.useMemo(
        () => Array.from(new Set(recipes.map((r) => r.userId))),
        [recipes],
    );

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
        staleTime: 60_000,
    });

    // ─────────────────────────────────────────────────────────────
    // Delete states
    // ─────────────────────────────────────────────────────────────
    const [showDeleteListConfirm, setShowDeleteListConfirm] = React.useState(false);
    const [deletingList, setDeletingList] = React.useState(false);

    const [removeRecipeId, setRemoveRecipeId] = React.useState<string | null>(null);
    const [removingRecipe, setRemovingRecipe] = React.useState(false);

    if (!uid) return <div className="p-4">Du må være logget inn.</div>;
    if (collectionsLoading || recipesLoading) return <div className="p-4">Laster…</div>;

    const currentCollection = collections.find((c) => c.id === id);
    const title = currentCollection?.name ?? 'Liste';

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────
    const removeOneRecipeFromList = async (recipeId: string) => {
        if (!id) return;

        setRemovingRecipe(true);
        try {
            await deleteDoc(doc(db, 'collectionsRecipes', id, 'recipes', recipeId));

            // refresh list
            await queryClient.invalidateQueries({ queryKey: ['collectionRecipes', id] });
        } finally {
            setRemovingRecipe(false);
        }
    };

    const deleteWholeList = async () => {
        if (!id || !uid) return;

        setDeletingList(true);
        try {
            // 1) Delete all recipe docs inside collectionsRecipes/{collectionId}/recipes
            const recipesSnap = await getDocs(collection(db, 'collectionsRecipes', id, 'recipes'));

            const docs = recipesSnap.docs;

            // Firestore batch limit is 500
            const CHUNK = 450;

            for (let i = 0; i < docs.length; i += CHUNK) {
                const batch = writeBatch(db);
                const slice = docs.slice(i, i + CHUNK);
                slice.forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }

            // 2) Delete the collection document itself (where lists live)
            await deleteDoc(doc(db, 'users', uid, 'collections', id));

            // 3) Refresh caches
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['collections', uid] }),
                queryClient.invalidateQueries({ queryKey: ['collectionRecipes', id] }),
            ]);

            // 4) Navigate away (since list is gone)
            router.replace('/collections');
        } catch (e) {
            console.error('Error deleting list:', e);
        } finally {
            setDeletingList(false);
        }
    };

    return (
        <div className="p-4 md:mb-20 md:max-w-5xl md:w-2/3 md:mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 mb-4">
                <button onClick={() => router.back()} className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div className="flex-1" />

                {/* Delete whole list */}
                <button
                    type="button"
                    onClick={() => setShowDeleteListConfirm(true)}
                    className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-60"
                    disabled={deletingList}
                >
                    {deletingList ? 'Sletter…' : 'Slett liste'}
                </button>
            </div>

            <h1 className="md:text-5xl text-4xl font-bold mb-6">{title}</h1>

            {recipes.length === 0 ? (
                <p>
                    Ingen oppskrifter i listen <em>{title}</em>.
                </p>
            ) : (
                <div className="grid md:grid-cols-2 grid-cols-1 md:gap-10 gap-20 mb-20">
                    {recipes.map((recipe) => (
                        <div key={recipe.id} className="relative">
                            {/* Remove single recipe from list */}
                            <button
                                type="button"
                                onClick={() => setRemoveRecipeId(recipe.id)}
                                className="absolute z-10 top-3 right-3 h-10 px-3 rounded-full bg-white/90 backdrop-blur border border-slate-200 shadow-sm hover:bg-white flex items-center gap-2 hover:cursor-pointer"
                                aria-label="Fjern fra liste"
                            >
                                <span className="material-symbols-outlined text-[20px] text-slate-700">delete</span>
                                <span className="text-sm font-semibold text-slate-800">Fjern</span>
                            </button>

                            <RecipeCard recipe={recipe} creator={usersMap[recipe.userId]} />
                        </div>
                    ))}
                </div>
            )}

            {/* Confirm: remove one recipe */}
            {removeRecipeId && (
                <AppModal onClose={() => setRemoveRecipeId(null)}>
                    {({ closeWithAnim, closing }) => (
                    <div className="p-6">
                        <h2 className="text-xl font-semibold text-slate-900">Fjerne fra listen?</h2>
                        <p className="text-slate-600 mt-2">Oppskriften blir bare fjernet fra denne listen.</p>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeWithAnim}
                                className="px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50"
                                disabled={removingRecipe || closing}
                            >
                                Avbryt
                            </button>

                            <button
                                type="button"
                                onClick={async () => {
                                    await removeOneRecipeFromList(removeRecipeId);
                                    closeWithAnim();
                                }}
                                className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
                                disabled={removingRecipe || closing}
                            >
                                {removingRecipe ? 'Fjerner…' : 'Fjern'}
                            </button>
                        </div>
                    </div>
                    )}
                </AppModal>
            )}

            {/* Confirm: delete whole list */}
            {showDeleteListConfirm && (
                <AppModal onClose={() => setShowDeleteListConfirm(false)}>
                    {({ closeWithAnim, closing }) => (
                    <div className="p-6">
                        <h2 className="text-xl font-semibold text-slate-900">Slette listen?</h2>
                        <p className="text-slate-600 mt-2">
                            Dette sletter listen og alle referanser til oppskrifter i listen. Oppskriftene i seg selv blir ikke slettet.
                        </p>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeWithAnim}
                                className="px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50"
                                disabled={deletingList || closing}
                            >
                                Avbryt
                            </button>

                            <button
                                type="button"
                                onClick={async () => {
                                    await deleteWholeList();
                                    closeWithAnim();
                                }}
                                className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
                                disabled={deletingList || closing}
                            >
                                {deletingList ? 'Sletter…' : 'Slett liste'}
                            </button>
                        </div>
                    </div>
                    )}
                </AppModal>
            )}
        </div>
    );
}
