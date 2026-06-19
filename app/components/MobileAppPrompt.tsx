'use client';

import { useEffect, useMemo, useState } from 'react';
import AppModal from '@/app/components/AppModal';

const SNOOZE_KEY = 'svelta-mobile-app-prompt-snooze-until';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
    if (typeof window === 'undefined') return false;

    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean })
            .standalone)
    );
}

function isMobileDevice() {
    if (typeof window === 'undefined') return false;

    const ua = window.navigator.userAgent;
    return /Android|iPhone|iPad|iPod/i.test(ua);
}

function isIosDevice() {
    if (typeof window === 'undefined') return false;

    return /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

function isSafariOnIos() {
    if (typeof window === 'undefined') return false;

    const ua = window.navigator.userAgent;
    return isIosDevice() && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export default function MobileAppPrompt() {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [standalone, setStandalone] = useState(false);
    const [installPrompt, setInstallPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        setMounted(true);
        setStandalone(isStandalone());

        const handleInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };

        const handleInstalled = () => {
            const nextStandalone = isStandalone();
            setStandalone(nextStandalone);
            setInstallPrompt(null);
            setOpen(false);
        };

        window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        window.addEventListener('appinstalled', handleInstalled);

        return () => {
            window.removeEventListener(
                'beforeinstallprompt',
                handleInstallPrompt
            );
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    const shouldAsk = useMemo(() => {
        if (!mounted || !isMobileDevice()) return false;

        const snoozeUntilRaw =
            typeof window !== 'undefined'
                ? window.localStorage.getItem(SNOOZE_KEY)
                : null;
        const snoozeUntil = snoozeUntilRaw ? Number(snoozeUntilRaw) : 0;
        if (snoozeUntil > Date.now()) return false;

        return !standalone;
    }, [mounted, standalone]);

    useEffect(() => {
        if (shouldAsk) setOpen(true);
    }, [shouldAsk]);

    const handleSnooze = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(
                SNOOZE_KEY,
                String(Date.now() + SNOOZE_MS)
            );
        }

        setOpen(false);
    };

    const handleInstallClick = async () => {
        if (!installPrompt) return;

        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;

        if (choice.outcome === 'accepted') {
            setInstallPrompt(null);
            const nextStandalone = isStandalone();
            setStandalone(nextStandalone);
            setOpen(false);
        }
    };

    if (!open || !mounted) return null;

    return (
        <AppModal onClose={handleSnooze} closeOnOverlayClick={false}>
            {({ closeWithAnim, closing }) => (
                <div className="overflow-hidden">
                    <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
                        <button
                            type="button"
                            onClick={handleSnooze}
                            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                            aria-label="Lukk"
                            disabled={closing}
                        >
                            <span className="material-symbols-outlined">
                                close
                            </span>
                        </button>

                        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                            Legg Svelta pa hjemskjermen
                        </h2>
                        <p className="mt-1 pr-10 text-sm text-slate-500">
                            Da apner Svelta raskere fra mobilen, og du far en
                            mer app-lignende opplevelse. Varsler kan du skru pa
                            senere i profilinnstillingene.
                        </p>
                    </div>

                    <div className="px-5 py-5">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex items-start gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
                                    <span className="material-symbols-outlined text-[20px]">
                                        add_to_home_screen
                                    </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900">
                                        Hjemskjerm
                                    </p>

                                    {standalone ? (
                                        <p className="mt-1 text-sm text-slate-500">
                                            Svelta er allerede lagt til pa
                                            hjemskjermen.
                                        </p>
                                    ) : installPrompt ? (
                                        <>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Legg til Svelta som en app
                                                direkte fra nettleseren.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleInstallClick()
                                                }
                                                className="mt-4 rounded-full bg-[#12340d] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99]"
                                            >
                                                Legg til pa hjemskjermen
                                            </button>
                                        </>
                                    ) : isSafariOnIos() ? (
                                        <p className="mt-1 text-sm text-slate-500">
                                            Trykk delingsikonet i Safari og velg{' '}
                                            &quot;Legg til pa Hjem-skjerm&quot;.
                                        </p>
                                    ) : isIosDevice() ? (
                                        <p className="mt-1 text-sm text-slate-500">
                                            Apne siden i Safari for a kunne
                                            legge den til pa hjemskjermen.
                                        </p>
                                    ) : (
                                        <p className="mt-1 text-sm text-slate-500">
                                            Bruk nettlesermenyen og velg
                                            &quot;Installer app&quot; eller
                                            &quot;Legg til pa hjemskjermen&quot;
                                            hvis knappen ikke vises.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-white px-5 py-4">
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={handleSnooze}
                                className="w-full rounded-full bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 sm:w-auto"
                            >
                                Ikke na
                            </button>
                            <button
                                type="button"
                                onClick={closeWithAnim}
                                disabled={closing}
                                className="brown-button w-full rounded-full px-5 py-2.5 font-semibold shadow-sm transition hover:opacity-95 active:scale-95 sm:w-auto"
                            >
                                Fortsett
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppModal>
    );
}
