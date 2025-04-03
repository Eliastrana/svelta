"use client";
import { useState, useEffect } from "react";
import {
    doc,
    getDoc,
    deleteDoc,
    setDoc,
    onSnapshot,
    collection,
    serverTimestamp,
    getDocs
} from "firebase/firestore";
import { auth, firestore } from "@/firebase";

interface LikedUser {
    userId: string;
    name?: string;
    photoURL?: string;
}

interface LikedUsersModalProps {
    recipeId: string;
    onClose: () => void;
}

const LikedUsersModal: React.FC<LikedUsersModalProps> = ({ recipeId, onClose }) => {
    const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);

    useEffect(() => {
        const fetchLikedUsers = async () => {
            const likesCollectionRef = collection(firestore, "recipes", recipeId, "likes");
            const querySnapshot = await getDocs(likesCollectionRef);
            const promises = querySnapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const userId = data.userId;
                // Fetch additional user info from the "users" collection
                const userDocRef = doc(firestore, "users", userId);
                const userDocSnap = await getDoc(userDocRef);
                let userData: Partial<LikedUser> = {};
                if (userDocSnap.exists()) {
                    const docData = userDocSnap.data();
                    userData = {
                        name: docData.name,
                        photoURL: docData.photoURL,
                    };
                }
                return { userId, ...userData };
            });
            const results = await Promise.all(promises);
            setLikedUsers(results);
        };

        fetchLikedUsers();
    }, [recipeId]);

    return (
        <div className=" dark-purple-bg fixed inset-0 flex items-center justify-center  z-50">
            <div className="dark-purple-bg white-text p-4 rounded-lg md:max-w-md m-2 w-full">
                <h2 className="text-xl  mb-4">Hvem som har tatt av seg hatten:</h2>
                <ul>
                    {likedUsers.length > 0 ? (
                        likedUsers.map((user) => (
                            <li key={user.userId} className="mb-2 flex items-center space-x-2">
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt={user.name || "User"}
                                        className="w-8 h-8 rounded-full"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-400" />
                                )}
                                <span>{user.name || user.userId}</span>
                            </li>
                        ))
                    ) : (
                        <p>Ingen har likt denne oppskriften ennå.</p>
                    )}
                </ul>
                <button onClick={onClose} className="mt-4 px-4 py-2 confirm-button text-white rounded">
                    Lukk
                </button>
            </div>
        </div>
    );
};

interface LikeButtonProps {
    recipeId: string;
}

const LikeButton: React.FC<LikeButtonProps> = ({ recipeId }) => {
    const [likeCount, setLikeCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const currentUser = auth.currentUser;

    // Listen to the likes subcollection for real-time updates
    useEffect(() => {
        const likesCollectionRef = collection(firestore, "recipes", recipeId, "likes");
        const unsubscribe = onSnapshot(likesCollectionRef, (snapshot) => {
            setLikeCount(snapshot.size);
            if (currentUser) {
                const userLiked = snapshot.docs.some(doc => doc.id === currentUser.uid);
                setHasLiked(userLiked);
            }
        });
        return () => unsubscribe();
    }, [recipeId, currentUser]);

    const handleLikeToggle = async () => {
        if (!currentUser) {
            alert("Please sign in to like a recipe.");
            return;
        }
        const likeDocRef = doc(firestore, "recipes", recipeId, "likes", currentUser.uid);
        const likeDocSnap = await getDoc(likeDocRef);

        if (likeDocSnap.exists()) {
            // User already liked the recipe – remove the like
            await deleteDoc(likeDocRef);
        } else {
            // Add a new like with the user's UID as the document ID
            await setDoc(likeDocRef, {
                userId: currentUser.uid,
                createdAt: serverTimestamp(),
            });
        }
    };

    return (
        <div className="flex items-center space-x-2 ">
            <button onClick={handleLikeToggle} className="flex items-center space-x-2">
        <span className="h-8 w-8">
          {hasLiked ? (
              <img src="/icons/chef_black.png" alt="liked" />
          ) : (
              <img src="/icons/chef.png" alt="not liked" />
          )}
        </span>
                <span className="text-4xl">{likeCount}</span>
            </button>
            {/* Button to open modal with list of users who liked */}
            <button onClick={() => setShowModal(true)} className="text-base underline">
                tok av seg hatten
            </button>
            {showModal && <LikedUsersModal recipeId={recipeId} onClose={() => setShowModal(false)} />}
        </div>
    );
};

export default LikeButton;
