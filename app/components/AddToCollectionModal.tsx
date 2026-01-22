'use client';

import React, { useEffect, useState } from 'react';
import {
    getFirestore,
    doc,
    getDoc,
} from 'firebase/firestore';
import { useCollections } from '@/hooks/collections/useCollections';
import { useToggleRecipeInCollection } from '@/hooks/collections/useToggleRecipeInCollection';
import { useAuthUser } from '@/hooks/useAuthUser';
import Button from '@/app/components/Button';

export default function AddToCollectionModal({
                                                 recipeId,
                                                 onClose,
                                             }: {
    recipeId: string;
    onClose: () => void;
}) {
    const user = useAuthUser();
    const uid = user?.uid ?? '';
    const { data: collections = [] } = useCollections(uid);
    const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!uid || collections.length === 0) return;

        const db = getFirestore();
        (async () => {
            const map: Record<string, boolean> = {};
            await Promise.all(
                collections.map(async (c) => {
                    const snap = await getDoc(
                        doc(db, 'collectionsRecipes', c.id, 'recipes', recipeId),
                    );
                    map[c.id] = snap.exists();
                }),
            );
            setCheckedMap(map);
        })();
    }, [uid, collections, recipeId]);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
            <div className="bg-white rounded-2xl p-6 w-[90vw] max-w-md border border-slate-200 shadow-xl">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Legg til i liste</h3>

                {collections.length === 0 ? (
                    <p className="text-sm text-slate-600">Du har ingen lister ennå.</p>
                ) : (
                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {collections.map((c) => (
                            <li key={c.id} className="flex items-center gap-3">

                                <label
                                    className="relative flex cursor-pointer items-center rounded-full p-3"
                                    htmlFor="ripple-on"
                                    data-ripple-dark="true"
                                >

                                    <input
                                        id="ripple-on"
                                        type="checkbox"
                                        className="peer relative h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow hover:shadow-md transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-300 before:opacity-0 before:transition-opacity checked:border-slate-600 checked:bg-slate-700 checked:before:bg-slate-300 hover:before:opacity-10"
                                        checked={!!checkedMap[c.id]}
                                        onChange={() => handleToggle(c.id)}
                                    />
                                    <span
                                        className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
      <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1"
      >
        <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
        ></path>
      </svg>
    </span>
                                </label>


                                <span className="text-slate-700">{c.name}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <Button
                    className="mt-6 w-full"
                    onClick={onClose}
                >
                    Ferdig
                </Button>
            </div>
        </div>
    );
}
