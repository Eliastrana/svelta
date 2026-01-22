// app/collections/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCollections, createCollection } from '@/helpers/collectionHelpers';

export interface CollectionDoc {
    id: string;
    name: string;
}

const CollectionsPage: React.FC = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [authReady, setAuthReady] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    const [newListName, setNewListName] = useState('');

    // Auth guard
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
            if (!u) router.push('/login');
        });
        return () => unsub();
    }, [router]);

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
        mutationFn: ({ name }: { name: string }) => createCollection(uid, name),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections', uid] }),
    });

    const canCreate = useMemo(() => !!newListName.trim() && !createMutation.isPending, [newListName, createMutation.isPending]);

    const handleSubmit = () => {
        const trimmed = newListName.trim();
        if (!trimmed || !uid) return;
        createMutation.mutate({ name: trimmed });
        setNewListName('');
    };

    if (!authReady) {
        return <div className="p-4 text-slate-600">Laster…</div>;
    }

    if (!user) {
        // vi har allerede router.push('/login'), så dette er bare for å unngå flash
        return null;
    }

    return (
        <div className="min-h-screen  pb-24">
            {/* Top bar */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
                <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100"
                        aria-label="Tilbake"
                        type="button"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>

                    <h1 className="text-lg font-semibold text-slate-900">Mine lister</h1>

                    <div className="w-10" />
                </div>
            </div>

            <div className="mx-auto max-w-xl px-4 py-6 space-y-4">
                {/* Create */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Ny liste…"
                            className="flex-grow px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />

                        <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition disabled:opacity-50 disabled:hover:bg-slate-100"
                            onClick={handleSubmit}
                            disabled={!canCreate}
                            aria-label="Lag ny liste"
                        >
                            Lag
                        </button>
                    </div>

                    {createMutation.isError ? (
                        <p className="text-sm text-red-600 mt-3">
                            Klarte ikke å lage liste: {(createMutation.error as Error)?.message ?? 'Ukjent feil'}
                        </p>
                    ) : null}
                </div>

                {/* List */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                    {isError ? (
                        <p className="text-sm text-red-600">
                            Klarte ikke å hente lister: {error?.message ?? 'Ukjent feil'}
                        </p>
                    ) : loading ? (
                        <p className="text-slate-600">Laster…</p>
                    ) : collections.length === 0 ? (
                        <p className="text-sm text-slate-600">Ingen lister ennå.</p>
                    ) : (
                        <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                            {collections.map((c) => (
                                <li
                                    key={c.id}
                                    className="p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition flex items-center justify-between"
                                    onClick={() => router.push(`/collections/${c.id}`)}
                                >
                                    <span className="font-medium text-slate-900">{c.name}</span>
                                    <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CollectionsPage;