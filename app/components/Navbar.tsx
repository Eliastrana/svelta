'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import UserProfileDisplay from '@/app/components/UserProfileDisplay';
import UserSearchModal from '@/app/components/UserSearchModal';

// collection helpers (see helpers/collectionHelpers.ts)
import {
    fetchCollections,
    createCollection,
} from '@/helpers/collectionHelpers';
import CollectionsModal from '@/app/components/CollectionsModal';

interface CollectionDoc {
    id: string;
    name: string;
}

const Navbar: React.FC = () => {
    const router = useRouter();

    /* ─────────── Auth ─────────── */
    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    /* ─────────── UI toggles ─────────── */
    const [showModal, setShowModal]           = useState(false);
    const [showCollections, setShowCollections] = useState(false);

    /* ─────────── Collections (lists) ─────────── */
    const {
        data: collections = [],
        isFetching: loadingCollections,
    } = useQuery<CollectionDoc[], Error>({
        queryKey: ['collections', user?.uid],
        queryFn : () => fetchCollections(user!.uid),
        enabled : !!user?.uid,
        placeholderData: (prev) => prev ?? [],
    });

    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: ({ name }: { name: string }) =>
            createCollection(user!.uid, name),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['collections', user?.uid] }),
    });

    const handleCreateList = (name: string) =>
        createMutation.mutate({ name });


    /* ─────────── Computed styles ─────────── */
    const iconBase =
        'cursor-pointer transition-opacity duration-200 flex items-center justify-center';
    const disabledIfNoUser = !user ? 'opacity-50 pointer-events-none' : '';

    return (
        <>
            {/* Top brand bar (empty for now) */}
            <div className="flex items-center h-16 px-4 sticky top-0 z-40 bg-transparent" />

            {showCollections && (
                <CollectionsModal
                    collections={collections}
                    loading={loadingCollections}
                    onCreateList={handleCreateList}
                    onClose={() => setShowCollections(false)}
                />

            )}

            {/* Floating bottom action bar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 px-6 rounded-full shadow-xl backdrop-blur-lg bg-white/30 dark:bg-[#373737]/30 border border-white/40 dark:border-slate-600/40">
                {/* Home */}
                <h2
                    onClick={() => router.push('/')}
                    className={`${iconBase} ${disabledIfNoUser}`}
                >
                    <span className="material-symbols-outlined">home</span>
                </h2>

                {/* My lists */}
                <h2
                    onClick={() => {
                        if (user) {
                            setShowCollections((s) => !s);
                        } else {
                            alert('Du må være innlogget for å se dine lister.');
                        }
                    }}
                    className={`${iconBase} ${disabledIfNoUser}`}
                >
                    <span className="material-symbols-outlined">list</span>
                </h2>

                {/* Create recipe */}
                <h2
                    onClick={() => {
                        if (user) {
                            router.push('/create-recipe');
                        } else {
                            alert('Du må være innlogget for å lage en oppskrift.');
                        }
                    }}
                    className={`${iconBase} ${disabledIfNoUser}`}
                >
                    <span className="material-symbols-outlined">outdoor_grill</span>
                </h2>

                {/* Search users */}
                <h2
                    onClick={() => {
                        if (user) {
                            setShowModal(true);
                        } else {
                            alert('Du må være innlogget for å søke etter brukere.');
                        }
                    }}
                    className={`${iconBase} ${disabledIfNoUser}`}
                >
                    <span className="material-symbols-outlined">person_add</span>
                </h2>

                {/* Profile */}
                <div
                    onClick={() => user && router.push(`/user/${user.uid}`)}
                    className={iconBase}
                >
                    <UserProfileDisplay />
                </div>
            </div>

            {showModal && <UserSearchModal onClose={() => setShowModal(false)} />}
        </>
    );
};

export default Navbar;