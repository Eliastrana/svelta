'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UserProfileDisplay from '@/app/components/UserProfileDisplay';
import UserSearchModal from '@/app/components/UserSearchModal';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';

const Navbar = () => {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="flex justify-between items-center ">
            {/* Navigation brand */}
            <div className="flex items-center ">
                <h1
                    className="text-4xl font-bold cursor-pointer ml-4"
                    onClick={() => router.push('/')}
                >
                    Cooked
                </h1>
            </div>

            <div className="flex items-center space-x-4">
                <h2
                    onClick={() => {
                        if (user) {
                            router.push('/create-recipe');
                        } else {
                            alert(
                                'Du må være innlogget for å lage en oppskrift.'
                            );
                        }
                    }}
                    className={`cursor-pointer ${!user ? 'opacity-50 pointer-events-none' : ''}`}
                >
                    <span className="material-symbols-outlined">
                        outdoor_grill
                    </span>
                </h2>

                <h2
                    onClick={() => {
                        if (user) {
                            setShowModal(true);
                        } else {
                            alert(
                                'Du må være innlogget for å søke etter brukere.'
                            );
                        }
                    }}
                    className={`cursor-pointer ${!user ? 'opacity-50 pointer-events-none' : ''}`}
                >
                    <span className="material-symbols-outlined">
                        person_add
                    </span>
                </h2>

                <div
                    onClick={() => {
                        if (user) {
                            router.push(`/user/${user.uid}`);
                        }
                    }}
                    className="cursor-pointer"
                >
                    <UserProfileDisplay />
                </div>
            </div>

            {showModal && (
                <UserSearchModal onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

export default Navbar;
