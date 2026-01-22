// Navbar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import UserProfileDisplay from '@/app/components/UserProfileDisplay';
import UserSearchModal from '@/app/components/UserSearchModal';
import { fetchCollections, createCollection } from '@/helpers/collectionHelpers';
import CollectionsModal from '@/app/components/CollectionsModal';
import RecommendModal from '@/app/components/RecommendModal';

interface CollectionDoc {
    id: string;
    name: string;
}

function readRecommendParam(): boolean {
    if (typeof window === 'undefined') return false;
    const sp = new URLSearchParams(window.location.search);
    return sp.get('recommend') === '1';
}

const Navbar: React.FC = () => {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [showRecommend, setShowRecommend] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showCollections, setShowCollections] = useState(false);

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    // Open RecommendModal if URL has ?recommend=1 (and keep in sync on back/forward)
    useEffect(() => {
        // initial
        setShowRecommend(readRecommendParam());

        const onPopState = () => {
            setShowRecommend(readRecommendParam());
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const uid = user?.uid ?? '';
    const queryClient = useQueryClient();

    const { data: collections = [], isFetching: loadingCollections } = useQuery<CollectionDoc[], Error>({
        queryKey: ['collections', uid],
        queryFn: () => fetchCollections(uid),
        enabled: authReady && !!uid,
        placeholderData: (prev) => prev ?? [],
    });

    const createMutation = useMutation({
        mutationFn: ({ name }: { name: string }) => createCollection(uid, name),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections', uid] }),
    });

    const handleCreateList = (name: string) => {
        if (!uid) return;
        createMutation.mutate({ name });
    };

    // Helper to set/clear recommend param + keep state synced
    const setRecommendParam = (open: boolean) => {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);

        if (open) url.searchParams.set('recommend', '1');
        else url.searchParams.delete('recommend');

        // Update UI state immediately
        setShowRecommend(open);

        // Update URL (no scroll jump)
        const next = url.pathname + (url.search ? url.search : '');
        router.replace(next, { scroll: false });
    };

    // Hide navbar until auth is known & user is logged in
    if (!authReady || !user) return null;

    const iconBase = 'cursor-pointer transition-opacity duration-200 flex items-center justify-center';

    return (
        <>
            {showCollections && (
                <CollectionsModal
                    collections={collections}
                    loading={loadingCollections}
                    onCreateList={handleCreateList}
                    onClose={() => setShowCollections(false)}
                />
            )}

            {showRecommend && (
                <RecommendModal
                    onClose={() => {
                        setRecommendParam(false);
                    }}
                />
            )}

            <div className="fixed bottom-2 md:bottom-6 inset-x-0 z-50 px-4">
                <div className="mx-auto flex items-center justify-between max-w-sm gap-2 px-6 py-2 rounded-full shadow-xl backdrop-blur-lg bg-white/90 border border-slate-200">
                    <h2 onClick={() => router.push('/')} className={iconBase}>
                        <span className="material-symbols-outlined">home</span>
                    </h2>

                    <h2 onClick={() => router.push('/create-recipe')} className={iconBase}>
                        <span className="material-symbols-outlined">add</span>
                    </h2>

                    <h2 onClick={() => router.push('/add-friends')} className={iconBase}>
                        <span className="material-symbols-outlined">person_add</span>
                    </h2>

                    <h2 onClick={() => setShowCollections((s) => !s)} className={iconBase}>
                        <span className="material-symbols-outlined bg-cyan-100 p-1.5 rounded-full">list</span>
                    </h2>

                    <div onClick={() => router.push(`/user/${uid}`)} className={`${iconBase} flex-shrink-0`}>
                        <UserProfileDisplay />
                    </div>
                </div>

                {showModal && <UserSearchModal onClose={() => setShowModal(false)} />}
            </div>

            {/* eksempel: hvis du vil åpne recommend fra en knapp et annet sted:
          setRecommendParam(true)
      */}
        </>
    );
};

export default Navbar;