// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';      // ← App-Router import
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, provider } from '@/firebase';

export default function LoginPage() {
    const router = useRouter();

    // If Firebase already has a session, redirect immediately
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                router.replace('/');
            }
        });
        return unsubscribe;
    }, [router]);

    // Google Sign-In flow
    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken(true);

            // Persist for middleware checks
            document.cookie = `yourAuthToken=${token}; path=/;`;

            // Navigate home, replacing history
            router.replace('/');
        } catch (error) {
            console.error('Error during sign in', error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center md:p-40 p-4">
            <div>
                <h1 className="md:text-9xl text-5xl font-bold mb-8">
                    Del dine beste oppskrifter
                </h1>
                <button
                    onClick={signIn}
                    className="confirm-button text-black font-bold py-2 px-4 rounded cursor-pointer shadow-md transition duration-300 ease-in-out"
                >
                    Logg inn med Google
                </button>
            </div>
        </div>
    );
}
