// app/collections/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/firebase';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CollectionDoc, createCollection, fetchCollections } from '@/helpers/collectionHelpers';
import { useCollectionSummaries } from '@/hooks/collections/useCollectionSummaries';
import AppModal from '@/app/components/AppModal';
import CollectionCard from '@/app/components/CollectionCard';

const CollectionsPage: React.FC = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [authReady, setAuthReady] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    const [newListName, setNewListName] = useState('');
    const [newListDescription, setNewListDescription] = useState('');
    const [newListIsPublic, setNewListIsPublic] = useState(false);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
            if (!u) router.push('/login');
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        return () => {
            if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
        };
    }, [coverPreview]);

    const uid = user?.uid ?? '';

    const {
        data: collections = [],
        isFetching: loading,
        isError,
        error,
    } = useQuery<CollectionDoc[], Error>({
        queryKey: ['collections', uid],
        queryFn: () => fetchCollections(uid),
        enabled: authReady && !!uid,
        placeholderData: (prev) => prev ?? [],
    });

    const createMutation = useMutation({
        mutationFn: ({
            name,
            coverImage,
            description,
            isPublic,
        }: {
            name: string;
            coverImage?: string;
            description?: string;
            isPublic?: boolean;
        }) => createCollection(uid, name, coverImage, description, isPublic),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections', uid] }),
    });

    const collectionSummaries = useCollectionSummaries(collections);

    const canCreate = useMemo(
        () => !!newListName.trim() && !createMutation.isPending,
        [newListName, createMutation.isPending],
    );

    const resetCreateDraft = () => {
        setNewListName('');
        setNewListDescription('');
        setNewListIsPublic(false);
        setCoverFile(null);
        if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
        setCoverPreview('');
        createMutation.reset();
    };

    const closeCreateModal = () => {
        resetCreateDraft();
        setShowCreateModal(false);
    };

    const handleSubmit = async (closeWithAnim?: () => void) => {
        const trimmed = newListName.trim();
        if (!trimmed || !uid || createMutation.isPending) return;

        try {
            let coverImage = '';

            if (coverFile) {
                const imageRef = ref(storage, `collection-covers/${uid}/${Date.now()}-${coverFile.name}`);
                const snap = await uploadBytes(imageRef, coverFile);
                coverImage = await getDownloadURL(snap.ref);
            }

            await createMutation.mutateAsync({
                name: trimmed,
                coverImage,
                description: newListDescription,
                isPublic: newListIsPublic,
            });
            resetCreateDraft();
            closeWithAnim?.();
        } catch {
            // error state is handled by the mutation
        }
    };

    const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    if (!authReady) {
        return <div className="p-4 text-slate-600">Laster…</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen pb-24 ">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
                <div className="flex items-center justify-between">

                    <h1 className="text-lg font-semibold text-slate-900">Kokebøker</h1>

                    <button
                        type="button"
                        onClick={() => {
                            createMutation.reset();
                            setShowCreateModal(true);
                        }}
                        className="rounded-full confirm-button px-4 py-2 text-sm"
                    >
                        Ny kokebok
                    </button>
                </div>

                <div className="rounded-xl ">
                    {isError ? (
                        <p className="text-sm text-red-600">
                            Klarte ikke å hente lister: {error?.message ?? 'Ukjent feil'}
                        </p>
                    ) : loading ? (
                        <p className="text-slate-600">Laster…</p>
                    ) : collections.length === 0 ? (
                        <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 text-sm text-slate-600 shadow-sm">
                            Ingen samlinger ennå. Trykk på <span className="font-semibold text-slate-900">Ny samling</span> for å lage den første.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {collections.map((c) => (
                                <CollectionCard
                                    key={c.id}
                                    href={`/collections/${c.id}?owner=${uid}`}
                                    name={c.name}
                                    description={c.description}
                                    previewImage={c.coverImage?.trim() || collectionSummaries[c.id]?.previewImage || ''}
                                    recipeCount={collectionSummaries[c.id]?.recipeCount ?? 0}
                                    visibilityLabel={c.isPublic ? 'Offentlig' : 'Privat'}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showCreateModal ? (
                <AppModal onClose={closeCreateModal}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900">Ny samling</h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Velg et bilde hvis du vil, ellers bruker vi bildet fra den nyeste oppskriften i samlingen.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"
                                    aria-label="Lukk"
                                    disabled={closing || createMutation.isPending}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
                                <label className="flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[var(--accent-soft)] text-slate-700">
                                    {coverPreview ? (
                                        <img src={coverPreview} alt="Forside" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <span className="material-symbols-outlined text-[28px]">photo_camera</span>
                                            <span className="text-xs font-medium">Velg bilde</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={onPickCover} />
                                </label>

                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Navn på samling…"
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void handleSubmit(closeWithAnim);
                                            }
                                        }}
                                        disabled={createMutation.isPending}
                                    />

                                    <textarea
                                        placeholder="Beskrivelse (valgfritt)…"
                                        className="mt-3 min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        value={newListDescription}
                                        onChange={(e) => setNewListDescription(e.target.value)}
                                        disabled={createMutation.isPending}
                                    />

                                    <label className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                        <div>
                                            <p className="font-semibold text-slate-900">Offentlig samling</p>
                                            <p className="mt-1 text-xs text-slate-600">
                                                Vises under Samlinger på profilsiden din.
                                            </p>
                                        </div>
                                        <span className="relative inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={newListIsPublic}
                                                onChange={(e) => setNewListIsPublic(e.target.checked)}
                                                disabled={createMutation.isPending}
                                                className="peer sr-only"
                                            />
                                            <span className="h-8 w-14 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[var(--accent)] peer-disabled:opacity-50" />
                                            <span className="pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6" />
                                        </span>
                                    </label>

                                    <div className="mt-3 flex flex-wrap items-center gap-3">
                                        {coverPreview ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCoverFile(null);
                                                    if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
                                                    setCoverPreview('');
                                                }}
                                                className="text-sm font-medium text-slate-600 hover:text-slate-900"
                                            >
                                                Fjern bilde
                                            </button>
                                        ) : null}

                                        <button
                                            type="button"
                                            className="rounded-full confirm-button px-5 py-2 disabled:opacity-50"
                                            onClick={() => void handleSubmit(closeWithAnim)}
                                            disabled={!canCreate || closing}
                                        >
                                            {createMutation.isPending ? 'Lager…' : 'Lag samling'}
                                        </button>
                                    </div>

                                    {createMutation.isError ? (
                                        <p className="mt-3 text-sm text-red-600">
                                            Klarte ikke å lage samling: {(createMutation.error as Error)?.message ?? 'Ukjent feil'}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                </AppModal>
            ) : null}
        </div>
    );
};

export default CollectionsPage;
