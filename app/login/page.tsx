// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/firebase';

function getSafeNextPath(): string {
    if (typeof window === 'undefined') return '/';

    const sp = new URLSearchParams(window.location.search);
    const next = sp.get('next') || '/';

    // Prevent open redirects (only allow relative paths)
    if (!next.startsWith('/')) return '/';

    // Avoid loops
    if (next.startsWith('/login')) return '/';

    return next;
}

export default function LoginPage() {
    // If already authed (firebase session), go to next
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                const nextPath = getSafeNextPath();
                window.location.replace(nextPath);
            }
        });
        return () => unsub();
    }, []);

    // If cookie already exists, go to next immediately
    useEffect(() => {
        if (typeof document === 'undefined') return;

        if (document.cookie.includes('yourAuthToken=')) {
            const nextPath = getSafeNextPath();
            window.location.replace(nextPath);
        }
    }, []);

    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken(true);

            const isLocalhost =
                typeof window !== 'undefined' && window.location.hostname === 'localhost';

            document.cookie = [
                `yourAuthToken=${token}`,
                `Path=/`,
                `Max-Age=${60 * 60}`,
                isLocalhost ? `SameSite=Lax` : `SameSite=None`,
                isLocalhost ? `` : `Secure`,
            ]
                .filter(Boolean)
                .join('; ');

            // Full reload so middleware sees cookie + take user back to original page
            const nextPath = getSafeNextPath();
            window.location.href = nextPath;
        } catch (error) {
            console.error('Error during sign in', error);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden flex items-center justify-center md:p-40 p-4">
            {/* Background gradient / glow */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-slate-50" />
                <div
                    className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full blur-3xl opacity-70
          bg-gradient-to-br from-sky-300 via-cyan-200 to-transparent"
                />
                <div
                    className="absolute -bottom-28 -right-28 h-[520px] w-[520px] rounded-full blur-3xl opacity-70
          bg-gradient-to-tr from-blue-200 via-sky-200 to-transparent"
                />
                <div className="absolute inset-0 opacity-70 bg-gradient-to-b from-white/40 via-transparent to-white/60" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,6,23,0.06)_100%)]" />
            </div>

            {/* Content */}
            <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
                <h1 className="md:text-8xl text-5xl font-bold mb-8 text-neutral-700">
                    Del dine beste oppskrifter
                </h1>

                <button
                    onClick={signIn}
                    className="rounded-full px-6 py-2 font-semibold text-white shadow-lg
          bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-500
          hover:opacity-95 active:scale-[0.99] transition"
                >
                    Logg inn
                </button>
            </div>
        </div>
    );
}