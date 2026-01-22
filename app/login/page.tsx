// app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {

    const router = useRouter();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) router.replace('/');
        });
        return () => unsub();
    }, [router]);

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

            const isLocalhost =
                typeof window !== 'undefined' &&
                window.location.hostname === 'localhost';

            document.cookie = [
                `yourAuthToken=${token}`,
                `Path=/`,
                `Max-Age=${60 * 60}`,
                isLocalhost ? `SameSite=Lax` : `SameSite=None`,
                isLocalhost ? `` : `Secure`,
            ].filter(Boolean).join('; ');

            // full reload so the middleware sees the cookie
            window.location.href = '/';
        } catch (error) {
            console.error('Error during sign in', error);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden flex items-center justify-center md:p-40 p-4">
            {/* Background gradient / glow */}
            <div className="absolute inset-0 -z-10">
                {/* base */}
                <div className="absolute inset-0 bg-slate-50" />

                {/* mesh gradients (light blue vibe) */}
                <div
                    className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full blur-3xl opacity-70
                   bg-gradient-to-br from-sky-300 via-cyan-200 to-transparent"
                />
                <div
                    className="absolute -bottom-28 -right-28 h-[520px] w-[520px] rounded-full blur-3xl opacity-70
                   bg-gradient-to-tr from-blue-200 via-sky-200 to-transparent"
                />

                {/* subtle sweep */}
                <div className="absolute inset-0 opacity-70 bg-gradient-to-b from-white/40 via-transparent to-white/60" />

                {/* soft vignette */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,6,23,0.06)_100%)]" />
            </div>

            {/* Content */}
            <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
                <h1 className="md:text-8xl text-5xl font-bold mb-8 text-cyan-400 ">
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
