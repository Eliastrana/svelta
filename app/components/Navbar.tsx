// Navbar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import UserProfileDisplay from '@/app/components/UserProfileDisplay';
import UserSearchModal from '@/app/components/UserSearchModal';
import CollectionsModal from '@/app/components/CollectionsModal';
import RecommendModal from '@/app/components/RecommendModal';

import { fetchCollections, createCollection } from '@/helpers/collectionHelpers';

interface CollectionDoc {
    id: string;
    name: string;
}

const Navbar: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams(); // ✅ IMPORTANT

    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [showRecommend, setShowRecommend] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showCollections, setShowCollections] = useState(false);

    const uid = user?.uid ?? '';
    const queryClient = useQueryClient();

    // ─────────────────────────────────────────────────────────────
    // Auth
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    // ─────────────────────────────────────────────────────────────
    // ✅ RecommendModal: always in sync with ?recommend=1
    // Works with router.push, router.replace, back/forward, etc.
    // ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const recommend = searchParams.get('recommend') === '1';
        setShowRecommend(recommend);
    }, [searchParams]);

    const setRecommendParam = (open: boolean) => {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        if (open) url.searchParams.set('recommend', '1');
        else url.searchParams.delete('recommend');

        const next = url.pathname + (url.search ? url.search : '');
        router.replace(next, { scroll: false }); // ✅ triggers searchParams change -> effect above updates showRecommend
    };

    // ─────────────────────────────────────────────────────────────
    // Collections fetch (React Query)
    // ─────────────────────────────────────────────────────────────
    const { data: collections = [], isFetching: loadingCollections } = useQuery<CollectionDoc[], Error>({
        queryKey: ['collections', uid],
        queryFn: () => fetchCollections(uid),
        enabled: authReady && !!uid,
        placeholderData: (prev) => prev ?? [],
    });

    const createMutation = useMutation({
        mutationFn: ({ name }: { name: string }) => createCollection(uid, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collections', uid] });
        },
    });

    const handleCreateList = (name: string) => {
        if (!uid) return;
        createMutation.mutate({ name });
    };

    // ─────────────────────────────────────────────────────────────
    // Active markers (based on current route)
    // ─────────────────────────────────────────────────────────────
    const isHomeActive = pathname === '/';

    const isCreateActive =
        pathname === '/create-recipe' ||
        pathname.startsWith('/recipe/edit') ||
        pathname.startsWith('/create');

    const isFriendsActive = pathname === '/add-friends';
    const isCollectionsActive = showCollections;

    const isProfileActive = !!uid && pathname.startsWith(`/user/${uid}`);

    // ─────────────────────────────────────────────────────────────
    // Styling helpers
    // ─────────────────────────────────────────────────────────────
    const iconBase =
        'cursor-pointer flex items-center justify-center transition-transform duration-150 active:scale-90';

    const iconWrapBg = (active: boolean) =>
        [
            'h-12 w-12 grid place-items-center rounded-full transition-all duration-150',
            active ? 'bg-cyan-100' : 'hover:bg-slate-100',
        ].join(' ');

    if (!authReady || !user) return null;

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
                    {/* HOME */}
                    <button type="button" onClick={() => router.push('/')} className={iconBase} aria-label="Hjem">
            <span className={iconWrapBg(isHomeActive)}>
              <span className="material-symbols-outlined">home</span>
            </span>
                    </button>

                    {/* CREATE */}
                    <button type="button" onClick={() => router.push('/create-recipe')} className={iconBase} aria-label="Lag oppskrift">
            <span className={iconWrapBg(isCreateActive)}>
              <span className="material-symbols-outlined">add</span>
            </span>
                    </button>

                    {/* FRIENDS */}
                    <button type="button" onClick={() => router.push('/add-friends')} className={iconBase} aria-label="Legg til venner">
            <span className={iconWrapBg(isFriendsActive)}>
              <span className="material-symbols-outlined">person_add</span>
            </span>
                    </button>

                    {/* COLLECTIONS */}
                    <button type="button" onClick={() => setShowCollections((s) => !s)} className={iconBase} aria-label="Samlinger">
            <span className={iconWrapBg(isCollectionsActive)}>
              <span className="material-symbols-outlined">list</span>
            </span>
                    </button>

                    {/* PROFILE (ring only when on your profile page) */}
                    <button
                        type="button"
                        onClick={() => uid && router.push(`/user/${uid}`)}
                        className="flex-shrink-0"
                        aria-label="Profil"
                    >
                        <UserProfileDisplay active={isProfileActive} />
                    </button>
                </div>

                {showModal && <UserSearchModal onClose={() => setShowModal(false)} />}
            </div>
        </>
    );
};

export default Navbar;