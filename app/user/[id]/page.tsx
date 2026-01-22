'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    deleteDoc,
    getDocs,
} from 'firebase/firestore';
import { auth, firestore } from '@/firebase';
import { signOut, User } from 'firebase/auth';
import { useUserRecipes } from '@/hooks/useUserRecipes';
import RecipeCard from '@/app/components/RecipeCard';
import { useUserLikedRecipes } from '@/hooks/useLikedRecipes';
import Button from '@/app/components/Button';

interface UserData {
    name?: string;
    following?: string[];
    photoURL?: string;
}

// Ensure a Firestore doc exists for every signed-in user
const createUserDocumentIfNotExists = async (user: User) => {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            name: user.displayName || 'Unnamed User',
            following: [],
            photoURL: user.photoURL || '',
        });
    }
};

// Run on every auth-state change to bootstrap user data
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await createUserDocumentIfNotExists(user);
    }
});

const ProfileSkeleton: React.FC = () => {
    return (
        <div className="md:w-1/2 w-full mx-auto p-4 animate-pulse">
            {/* Header skeleton */}
            <div className="md:flex justify-between items-center">
                <div className="flex items-center">
                    <div className="h-16 w-16 rounded-full bg-slate-100 mr-4" />
                    <div className="space-y-2">
                        <div className="h-7 w-48 rounded-xl bg-slate-100" />
                        <div className="h-4 w-24 rounded-xl bg-slate-100" />
                    </div>
                </div>

                <div className="mt-4 md:mt-0 h-10 w-28 rounded-full bg-slate-100" />
            </div>

            {/* Tabs skeleton */}
            <div className="mt-6 rounded-full bg-slate-100 h-10 w-full max-w-sm" />

            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`sk-${i}`} className="animate-pulse">
                        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
                            <div className="h-72 bg-slate-100" />
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="h-7 w-2/3 rounded-xl bg-slate-100" />
                            <div className="h-4 w-full rounded-xl bg-slate-100" />
                            <div className="h-4 w-5/6 rounded-xl bg-slate-100" />
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-4 w-28 rounded-xl bg-slate-100" />
                                    <div className="h-3 w-36 rounded-xl bg-slate-100" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-5 w-12 rounded-xl bg-slate-100" />
                                <div className="h-5 w-12 rounded-xl bg-slate-100" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-24" />
        </div>
    );
};

