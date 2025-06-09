// app/login/page.tsx
'use client';

import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/firebase';

export default function LoginPage() {
    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken(true);

            document.cookie = [
                `yourAuthToken=${token}`,
                `Path=/`,
                `Max-Age=${60 * 60}`,    // optional: keep it 1h
                `SameSite=None`,         // ensure it’s sent on client fetches
                `Secure`,                // required in production HTTPS
            ].join('; ');

            // full page load so the cookie is in the request headers
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
