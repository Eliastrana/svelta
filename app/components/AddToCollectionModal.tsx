'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { useCollections } from '@/hooks/collections/useCollections';
import { useCollectionSummaries } from '@/hooks/collections/useCollectionSummaries';
import { useToggleRecipeInCollection } from '@/hooks/collections/useToggleRecipeInCollection';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createCollection } from '@/helpers/collectionHelpers';
import AppModal from '@/app/components/AppModal';
import { storage } from '@/firebase';

type CollectionItem = {
    id: string;
    name: string;
    coverImage?: string;
    description?: string;
    isPublic?: boolean;
};

type CheckedMap = Record<string, boolean>;

export default function AddToCollectionModal({
                                                 recipeId,
                                                 onClose,
                                             }: {
    recipeId: string;
    onClose: () => void;
}) {
    const user = useAuthUser();
    const uid = user?.uid ?? '';

    const queryClient = useQueryClient();

    const { data: collections = [] } = useCollections(uid) as { data: CollectionItem[] };
    const collectionSummaries = useCollectionSummaries(collections);

    const [checkedMap, setCheckedMap] = useState<CheckedMap>({});

    const [newListName, setNewListName] = useState('');
    const [newListDescription, setNewListDescription] = useState('');
    const [newListIsPublic, setNewListIsPublic] = useState(false);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const db = useMemo(() => getFirestore(), []);

    useEffect(() => {
        if (!uid) return;

        let cancelled = false;

        (async () => {
            const map: CheckedMap = {};

            if (collections.length === 0) {
                if (!cancelled) setCheckedMap({});
                return;
            }

            await Promise.all(
                collections.map(async (c) => {
                    const snap = await getDoc(doc(db, 'collectionsRecipes', c.id, 'recipes', recipeId));
                    map[c.id] = snap.exists();
                }),
            );

            if (!cancelled) setCheckedMap(map);
        })();

        return () => {
            cancelled = true;
        };
    }, [uid, collections, recipeId, db]);

    useEffect(() => {
        return () => {
            if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
        };
    }, [coverPreview]);

    const toggle = useToggleRecipeInCollection();

    const handleToggle = (collectionId: string) => {
        const currentlyChecked = checkedMap[collectionId] ?? false;
        const nextChecked = !currentlyChecked;

        setCheckedMap((prev) => ({ ...prev, [collectionId]: nextChecked }));

        toggle.mutate({
            collectionId,
            recipeId,
            inCollection: currentlyChecked,
            ownerId: uid,
        });
    };

    const handleCreateList = async () => {
        const name = newListName.trim();
        if (!uid || !name || creating) return;

        setCreating(true);
        setCreateError(null);

        try {
            let coverImage = '';

            if (coverFile) {
                const imageRef = ref(storage, `collection-covers/${uid}/${Date.now()}-${coverFile.name}`);
                const snap = await uploadBytes(imageRef, coverFile);
                coverImage = await getDownloadURL(snap.ref);
            }

            const colRef = await createCollection(
                uid,
                name,
                coverImage,
                newListDescription,
                newListIsPublic,
            );
            const newCollectionId = colRef.id;

            await queryClient.invalidateQueries({ queryKey: ['collections', uid] });

            setCheckedMap((prev) => ({ ...prev, [newCollectionId]: true }));
            toggle.mutate({
                collectionId: newCollectionId,
                recipeId,
                inCollection: false,
                ownerId: uid,
            });

            setNewListName('');
            setNewListDescription('');
            setNewListIsPublic(false);
            setCoverFile(null);
            if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
            setCoverPreview('');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setCreateError(msg);
        } finally {
            setCreating(false);
        }
    };

    const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim }) => (
                <div className="p-6">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Legg til i liste</h3>

                    <div className="mb-4 flex items-start gap-3">
                        <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[var(--accent-soft)] text-slate-700">
                            {coverPreview ? (
                                <img src={coverPreview} alt="Omslag" className="h-full w-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined">photo_camera</span>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={onPickCover} />
                        </label>

                        <div className="flex-1">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="Ny liste…"
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void handleCreateList();
                                        }
                                    }}
                                    disabled={!uid || creating}
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleCreateList()}
                                    disabled={!uid || creating || !newListName.trim()}
                                    className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-50"
                                >
                                    {creating ? 'Lager…' : 'Lag'}
                                </button>
                            </div>
                            <textarea
                                value={newListDescription}
                                onChange={(e) => setNewListDescription(e.target.value)}
                                placeholder="Beskrivelse (valgfritt)…"
                                className="mt-2 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                                disabled={!uid || creating}
                            />
                            <label className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                <span>Offentlig samling</span>
                                <span className="relative inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={newListIsPublic}
                                        onChange={(e) => setNewListIsPublic(e.target.checked)}
                                        disabled={!uid || creating}
                                        className="peer sr-only"
                                    />
                                    <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[var(--accent)] peer-disabled:opacity-50" />
                                    <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                                </span>
                            </label>
                            {coverPreview ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCoverFile(null);
                                        if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
                                        setCoverPreview('');
                                    }}
                                    className="mt-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                    Fjern bilde
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {createError ? <p className="mb-4 text-sm text-red-600">{createError}</p> : null}

                    {collections.length === 0 ? (
                        <p className="text-sm text-slate-600">Du har ingen lister ennå.</p>
                    ) : (
                        <ul className="max-h-60 space-y-3 overflow-y-auto pr-2">
                            {collections.map((c) => {
                                const inputId = `collection-${c.id}`;

                                return (
                                    <li key={c.id} className="flex items-center gap-3">
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                            {c.coverImage?.trim() || collectionSummaries[c.id]?.previewImage ? (
                                                <img
                                                    src={c.coverImage?.trim() || collectionSummaries[c.id]?.previewImage || ''}
                                                    alt={c.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-full w-full bg-[var(--accent)]" />
                                            )}
                                        </div>
                                        <label
                                            className="relative flex cursor-pointer items-center rounded-full p-3"
                                            htmlFor={inputId}
                                            data-ripple-dark="true"
                                        >
                                            <input
                                                id={inputId}
                                                type="checkbox"
                                                className="peer relative h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow transition-all before:absolute before:left-2/4 before:top-2/4 before:block before:h-12 before:w-12 before:-translate-x-2/4 before:-translate-y-2/4 before:rounded-full before:bg-slate-300 before:opacity-0 before:transition-opacity hover:shadow-md hover:before:opacity-10 checked:border-slate-600 checked:bg-slate-700 checked:before:bg-slate-300"
                                                checked={!!checkedMap[c.id]}
                                                onChange={() => handleToggle(c.id)}
                                                disabled={!uid}
                                            />

                                            <span className="pointer-events-none absolute left-2/4 top-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-3.5 w-3.5"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                    stroke="currentColor"
                                                    strokeWidth={1}
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </span>
                                        </label>

                                        <div className="min-w-0">
                                            <span className="block text-slate-700">{c.name}</span>
                                            <span className="block text-xs text-slate-500">
                                                {collectionSummaries[c.id]?.recipeCount ?? 0}{' '}
                                                {(collectionSummaries[c.id]?.recipeCount ?? 0) === 1 ? 'oppskrift' : 'oppskrifter'}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <button className="mt-6 w-full rounded-full confirm-button py-2" onClick={closeWithAnim}>
                        Ferdig
                    </button>
                </div>
            )}
        </AppModal>
    );
}
