"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp } from "firebase/firestore";
import { auth, firestore } from "@/firebase";

interface LikeButtonProps {
    recipeId: string;
}

const LikeButton: React.FC<LikeButtonProps> = ({ recipeId }) => {
    const [likeCount, setLikeCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const currentUser = auth.currentUser;

    // Listen to the likes subcollection
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
        <button onClick={handleLikeToggle} className="flex items-center space-x-2 text-4xl">
      <span className="h-8 w-8">
        {hasLiked ?
            <img src={"/icons/chef_black.png"}></img>
            :
            <img src={"/icons/chef.png"}></img>
            }
      </span>
            <span>{likeCount}</span>
        </button>
    );
};

export default LikeButton;
