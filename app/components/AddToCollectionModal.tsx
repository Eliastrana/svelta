'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';

import { useCollections } from '@/hooks/collections/useCollections';
import { useToggleRecipeInCollection } from '@/hooks/collections/useToggleRecipeInCollection';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createCollection } from '@/helpers/collectionHelpers';
import AppModal from '@/app/components/AppModal';

type CollectionItem = {
    id: string;
    name: string;
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

    // useCollections skal hente fra users/{uid}/collections (samme som helpers)
    const { data: collections = [] } = useCollections(uid) as { data: CollectionItem[] };

    const [checkedMap, setCheckedMap] = useState<CheckedMap>({});

    // ✅ New list UI state
    const [newListName, setNewListName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const db = useMemo(() => getFirestore(), []);

    // Build initial checkedMap: for each collection, check if recipe doc exists
    useEffect(() => {
        if (!uid) return;

        let cancelled = false;

        (async () => {
            const map: CheckedMap = {};

            // hvis ingen collections, bare sett tomt map (så UI ikke henger på gamle)
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

    const toggle = useToggleRecipeInCollection();

    const handleToggle = (collectionId: string) => {
        const currentlyChecked = checkedMap[collectionId] ?? false;
        const nextChecked = !currentlyChecked;

        // optimistic UI
        setCheckedMap((prev) => ({ ...prev, [collectionId]: nextChecked }));

        toggle.mutate({
            collectionId,
            recipeId,
            inCollection: currentlyChecked,
            ownerId: uid,
        });
    };

    // ✅ Create a new list (CORRECT PATH): users/{uid}/collections
    const handleCreateList = async () => {
        const name = newListName.trim();
        if (!uid || !name || creating) return;

        setCreating(true);
        setCreateError(null);

        try {
            // IMPORTANT: bruk helperen din, så det havner i users/{uid}/collections
            const colRef = await createCollection(uid, name);
            const newCollectionId = colRef.id;

            // refetch collections i hele appen (samme queryKey som navbar bruker)
            await queryClient.invalidateQueries({ queryKey: ['collections', uid] });

            // optional: auto-add denne oppskriften til den nye lista
            setCheckedMap((prev) => ({ ...prev, [newCollectionId]: true }));
            toggle.mutate({
                collectionId: newCollectionId,
                recipeId,
                inCollection: false,
                ownerId: uid,
            });

            setNewListName('');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setCreateError(msg);
        } finally {
            setCreating(false);
        }
    };

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim }) => (
            <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Legg til i liste</h3>

                {/* ✅ Create new list inline */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Ny liste…"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
                        className="px-4 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 disabled:opacity-50"
                    >
                        {creating ? 'Lager…' : 'Lag'}
                    </button>
                </div>

                {createError ? <p className="text-sm text-red-600 mb-4">{createError}</p> : null}

                {collections.length === 0 ? (
                    <p className="text-sm text-slate-600">Du har ingen lister ennå.</p>
                ) : (
                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {collections.map((c) => {
                            const inputId = `collection-${c.id}`;

                            return (
                                <li key={c.id} className="flex items-center gap-3">
                                    <label
                                        className="relative flex cursor-pointer items-center rounded-full p-3"
                                        htmlFor={inputId}
                                        data-ripple-dark="true"
                                    >
                                        <input
                                            id={inputId}
                                            type="checkbox"
                                            className="peer relative h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow hover:shadow-md transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-300 before:opacity-0 before:transition-opacity checked:border-slate-600 checked:bg-slate-700 checked:before:bg-slate-300 hover:before:opacity-10"
                                            checked={!!checkedMap[c.id]}
                                            onChange={() => handleToggle(c.id)}
                                            disabled={!uid}
                                        />

                                        <span className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
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

                                    <span className="text-slate-700">{c.name}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <button className="mt-6 w-full py-2 rounded-full confirm-button" onClick={closeWithAnim}>
                    Ferdig
                </button>
            </div>
            )}
        </AppModal>
    );
}
