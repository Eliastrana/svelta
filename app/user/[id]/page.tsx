'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
import { User, signOut } from 'firebase/auth';
import { useUserRecipes } from '@/hooks/useUserRecipes';
import RecipeCard from '@/app/components/RecipeCard';

interface UserData {
    name?: string;
    following?: string[];
    photoURL?: string;
}

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

auth.onAuthStateChanged(async (user) => {
    if (user) {
        await createUserDocumentIfNotExists(user);
    }
});

const logout = async () => {
    try {
        await signOut(auth);
        window.location.href = '/login';
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

const UserProfile = () => {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const userRecipes = useUserRecipes(id || '');

    const [userData, setUserData] = useState<UserData | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchUser = async () => {
            const userDocRef = doc(firestore, 'users', id);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                setUserData(userSnap.data() as UserData);
            } else {
                setUserData(null);
            }
        };
        fetchUser();

        if (auth.currentUser) {
            const currentUserRef = doc(
                firestore,
                'users',
                auth.currentUser.uid
            );
            getDoc(currentUserRef).then((docSnap) => {
                if (docSnap.exists()) {
                    const currentData = docSnap.data() as UserData;
                    const following = currentData.following || [];
                    setIsFollowing(following.includes(id));
                }
            });
        }
    }, [id]);

    const handleFollow = async () => {
        if (!auth.currentUser) return;
        const currentUserRef = doc(firestore, 'users', auth.currentUser.uid);
        try {
            if (isFollowing) {
                await updateDoc(currentUserRef, {
                    following: arrayRemove(id),
                });
                setIsFollowing(false);
            } else {
                await updateDoc(currentUserRef, {
                    following: arrayUnion(id),
                });
                setIsFollowing(true);
            }
        } catch (error) {
            console.error('Error updating following:', error);
        }
    };

    const [followerCount, setFollowerCount] = useState<number>(0);

    useEffect(() => {
        if (!id) return;
        const fetchFollowers = async () => {
            const usersRef = collection(firestore, 'users');
            const snapshot = await getDocs(usersRef);
            const followers = snapshot.docs.filter((docSnap) => {
                const data = docSnap.data();
                return (
                    data.following &&
                    Array.isArray(data.following) &&
                    data.following.includes(id)
                );
            });
            setFollowerCount(followers.length);
        };
        fetchFollowers();
    }, [id]);

    if (!id) return <div className="p-4">No user id provided.</div>;
    if (!userData) return <div className="p-4">Loading...</div>;

    const isOwner = auth.currentUser?.uid === id;

    // Instead of directly deleting, we show a confirmation modal.
    const handleDeleteRecipe = (recipeId: string) => {
        setPendingDeleteId(recipeId);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        try {
            await deleteDoc(doc(firestore, 'recipes', pendingDeleteId));
            // Optionally update local state or refetch recipes.
            setShowConfirm(false);
            setPendingDeleteId(null);
        } catch (error) {
            console.error('Error deleting recipe:', error);
        }
    };

    const cancelDelete = () => {
        setShowConfirm(false);
        setPendingDeleteId(null);
    };

    return (
        <div className="md:w-1/2 w-full mx-auto p-4">
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
                        <h1 className="text-4xl font-bold">
                            {userData.name || 'User Profile'}
                        </h1>
                        <p className="text-lg">{followerCount} følgere</p>
                    </div>
                </div>
                {isOwner && (
                    <button
                        className="confirm-button mt-4 md:mt-0 p-2 rounded-lg cursor-pointer hover:underline md:ml-4"
                        onClick={logout}
                    >
                        Logg ut
                    </button>
                )}
                {auth.currentUser && auth.currentUser.uid !== id && (
                    <button
                        onClick={handleFollow}
                        className="mt-4 md:mt-0 confirm-button py-2 px-4 rounded"
                    >
                        {isFollowing ? 'Slutt å følge' : 'Følg'}
                    </button>
                )}
            </div>
            <h1 className="text-xl font-bold mt-8">Mine oppskrifter</h1>
            <div className="grid grid-cols-1 gap-4 mt-4">
                {userRecipes.length === 0 ? (
                    <div>
                        <p>Ingen oppskrifter funnet.</p>
                        {isOwner && (
                            <button
                                className="confirm-button py-2 px-4 rounded mt-4"
                                onClick={() =>
                                    (window.location.href = '/create-recipe')
                                }
                            >
                                Lag ny oppskrift
                            </button>
                        )}
                    </div>
                ) : (
                    userRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            isOwner={isOwner}
                            creator={userData}
                            onDelete={handleDeleteRecipe}
                        />
                    ))
                )}
            </div>
            {/* Confirmation Modal for Deletion */}
            {showConfirm && (
                <div className="fixed inset-0 dark-purple-bg flex justify-center items-center z-50 white-text">
                    <div className=" p-6 rounded-lg max-w-sm w-full">
                        <h1 className="text-4xl font-semibold mb-4">
                            Vil du slette denne oppskriften?
                        </h1>
                        <p>Var den ikke noe god?</p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={cancelDelete}
                                className="confirm-button px-4 py-2 rounded-lg"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
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