const UserProfile: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    // Fetch lists
    const userRecipes = useUserRecipes(id || '');
    const userLikedRecipes = useUserLikedRecipes(id || '');

    // UI state
    const [activeTab, setActiveTab] = useState<'myRecipes' | 'likedRecipes'>('myRecipes');
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // Skeleton loading state
    const [profileLoading, setProfileLoading] = useState(true);

    // New logout: clear Firebase session, then hit our server-side route to wipe the cookie
    const logout = async () => {
        try {
            await signOut(auth);
            router.replace('/logout');
        } catch (err) {
            console.error('Error logging out:', err);
        }
    };

    // Load profile data & following status
    useEffect(() => {
        if (!id) return;

        setProfileLoading(true);

        (async () => {
            try {
                const snap = await getDoc(doc(firestore, 'users', id));
                if (snap.exists()) setUserData(snap.data() as UserData);
                else setUserData(null);

                if (auth.currentUser) {
                    const meSnap = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
                    const following: string[] = meSnap.exists()
                        ? (meSnap.data() as UserData).following || []
                        : [];
                    setIsFollowing(following.includes(id));
                }
            } finally {
                setProfileLoading(false);
            }
        })();
    }, [id]);

    // Count followers
    useEffect(() => {
        if (!id) return;
        (async () => {
            const all = await getDocs(collection(firestore, 'users'));
            setFollowerCount(
                all.docs.filter(
                    (d) => Array.isArray(d.data().following) && d.data().following.includes(id),
                ).length,
            );
        })();
    }, [id]);

    if (!id) return <div className="p-4">No user id provided.</div>;

    // ✅ Skeleton while profile is loading (prevents "Loading..." flash)
    if (profileLoading) return <ProfileSkeleton />;

    if (!userData) return <div className="p-4">Fant ikke bruker.</div>;

    const isOwner = auth.currentUser?.uid === id;
    const displayedRecipes = activeTab === 'myRecipes' ? userRecipes : userLikedRecipes;

    return (
        <div className="md:w-1/2 w-full mx-auto p-4">
            {/* Header with avatar, name, followers, and logout/follow buttons */}
            <div className="md:flex justify-between items-center">
                <div className="flex items-center">
                    {userData.photoURL && (
                        <img src={userData.photoURL} alt="User Avatar" className="h-16 w-16 rounded-full mr-4" />
                    )}
                    <div>
                        <h1 className="text-3xl font-semibold text-slate-900">
                            {userData.name || 'User Profile'}
                        </h1>
                        <p className="text-sm text-slate-500">{followerCount} følgere</p>
                    </div>
                </div>

                {isOwner && (
                    <Button onClick={logout} className="mt-4 md:mt-0">
                        Logg ut
                    </Button>
                )}

                {!isOwner && auth.currentUser && (
                    <Button
                        onClick={async () => {
                            const meRef = doc(firestore, 'users', auth.currentUser!.uid);
                            await updateDoc(meRef, {
                                following: isFollowing ? arrayRemove(id) : arrayUnion(id),
                            });
                            setIsFollowing(!isFollowing);
                        }}
                        className="mt-4 md:mt-0"
                    >
                        {isFollowing ? 'Slutt å følge' : 'Følg'}
                    </Button>
                )}
            </div>

            {/* Tab controls */}
            <div className="relative inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 mt-6">
                <div
                    className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                    style={{
                        transform: activeTab === 'likedRecipes' ? 'translateX(100%)' : 'translateX(0)',
                    }}
                />
                <Button
                    onClick={() => setActiveTab('myRecipes')}
                    variant="ghost"
                    className={`relative px-6 py-1 w-1/2 focus:outline-none ${
                        activeTab === 'myRecipes' ? 'text-slate-900' : 'text-slate-500'
                    }`}
                >
                    Oppskrifter
                </Button>
                <Button
                    onClick={() => setActiveTab('likedRecipes')}
                    variant="ghost"
                    className={`relative px-8 py-1 w-1/2 focus:outline-none ${
                        activeTab === 'likedRecipes' ? 'text-slate-900' : 'text-slate-500'
                    }`}
                >
                    Likte
                </Button>
            </div>

            {/* Recipe list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {displayedRecipes.length === 0 ? (
                    <div>
                        <p className="text-slate-600">Ingen oppskrifter funnet.</p>
                        {isOwner && activeTab === 'myRecipes' && (
                            <Button
                                onClick={() => router.push('/create-recipe')}
                                className="mt-4"
                            >
                                Lag ny oppskrift
                            </Button>
                        )}
                    </div>
                ) : (
                    displayedRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            isOwner={isOwner && activeTab === 'myRecipes'}
                            creator={activeTab === 'myRecipes' ? userData : recipe.creator}
                            onDelete={(rid) => {
                                setPendingDeleteId(rid);
                                setShowConfirm(true);
                            }}
                        />
                    ))
                )}
            </div>

            {/* Delete confirmation */}
            {showConfirm && pendingDeleteId && (
                <div className="fixed inset-0 bg-slate-900/30 flex justify-center items-center z-50">
                    <div className="p-6 rounded-2xl max-w-sm w-full bg-white border border-slate-200 shadow-xl">
                        <h1 className="text-2xl font-semibold mb-4 text-slate-900">
                            Vil du slette denne oppskriften?
                        </h1>
                        <p className="text-slate-600">Var den ikke noe god?</p>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button
                                onClick={() => {
                                    setShowConfirm(false);
                                    setPendingDeleteId(null);
                                }}
                            >
                                Avbryt
                            </Button>
                            <Button
                                onClick={async () => {
                                    await deleteDoc(doc(firestore, 'recipes', pendingDeleteId));
                                    setShowConfirm(false);
                                    setPendingDeleteId(null);
                                }}
                            >
                                Slett
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
