'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    createUserWithEmailAndPassword,
    getRedirectResult,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    updateProfile,
    User,
} from 'firebase/auth';
import { auth, provider } from '@/firebase';
import { ensureUserDocument } from '@/helpers/ensureUserDocument';

type AuthMode = 'signin' | 'signup';

function getSafeNextPath(): string {
    if (typeof window === 'undefined') return '/';

    const sp = new URLSearchParams(window.location.search);
    const next = sp.get('next') || '/';

    if (!next.startsWith('/')) return '/';
    if (next.startsWith('/login')) return '/';

    return next;
}

function shouldPreferPopup(): boolean {
    if (typeof window === 'undefined') return false;

    return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'http:'
    );
}

async function persistSession(token: string) {
    try {
        const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            console.error('Could not persist auth session cookie');
        }
    } catch (error) {
        console.error('Error storing auth session cookie', error);
    }
}

async function finishLogin(user: User) {
    await ensureUserDocument(user);
    const token = await user.getIdToken(true);
    await persistSession(token);
    window.location.replace(getSafeNextPath());
}

export default function LoginPage() {
    const [mode, setMode] = useState<AuthMode>('signin');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [authResolving, setAuthResolving] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);
    const loginCompletedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        async function handleRedirectResult() {
            try {
                const result = await getRedirectResult(auth);

                if (!cancelled && result?.user) {
                    loginCompletedRef.current = true;
                    await finishLogin(result.user);
                }
            } catch (error) {
                console.error('Error handling redirect result', error);
                setLoading(false);
            } finally {
                if (!cancelled) {
                    setAuthResolving(false);
                }
            }
        }

        void handleRedirectResult();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setAuthResolving(false);
                return;
            }

            if (loginCompletedRef.current) return;

            try {
                loginCompletedRef.current = true;
                await finishLogin(user);
            } catch (error) {
                console.error('Error finalizing login', error);
                window.location.replace('/');
            }
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        if (document.cookie.includes('yourAuthToken=')) {
            window.location.replace(getSafeNextPath());
        }
    }, []);

    useEffect(() => {
        setFormError(null);
    }, [mode]);

    const isSignup = mode === 'signup';

    const submitLabel = useMemo(() => {
        if (loading) return isSignup ? 'Oppretter konto…' : 'Logger inn…';
        return isSignup ? 'Opprett konto' : 'Logg inn';
    }, [isSignup, loading]);

    const handleGoogleAuth = async () => {
        try {
            setLoading(true);
            setFormError(null);

            if (shouldPreferPopup()) {
                try {
                    loginCompletedRef.current = true;
                    const result = await signInWithPopup(auth, provider);
                    await finishLogin(result.user);
                    return;
                } catch (error) {
                    loginCompletedRef.current = false;
                    console.error('Popup sign-in failed, falling back to redirect', error);
                }
            }

            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.error('Error during sign in', error);
            setFormError('Kunne ikke starte Google-innlogging.');
            setLoading(false);
        }
    };

    const handleCredentialsAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);

        const trimmedEmail = email.trim();
        const trimmedName = name.trim();

        if (!trimmedEmail || !password) {
            setFormError('Fyll inn e-post og passord.');
            return;
        }

        if (isSignup) {
            if (!trimmedName) {
                setFormError('Fyll inn navn.');
                return;
            }

            if (password.length < 6) {
                setFormError('Passordet må være minst 6 tegn.');
                return;
            }

            if (password !== confirmPassword) {
                setFormError('Passordene er ikke like.');
                return;
            }
        }

        try {
            setLoading(true);

            if (isSignup) {
                loginCompletedRef.current = true;
                const result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
                await updateProfile(result.user, { displayName: trimmedName });
                await finishLogin(result.user);
                return;
            }

            loginCompletedRef.current = true;
            const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
            await finishLogin(result.user);
        } catch (error) {
            console.error('Error during email auth', error);
            loginCompletedRef.current = false;

            const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

            if (code.includes('auth/email-already-in-use')) {
                setFormError('Denne e-posten er allerede i bruk.');
            } else if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
                setFormError('Ugyldig e-post eller passord.');
            } else if (code.includes('auth/invalid-email')) {
                setFormError('E-postadressen er ugyldig.');
            } else if (code.includes('auth/weak-password')) {
                setFormError('Passordet er for svakt.');
            } else {
                setFormError('Kunne ikke fullføre innloggingen akkurat nå.');
            }

            setLoading(false);
        }
    };

    if (authResolving || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-4">
                <div className="flex flex-col items-center gap-4 text-center text-neutral-700">
                    <div>
                        <p className="text-2xl font-semibold">Svelta</p>
                        <p className="mt-1 text-sm text-neutral-500">
                            {loading ? 'Gjør klar kontoen din…' : 'Logger deg inn…'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fbfaf7] px-4 py-8 md:px-8 md:py-12">
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
                <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-[#e5dfd1] bg-white shadow-[0_20px_70px_rgba(40,37,29,0.08)] transition-all duration-300 ease-out">
                    <div className="p-5 sm:p-7 md:p-10">
                        <div className="mx-auto max-w-md">
                            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#201d17]">
                                {isSignup ? 'Opprett konto' : 'Logg inn'}
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b665b]">
                                {isSignup
                                    ? 'Lag en konto med e-post eller bruk Google.'
                                    : 'Fortsett med e-post eller bruk Google.'}
                            </p>

                            <div className="mt-6 inline-flex w-full rounded-full border border-[#ded8ca] bg-[#f6f3ea] p-1">
                                <button
                                    type="button"
                                    onClick={() => setMode('signin')}
                                    className={[
                                        'flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition',
                                        mode === 'signin' ? 'bg-white text-[#201d17] shadow-sm' : 'text-[#6b665b]',
                                    ].join(' ')}
                                >
                                    Logg inn
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('signup')}
                                    className={[
                                        'flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition',
                                        mode === 'signup' ? 'bg-white text-[#201d17] shadow-sm' : 'text-[#6b665b]',
                                    ].join(' ')}
                                >
                                    Opprett konto
                                </button>
                            </div>

                            <form onSubmit={handleCredentialsAuth} className="mt-6 space-y-4">
                                <div
                                    className={[
                                        'grid transition-all duration-300 ease-out',
                                        isSignup ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                                    ].join(' ')}
                                >
                                    <div className="overflow-hidden">
                                        <label className="mb-4 block">
                                            <span className="mb-2 block text-sm font-medium text-[#2e2a23]">Navn</span>
                                            <input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Ditt navn"
                                                className="w-full rounded-2xl border border-[#ddd6c8] bg-[#fbfaf5] px-4 py-3 text-[#201d17] outline-none transition placeholder:text-[#9a9385] focus:border-[#c8c0b1] focus:bg-white"
                                                autoComplete="name"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-medium text-[#2e2a23]">E-post</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="navn@epost.no"
                                        className="w-full rounded-2xl border border-[#ddd6c8] bg-[#fbfaf5] px-4 py-3 text-[#201d17] outline-none transition placeholder:text-[#9a9385] focus:border-[#c8c0b1] focus:bg-white"
                                        autoComplete="email"
                                    />
                                </label>

                                <label className="block">
                                    <span className="mb-2 block text-sm font-medium text-[#2e2a23]">Passord</span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={isSignup ? 'Minst 6 tegn' : 'Passord'}
                                        className="w-full rounded-2xl border border-[#ddd6c8] bg-[#fbfaf5] px-4 py-3 text-[#201d17] outline-none transition placeholder:text-[#9a9385] focus:border-[#c8c0b1] focus:bg-white"
                                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                                    />
                                </label>

                                <div
                                    className={[
                                        'grid transition-all duration-300 ease-out',
                                        isSignup ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                                    ].join(' ')}
                                >
                                    <div className="overflow-hidden">
                                        <label className="block">
                                            <span className="mb-2 block text-sm font-medium text-[#2e2a23]">Gjenta passord</span>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Gjenta passord"
                                                className="w-full rounded-2xl border border-[#ddd6c8] bg-[#fbfaf5] px-4 py-3 text-[#201d17] outline-none transition placeholder:text-[#9a9385] focus:border-[#c8c0b1] focus:bg-white"
                                                autoComplete="new-password"
                                            />
                                        </label>
                                    </div>
                                </div>

                                {formError ? (
                                    <div className="rounded-2xl border border-[#f1c6c0] bg-[#fff1ef] px-4 py-3 text-sm text-[#8a3328]">
                                        {formError}
                                    </div>
                                ) : null}

                                <button
                                    type="submit"
                                    disabled={loading || authResolving}
                                    className="w-full rounded-full bg-[#201d17] px-6 py-3 font-semibold text-white transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitLabel}
                                </button>
                            </form>

                            <div className="my-6 flex items-center gap-3 text-sm text-[#8a8377]">
                                <div className="h-px flex-1 bg-[#e4ded0]" />
                                <span>Eller</span>
                                <div className="h-px flex-1 bg-[#e4ded0]" />
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleAuth}
                                disabled={loading || authResolving}
                                className="flex w-full items-center justify-center gap-3 rounded-full border border-[#ddd6c8] bg-[#fbfaf5] px-6 py-3 font-semibold text-[#201d17] transition hover:border-[#cfc7b7] hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="text-lg">G</span>
                                Fortsett med Google
                            </button>

                            <p className="mt-6 text-center text-sm text-[#7a7468]">
                                {isSignup ? 'Har du allerede konto?' : 'Har du ikke konto ennå?'}{' '}
                                <button
                                    type="button"
                                    onClick={() => setMode(isSignup ? 'signin' : 'signup')}
                                    className="font-semibold text-[#201d17] underline underline-offset-4"
                                >
                                    {isSignup ? 'Logg inn' : 'Opprett konto'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
