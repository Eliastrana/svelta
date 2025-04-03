'use client';
import { useState, useEffect } from 'react';
import { auth, firestore } from '@/firebase';
import {
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

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

const UserSearchModal = ({ onClose }: UserSearchModalProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentFollowing, setCurrentFollowing] = useState<string[]>([]);
    const currentUser = auth.currentUser;

    // Fetch the current user's following list from Firestore
    useEffect(() => {
        const fetchCurrentUserFollowing = async () => {
            if (!currentUser) return;
            const userDocRef = doc(firestore, 'users', currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserData;
                setCurrentFollowing(data.following || []);
            }
        };
        fetchCurrentUserFollowing();
    }, [currentUser]);

    // Fetch users based on the search term
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                let q;
                const usersRef = collection(firestore, 'users');
                if (searchTerm.trim() !== '') {
                    // Query for users whose names start with the searchTerm
                    q = query(
                        usersRef,
                        orderBy('name'),
                        startAt(searchTerm),
                        endAt(searchTerm + '\uf8ff')
                    );
                } else {
                    // If no search term, fetch all users (or you can add a limit)
                    q = query(usersRef, orderBy('name'));
                }
                const querySnapshot = await getDocs(q);
                const users: UserSearchResult[] = [];
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data() as UserData;
                    users.push({ uid: docSnap.id, name: data.name || 'Unnamed User' });
                });
                setResults(users);
            } catch (error) {
                console.error("Error fetching users: ", error);
            }
            setLoading(false);
        };

        fetchUsers();
    }, [searchTerm]);

    // Handle follow/unfollow action
    const handleFollow = async (targetUid: string) => {
        if (!currentUser) {
            alert('Please log in to follow users.');
            return;
        }
        const currentUserRef = doc(firestore, 'users', currentUser.uid);
        try {
            if (currentFollowing.includes(targetUid)) {
                await updateDoc(currentUserRef, {
                    following: arrayRemove(targetUid)
                });
                setCurrentFollowing(currentFollowing.filter(uid => uid !== targetUid));
            } else {
                await updateDoc(currentUserRef, {
                    following: arrayUnion(targetUid)
                });
                setCurrentFollowing([...currentFollowing, targetUid]);
            }
        } catch (error) {
            console.error("Error updating following: ", error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-[#121212] rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Søk etter kokker</h2>
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <input
                    type="text"
                    placeholder="Søk etter navn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded mb-4"
                />
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="max-h-60 overflow-y-auto">
                        {results.length === 0 ? (
                            <p>No users found.</p>
                        ) : (
                            results.map((user) => (
                                <div
                                    key={user.uid}
                                    className="flex items-center justify-between py-2"
                                >
                                    <span>{user.name}</span>
                                    {currentUser && currentUser.uid === user.uid ? (
                                        <span className="text-gray-500 text-sm">Deg</span>
                                    ) : (
                                        <button
                                            onClick={() => handleFollow(user.uid)}
                                            className="text-white px-3 py-1 rounded text-sm cursor-pointer"
                                        >
                                            {currentFollowing.includes(user.uid) ?
                                                <span className="material-symbols-outlined">
                                                    close
                                                </span>
                                                :
                                                <span className="material-symbols-outlined">
                                                    add
                                                </span>
                                            }
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserSearchModal;
