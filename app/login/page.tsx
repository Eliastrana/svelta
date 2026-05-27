// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/firebase';
import { ensureUserDocument } from '@/helpers/ensureUserDocument';

function getSafeNextPath(): string {
    if (typeof window === 'undefined') return '/';

    const sp = new URLSearchParams(window.location.search);
    const next = sp.get('next') || '/';

    if (!next.startsWith('/')) return '/';
    if (next.startsWith('/login')) return '/';

    return next;
}

export default function LoginPage() {
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) window.location.replace(getSafeNextPath());
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.cookie.includes('yourAuthToken=')) {
            window.location.replace(getSafeNextPath());
        }
    }, []);

    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            await ensureUserDocument(result.user);
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

            window.location.href = getSafeNextPath();
        } catch (error) {
            console.error('Error during sign in', error);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden flex items-center justify-center md:p-40 p-4">
            {/* Background gradient / glow */}
            <div className="absolute inset-0 -z-10">
                {/* base */}
                <div className="absolute inset-0 bg-[#fbfaf7]" />

                {/* bigger, less subtle sand glows */}
                <div
                    className="absolute -top-56 -left-56 h-[760px] w-[760px] rounded-full blur-3xl opacity-90
          bg-gradient-to-br from-stone-200 via-amber-100 to-transparent"
                />
                <div
                    className="absolute -bottom-72 -right-72 h-[920px] w-[920px] rounded-full blur-3xl opacity-90
          bg-gradient-to-tr from-amber-100 via-stone-200 to-transparent"
                />
                <div
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[620px] w-[620px] rounded-full blur-3xl opacity-80
          bg-gradient-to-br from-stone-100 via-amber-50 to-transparent"
                />

                {/* stronger sweep */}
                <div className="absolute inset-0 opacity-80 bg-gradient-to-b from-white/60 via-transparent to-white/70" />

                {/* slightly stronger vignette */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(2,6,23,0.08)_100%)]" />
            </div>

            {/* Content */}
            <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
                <h1 className="md:text-8xl text-5xl font-bold mb-8 text-neutral-700">
                    Del dine beste oppskrifter
                </h1>

                <button
                    onClick={signIn}
                    className="rounded-full px-6 py-2 font-semibold text-white shadow-lg
          bg-gradient-to-r from-stone-700 via-stone-800 to-stone-700
          hover:opacity-95 active:scale-[0.99] transition hover:cursor-pointer"
                >
                    Logg inn
                </button>
            </div>
        </div>
    );
}
