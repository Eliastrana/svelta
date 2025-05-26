"use client";
import React, { useState, useEffect } from "react";
import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    startAt,
    endAt,
    query,
    getDocs,
    orderBy,
} from "firebase/firestore";
import { auth, firestore } from "@/firebase";
import { User } from "firebase/auth";

interface UserData {
    name?: string;
    following?: string[];
}

interface UserSearchResult {
    uid: string;
    name: string;
}

interface UserSearchModalProps {
    onClose: () => void;
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({ onClose }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentFollowing, setCurrentFollowing] = useState<string[]>([]);
    const currentUser: User | null = auth.currentUser;

    /* ---------------- FETCH CURRENT FOLLOWING ---------------- */
    useEffect(() => {
        const fetchCurrentUserFollowing = async () => {
            if (!currentUser) return;
            const userDocRef = doc(firestore, "users", currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserData;
                setCurrentFollowing(data.following || []);
            }
        };
        fetchCurrentUserFollowing();
    }, [currentUser]);

    /* ---------------- SEARCH LOGIC ---------------- */
    useEffect(() => {
        // Skip querying until the user has typed at least 3 non-space characters
        if (searchTerm.trim().length < 3) {
            setResults([]);
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            setLoading(true);
            try {
                const usersRef = collection(firestore, "users");
                const q = query(
                    usersRef,
                    orderBy("name"),
                    startAt(searchTerm),
                    endAt(searchTerm + "\uf8ff")
                );

                const querySnapshot = await getDocs(q);
                const users: UserSearchResult[] = [];
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data() as UserData;
                    users.push({
                        uid: docSnap.id,
                        name: data.name || "Unnamed User",
                    });
                });
                setResults(users);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
            setLoading(false);
        };

        fetchUsers();
    }, [searchTerm]);

    /* ---------------- FOLLOW / UNFOLLOW ---------------- */
    const handleFollow = async (targetUid: string) => {
        if (!currentUser) {
            alert("Please log in to follow users.");
            return;
        }

        const currentUserRef = doc(firestore, "users", currentUser.uid);
        try {
            if (currentFollowing.includes(targetUid)) {
                await updateDoc(currentUserRef, { following: arrayRemove(targetUid) });
                setCurrentFollowing((prev) => prev.filter((uid) => uid !== targetUid));
            } else {
                await updateDoc(currentUserRef, { following: arrayUnion(targetUid) });
                setCurrentFollowing((prev) => [...prev, targetUid]);
            }
        } catch (err) {
            console.error("Error updating following:", err);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={onClose}
        >
            <div
                    className="relative   w-[90vw] max-w-md z-50
                    p-4 rounded-2xl shadow-xl backdrop-blur
                    bg-[#2a2a2a]/90
                    border border-slate-600"

                onClick={(e) => e.stopPropagation()}
            >
                {/* Inner content */}
                <div className="relative">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Søk etter kokker</h2>
                        <button
                            onClick={onClose}
                            className="cursor-pointer text-2xl leading-none"
                            aria-label="Lukk"
                        >
                            &times;
                        </button>
                    </div>

                    {/* Search input */}
                    <input
                        type="text"
                        placeholder="Søk etter navn..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 rounded mb-4 bg-white/20 backdrop-blur-sm focus:outline-none"
                    />

                    {/* Results list */}
                    {loading ? (
                        <p>Laster…</p>
                    ) : (
                        <div className="max-h-60 overflow-y-auto">
                            {searchTerm.trim().length < 3 ? (
                                <p>Søk etter vennene dine, hvis du har noen 🙄</p>
                            ) : results.length === 0 ? (
                                <p>Ingen kokker funnet.</p>
                            ) : (
                                results.map((user) => (
                                    <div
                                        key={user.uid}
                                        className="flex items-center justify-between py-2"
                                    >
                                        <span>{user.name}</span>
                                        {currentUser && currentUser.uid === user.uid ? (
                                            <span className="text-sm">Deg</span>
                                        ) : (
                                            <button
                                                onClick={() => handleFollow(user.uid)}
                                                className="px-3 py-1 rounded text-sm cursor-pointer"
                                            >
                                                {currentFollowing.includes(user.uid) ? (
                                                    <span className="material-symbols-outlined">close</span>
                                                ) : (
                                                    <span className="material-symbols-outlined">add</span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserSearchModal;
