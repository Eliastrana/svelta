'use client';

import { useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, provider } from '@/firebase';

export default function LoginPage() {
    // If already signed in, do a full redirect off /login
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                window.location.href = '/';
            }
        });
        return unsub;
    }, []);

    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken(true);

            document.cookie = [
                `yourAuthToken=${token}`,
                `Path=/`,
                `Max-Age=${60 * 60}`,    // 1 hour
                `SameSite=None`,         // allow it on client fetches
                `Secure`,                // required on HTTPS
            ].join('; ');

            // full reload so the middleware sees the cookie immediately
            window.location.href = '/';
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
                    className="confirm-button text-black font-bold py-2 px-4 rounded shadow-md transition duration-300"
                >
                    Logg inn med Google
                </button>
            </div>
        </div>
    );
}
