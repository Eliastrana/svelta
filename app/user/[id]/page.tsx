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
        (async () => {
            const snap = await getDoc(doc(firestore, 'users', id));
            if (snap.exists()) setUserData(snap.data() as UserData);
            else setUserData(null);

            if (auth.currentUser) {
                const meSnap = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
                const following: string[] = meSnap.exists() ? (meSnap.data() as UserData).following || [] : [];
                setIsFollowing(following.includes(id));
            }
        })();
    }, [id]);

    // Count followers
    useEffect(() => {
        if (!id) return;
        (async () => {
            const all = await getDocs(collection(firestore, 'users'));
            setFollowerCount(
                all.docs.filter(d => Array.isArray(d.data().following) && d.data().following.includes(id)).length
            );
        })();
    }, [id]);

    if (!id) return <div className="p-4">No user id provided.</div>;
    if (!userData) return <div className="p-4">Loading...</div>;

    const isOwner = auth.currentUser?.uid === id;
    const displayedRecipes = activeTab === 'myRecipes' ? userRecipes : userLikedRecipes;

    return (
        <div className="md:w-1/2 w-full mx-auto p-4">
            {/* Header with avatar, name, followers, and logout/follow buttons */}
            <div className="md:flex justify-between items-center">
                <div className="flex items-center">
                    {userData.photoURL && (
                        <img
                            src={userData.photoURL}
                            alt="User Avatar"
                            className="h-16 w-16 rounded-full mr-4"
                        />
                    )}
                    <div>
                        <h1 className="text-3xl font-semibold text-slate-900">
                            {userData.name || 'User Profile'}
                        </h1>
                        <p className="text-sm text-slate-500">{followerCount} følgere</p>
                    </div>
                </div>

                {isOwner && (
                    <button
                        onClick={logout}
                        className="confirm-button mt-4 md:mt-0 px-4 py-2 rounded-full"
                    >
                        Logg ut
                    </button>
                )}

                {!isOwner && auth.currentUser && (
                    <button
                        onClick={async () => {
                            const meRef = doc(firestore, 'users', auth.currentUser!.uid);
                            await updateDoc(meRef, {
                                following: isFollowing
                                    ? arrayRemove(id)
                                    : arrayUnion(id),
                            });
                            setIsFollowing(!isFollowing);
                        }}
                        className="mt-4 md:mt-0 confirm-button py-2 px-4 rounded-full"
                    >
                        {isFollowing ? 'Slutt å følge' : 'Følg'}
                    </button>
                )}
            </div>

            {/* Tab controls */}
            <div className="relative inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 mt-6">
                <div
                    className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                    style={{
                        transform:
                            activeTab === 'likedRecipes'
                                ? 'translateX(100%)'
                                : 'translateX(0)',
                    }}
                />
                <button
                    onClick={() => setActiveTab('myRecipes')}
                    className={`relative px-6 py-1 w-1/2 text-sm font-medium focus:outline-none ${
                        activeTab === 'myRecipes'
                            ? 'text-slate-900'
                            : 'text-slate-500'
                    }`}
                >
                    Oppskrifter
                </button>
                <button
                    onClick={() => setActiveTab('likedRecipes')}
                    className={`relative px-8 py-1 w-1/2 text-sm font-medium focus:outline-none ${
                        activeTab === 'likedRecipes'
                            ? 'text-slate-900'
                            : 'text-slate-500'
                    }`}
                >
                    Likte
                </button>
            </div>

            {/* Recipe list */}
            <div className="grid grid-cols-1 gap-4 mt-4">
                {displayedRecipes.length === 0 ? (
                    <div>
                        <p className="text-slate-600">Ingen oppskrifter funnet.</p>
                        {isOwner && activeTab === 'myRecipes' && (
                            <button
                                onClick={() => router.push('/create-recipe')}
                                className="confirm-button py-2 px-4 rounded-full mt-4"
                            >
                                Lag ny oppskrift
                            </button>
                        )}
                    </div>
                ) : (
                    displayedRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            isOwner={isOwner && activeTab === 'myRecipes'}
                            creator={
                                activeTab === 'myRecipes' ? userData : recipe.creator
                            }
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
                            <button
                                onClick={() => {
                                    setShowConfirm(false);
                                    setPendingDeleteId(null);
                                }}
                                className="confirm-button px-4 py-2 rounded-full"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    await deleteDoc(
                                        doc(firestore, 'recipes', pendingDeleteId!)
                                    );
                                    setShowConfirm(false);
                                    setPendingDeleteId(null);
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full"
                            >
                                Slett
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
