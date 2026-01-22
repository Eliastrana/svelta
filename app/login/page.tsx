// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/firebase';

export default function LoginPage() {
    // 1) On mount, if we already have the cookie, go home immediately:
    useEffect(() => {
        if (typeof document !== 'undefined' && document.cookie.includes('yourAuthToken=')) {
            window.location.href = '/';
        }
    }, []);

    // 2) Your existing sign-in flow, but make sure the cookie is set
    //    with SameSite=None; Secure so that client-side fetches carry it:
    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken(true);

            document.cookie = [
                `yourAuthToken=${token}`,
                `Path=/`,
                `Max-Age=${60 * 60}`,    // keep it 1 hour
                `SameSite=None`,         // crucial for client fetches to include it
                `Secure`,                // required on HTTPS
            ].join('; ');

            // full reload so the middleware sees the cookie
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
                    className="confirm-button text-white font-semibold py-2 px-5 rounded-full shadow-md transition duration-300"
                >
                    Logg inn med Google
                </button>
            </div>
        </div>
    );
}
