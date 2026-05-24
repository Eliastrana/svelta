'use client';

import React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useCollectionRecipes } from '@/hooks/collections/useCollectionRecipies';
import { useCollectionSummaries } from '@/hooks/collections/useCollectionSummaries';
import { CollectionDoc, fetchCollectionByOwner, updateCollection } from '@/helpers/collectionHelpers';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RecipeCard from '@/app/components/RecipeCard';
import AppModal from '@/app/components/AppModal';
import { Recipe } from '@/app/types/Recipe';
import { storage } from '@/firebase';
import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
    const searchParams = useSearchParams();

    const user = useAuthUser();
    const uid = user?.uid ?? '';
    const ownerId = searchParams.get('owner') || uid;
    const isOwner = !!uid && uid === ownerId;

    const queryClient = useQueryClient();
    const db = React.useMemo(() => getFirestore(), []);

    const { data: currentCollection, isLoading: collectionLoading } = useQuery<CollectionDoc | null>({
        queryKey: ['collection', ownerId, id],
        queryFn: () => fetchCollectionByOwner(ownerId, id),
        enabled: !!id && !!ownerId,
    });

    const canViewCollection = !!currentCollection && (isOwner || !!currentCollection.isPublic);
    const collectionSummaries = useCollectionSummaries([{ id }]);

    const {
        data: entries = [],
        isLoading: recipesLoading,
        isFetching: recipesFetching,
    } = useCollectionRecipes(id, canViewCollection);

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
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [draftName, setDraftName] = React.useState('');
    const [draftDescription, setDraftDescription] = React.useState('');
    const [draftIsPublic, setDraftIsPublic] = React.useState(false);
    const [coverFile, setCoverFile] = React.useState<File | null>(null);
    const [coverPreview, setCoverPreview] = React.useState('');
    const [removeCoverImage, setRemoveCoverImage] = React.useState(false);

    const [removeRecipeId, setRemoveRecipeId] = React.useState<string | null>(null);
    const [removingRecipe, setRemovingRecipe] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);

    const title = currentCollection?.name ?? 'Liste';
    const description = currentCollection?.description?.trim() || '';
    const coverImage = currentCollection?.coverImage?.trim() || collectionSummaries[id]?.previewImage || '';
    const explicitCoverImage = currentCollection?.coverImage?.trim() || '';
    const recipesPending = canViewCollection && (recipesLoading || (recipesFetching && recipes.length === 0));

    React.useEffect(() => {
        if (!showEditModal) return;
        setDraftName(currentCollection?.name ?? '');
        setDraftDescription(currentCollection?.description ?? '');
        setDraftIsPublic(!!currentCollection?.isPublic);
        setCoverFile(null);
        setRemoveCoverImage(false);
        setSaveError(null);
        setCoverPreview(explicitCoverImage);
    }, [showEditModal, currentCollection, explicitCoverImage]);

    React.useEffect(() => {
        return () => {
            if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
        };
    }, [coverPreview]);

    const updateMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = draftName.trim();
            if (!trimmedName) {
                throw new Error('Navn på kokeboken kan ikke være tomt.');
            }

            let nextCoverImage = removeCoverImage ? '' : explicitCoverImage;

            if (coverFile) {
                const imageRef = ref(storage, `collection-covers/${ownerId}/${Date.now()}-${coverFile.name}`);
                const snap = await uploadBytes(imageRef, coverFile);
                nextCoverImage = await getDownloadURL(snap.ref);
            }

            await updateCollection(ownerId, id, {
                name: trimmedName,
                description: draftDescription,
                coverImage: nextCoverImage,
                isPublic: draftIsPublic,
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['collection', ownerId, id] }),
                queryClient.invalidateQueries({ queryKey: ['collections', ownerId] }),
                queryClient.invalidateQueries({ queryKey: ['publicCollections', ownerId] }),
                queryClient.invalidateQueries({ queryKey: ['collectionSummary', id] }),
            ]);
            setShowEditModal(false);
        },
    });

    if (collectionLoading) return <div className="p-4">Laster…</div>;
    if (!ownerId || !currentCollection) return <div className="p-4">Fant ikke samlingen.</div>;
    if (!canViewCollection) return <div className="p-4">Denne samlingen er privat.</div>;

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────
    const removeOneRecipeFromList = async (recipeId: string) => {
        if (!id) return;

        setRemovingRecipe(true);
        try {
            await deleteDoc(doc(db, 'collectionsRecipes', id, 'recipes', recipeId));

            // refresh list
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['collectionRecipes', id] }),
                queryClient.invalidateQueries({ queryKey: ['collectionSummary', id] }),
            ]);
        } finally {
            setRemovingRecipe(false);
        }
    };

    const deleteWholeList = async () => {
        if (!id || !ownerId) return;

        setDeletingList(true);
        try {
            const recipesSnap = await getDocs(collection(db, 'collectionsRecipes', id, 'recipes'));

            const docs = recipesSnap.docs;
            const CHUNK = 450;

            for (let i = 0; i < docs.length; i += CHUNK) {
                const batch = writeBatch(db);
                const slice = docs.slice(i, i + CHUNK);
                slice.forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }

            await deleteDoc(doc(db, 'users', ownerId, 'collections', id));

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['collections', ownerId] }),
                queryClient.invalidateQueries({ queryKey: ['publicCollections', ownerId] }),
                queryClient.invalidateQueries({ queryKey: ['collection', ownerId, id] }),
                queryClient.invalidateQueries({ queryKey: ['collectionRecipes', id] }),
                queryClient.invalidateQueries({ queryKey: ['collectionSummary', id] }),
            ]);

            router.replace('/collections');
        } catch (e) {
            console.error('Error deleting list:', e);
        } finally {
            setDeletingList(false);
        }
    };

    return (
        <div className="min-h-screen pb-20">
            <div className="relative min-h-[40vh] w-full overflow-hidden bg-[var(--accent-soft)]">
                {coverImage ? (
                    <img src={coverImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 h-full w-full bg-[var(--accent)]" />
                )}

                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/45" />

                <div className="absolute left-0 right-0 top-0 z-10 p-4">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                        {/*<button*/}
                        {/*    onClick={() => router.back()}*/}
                        {/*    className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white"*/}
                        {/*>*/}
                        {/*    <span className="material-symbols-outlined">arrow_back</span>*/}
                        {/*</button>*/}

                        <div className="flex-1" />


                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-4 pt-6 md:w-2/3 md:pt-8">
                <div className="mb-8 flex justify-between">
                    <div>
                    <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">{title}</h1>
                    {description ? (
                        <p className="mt-3 max-w-2xl text-sm text-slate-700 md:text-base">{description}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-slate-700">
                            {currentCollection.isPublic ? 'Offentlig' : 'Privat'}
                        </span>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                            {recipes.length} {recipes.length === 1 ? 'oppskrift' : 'oppskrifter'}
                        </span>
                    </div>
                    </div>

                    {isOwner ? (
                        <button
                            type="button"
                            onClick={() => setShowEditModal(true)}
                            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white"
                            aria-label="Rediger kokebok"
                        >
                            <span className="material-symbols-outlined text-slate-700">edit</span>
                        </button>
                    ) : null}
                </div>

                {recipesPending ? (
                    <div className="flex min-h-[220px] items-center justify-center">
                        <div className="flex flex-col items-center gap-4 text-slate-600">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
                            <p className="text-sm font-medium">Laster oppskrifter…</p>
                        </div>
                    </div>
                ) : recipes.length === 0 ? (
                    <p>
                        Ingen oppskrifter i kokeboken <em>{title}</em>.
                    </p>
                ) : (
                    <div className="mb-20 grid grid-cols-1 gap-20 md:grid-cols-2 md:gap-10">
                        {recipes.map((recipe) => (
                            <div key={recipe.id} className="relative">
                                {isOwner ? (
                                    <button
                                        type="button"
                                        onClick={() => setRemoveRecipeId(recipe.id)}
                                        className="absolute z-10 top-5 left-5 h-10 px-3 rounded-full bg-white/90 backdrop-blur border border-slate-200 shadow-sm hover:bg-white flex items-center gap-2 hover:cursor-pointer"
                                        aria-label="Fjern fra liste"
                                    >
                                        <span className="material-symbols-outlined text-[20px] text-neutral-800">delete</span>
                                        <span className="text-sm font-semibold text-neutral-800">Fjern</span>
                                    </button>
                                ) : null}

                                <RecipeCard recipe={recipe} creator={usersMap[recipe.userId]} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                        <h2 className="text-xl font-semibold text-slate-900">Slette kokeboken?</h2>
                        <p className="text-slate-600 mt-2">
                            Dette sletter kokeboken og alle referanser til oppskrifter i den. Oppskriftene i seg selv blir ikke slettet.
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
                                {deletingList ? 'Sletter…' : 'Slett kokebok'}
                            </button>
                        </div>
                    </div>
                    )}
                </AppModal>
            )}

            {showEditModal && (
                <AppModal onClose={() => setShowEditModal(false)}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900">Rediger kokebok</h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Endre navn, beskrivelse, bilde og synlighet.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"
                                    aria-label="Lukk"
                                    disabled={closing || updateMutation.isPending}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
                                <label className="flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-[var(--accent-soft)] text-slate-700">
                                    {coverPreview && !removeCoverImage ? (
                                        <img src={coverPreview} alt="Kokebokbilde" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <span className="material-symbols-outlined text-[28px]">photo_camera</span>
                                            <span className="text-xs font-medium">Velg bilde</span>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
                                            setCoverFile(file);
                                            setRemoveCoverImage(false);
                                            setCoverPreview(URL.createObjectURL(file));
                                        }}
                                    />
                                </label>

                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Navn på kokebok…"
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        disabled={updateMutation.isPending}
                                    />

                                    <textarea
                                        placeholder="Beskrivelse…"
                                        className="mt-3 min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        value={draftDescription}
                                        onChange={(e) => setDraftDescription(e.target.value)}
                                        disabled={updateMutation.isPending}
                                    />

                                    <label className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                        <div>
                                            <p className="font-semibold text-slate-900">Offentlig kokebok</p>
                                            <p className="mt-1 text-xs text-slate-600">
                                                Vises under Samlinger på profilsiden din.
                                            </p>
                                        </div>
                                        <span className="relative inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={draftIsPublic}
                                                onChange={(e) => setDraftIsPublic(e.target.checked)}
                                                disabled={updateMutation.isPending}
                                                className="peer sr-only"
                                            />
                                            <span className="h-8 w-14 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[var(--accent)] peer-disabled:opacity-50" />
                                            <span className="pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6" />
                                        </span>
                                    </label>

                                    {!removeCoverImage && coverPreview ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCoverFile(null);
                                                if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
                                                setCoverPreview('');
                                                setRemoveCoverImage(true);
                                            }}
                                            className="mt-3 text-sm font-medium text-slate-600 hover:text-slate-900"
                                            disabled={updateMutation.isPending}
                                        >
                                            Fjern bilde
                                        </button>
                                    ) : null}

                                    {saveError ? (
                                        <p className="mt-3 text-sm text-red-600">{saveError}</p>
                                    ) : null}

                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowEditModal(false);
                                                setShowDeleteListConfirm(true);
                                            }}
                                            className="rounded-full bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                                            disabled={updateMutation.isPending}
                                        >
                                            Slett kokebok
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={closeWithAnim}
                                                className="rounded-full border border-slate-200 px-4 py-2 hover:bg-slate-50"
                                                disabled={closing || updateMutation.isPending}
                                            >
                                                Avbryt
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setSaveError(null);
                                                    try {
                                                        await updateMutation.mutateAsync();
                                                    } catch (error) {
                                                        setSaveError(
                                                            error instanceof Error ? error.message : 'Klarte ikke å lagre kokeboken.',
                                                        );
                                                    }
                                                }}
                                                className="rounded-full confirm-button px-5 py-2 disabled:opacity-50"
                                                disabled={updateMutation.isPending || closing}
                                            >
                                                {updateMutation.isPending ? 'Lagrer…' : 'Lagre'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </AppModal>
            )}
        </div>
    );
}
