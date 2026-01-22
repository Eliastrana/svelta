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

const Navbar: React.FC = () => {
    const router = useRouter();

    // ✅ Hooks always called (no early return before these)
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [showRecommend, setShowRecommend] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showCollections, setShowCollections] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    const uid = user?.uid ?? '';

    const queryClient = useQueryClient();

    const {
        data: collections = [],
        isFetching: loadingCollections,
    } = useQuery<CollectionDoc[], Error>({
        queryKey: ['collections', uid],
        queryFn: () => fetchCollections(uid),
        enabled: authReady && !!uid, // ✅ only runs when logged in
        placeholderData: (prev) => prev ?? [],
    });

    const createMutation = useMutation({
        mutationFn: ({ name }: { name: string }) => createCollection(uid, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collections', uid] });
        },
    });

    const handleCreateList = (name: string) => {
        if (!uid) return; // safety
        createMutation.mutate({ name });
    };

    // ✅ Now it's safe to early-return (after ALL hooks)
    if (!authReady || !user) return null;

    const iconBase =
        'cursor-pointer transition-opacity duration-200 flex items-center justify-center';

    return (
        <>
            {/* Top brand bar */}
            {/*<div className="flex items-center h-16 px-4 sticky top-0 z-40 bg-transparent" />*/}

            {showCollections && (
                <CollectionsModal
                    collections={collections}
                    loading={loadingCollections}
                    onCreateList={handleCreateList}
                    onClose={() => setShowCollections(false)}
                />
            )}

            {showRecommend && <RecommendModal onClose={() => setShowRecommend(false)} />}


            <div className="fixed bottom-2 md:bottom-6 inset-x-0 z-50 px-4">
                <div
                    className="
      mx-auto
      flex items-center justify-between
      max-w-sm gap-2 px-6 py-2
      rounded-full shadow-xl backdrop-blur-lg
      bg-white/90 border border-slate-200
    "
                >

                <h2 onClick={() => router.push('/')} className={iconBase}>
                    <span className="material-symbols-outlined">home</span>
                </h2>


                <h2 onClick={() => router.push('/create-recipe')} className={iconBase}>
                    <span className="material-symbols-outlined">outdoor_grill</span>
                </h2>

                    <h2 onClick={() => router.push('/add-friends')} className={iconBase}>
                        <span className="material-symbols-outlined">person_add</span>
                    </h2>


                    {/*<h2 onClick={() => setShowRecommend(true)} className={iconBase}>*/}
                {/*    <span className="material-symbols-outlined">skillet</span>*/}
                {/*</h2>*/}

                    <h2 onClick={() => setShowCollections((s) => !s)} className={iconBase}>
                        <span className="material-symbols-outlined bg-neutral-200 p-1.5 rounded-full ">list</span>
                    </h2>


                <div
                    onClick={() => router.push(`/user/${uid}`)}
                    className={`${iconBase} flex-shrink-0`}
                >
                    <UserProfileDisplay />
                </div>
            </div>

            {showModal && <UserSearchModal onClose={() => setShowModal(false)} />}

            </div>
        </>
    );
};

export default Navbar;
