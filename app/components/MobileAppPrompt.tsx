'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppModal from '@/app/components/AppModal';
import { useAuthUser } from '@/hooks/useAuthUser';
import { enablePushNotifications } from '@/helpers/pushNotifications';

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
    const router = useRouter();
    const pathname = usePathname();
    const user = useAuthUser();

    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [standalone, setStandalone] = useState(false);
    const [permission, setPermission] = useState<'default' | 'denied' | 'granted'>(
        'default'
    );
    const [installPrompt, setInstallPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [enablingNotifications, setEnablingNotifications] = useState(false);
    const [notificationError, setNotificationError] = useState<string>('');

    useEffect(() => {
        setMounted(true);
        setStandalone(isStandalone());

        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }

        const handleInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };

        const handleInstalled = () => {
            const nextStandalone = isStandalone();
            setStandalone(nextStandalone);
            setInstallPrompt(null);
            setOpen(Boolean(user) && permission !== 'granted');
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
    }, [permission, user]);

    const shouldAsk = useMemo(() => {
        if (!mounted || !isMobileDevice()) return false;

        const snoozeUntilRaw =
            typeof window !== 'undefined'
                ? window.localStorage.getItem(SNOOZE_KEY)
                : null;
        const snoozeUntil = snoozeUntilRaw ? Number(snoozeUntilRaw) : 0;
        if (snoozeUntil > Date.now()) return false;

        const needsInstall = !standalone;
        const needsNotifications = !!user && permission !== 'granted';

        return needsInstall || needsNotifications;
    }, [mounted, permission, standalone, user]);

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
            setOpen(Boolean(user) && permission !== 'granted');
        }
    };

    const handleEnableNotifications = async () => {
        if (!user) {
            router.push(`/login?next=${encodeURIComponent(pathname || '/')}`);
            return;
        }

        setEnablingNotifications(true);
        setNotificationError('');

        try {
            const result = await enablePushNotifications(user);

            if (!result.ok) {
                if (result.reason === 'missing-vapid-key') {
                    setNotificationError(
                        'Push-varsler er ikke ferdig konfigurert i miljoet ennå.'
                    );
                } else if (result.reason === 'permission-blocked') {
                    setPermission(Notification.permission);
                    setNotificationError(
                        'Varsler er blokkert i nettleseren. Apne innstillinger og tillat varsler for Svelta.'
                    );
                } else {
                    setNotificationError(
                        'Kunne ikke aktivere varsler pa denne enheten.'
                    );
                }

                return;
            }

            setPermission('granted');
            setOpen(!isStandalone());
        } catch (error) {
            console.error('Could not enable notifications:', error);
            setNotificationError('Noe gikk galt da varsler skulle aktiveres.');
        } finally {
            setEnablingNotifications(false);
        }
    };

    if (!open || !mounted) return null;

    return (
        <AppModal onClose={handleSnooze} closeOnOverlayClick={false}>
            {({ closeWithAnim, closing }) => (
                <div className="overflow-hidden">
                    <div className="border-b border-[#d8d7cb] bg-[#f7f2e7] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6f8068]">
                            Mobiloppsett
                        </p>
                        <h2 className="mt-2 text-2xl font-bold text-[#12340d]">
                            Legg Svelta pa hjemskjermen
                        </h2>
                        <p className="mt-2 text-sm text-[#36533a]">
                            Installer webappen for raskere apning, og skru pa
                            varsler sa du far med deg aktivitet rundt
                            oppskriftene dine.
                        </p>
                    </div>

                    <div className="space-y-4 p-5">
                        <section className="rounded-2xl border border-[#d8d7cb] bg-[#fbfaf4] p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-[#12340d]">
                                        Hjemskjerm
                                    </h3>
                                    <p className="mt-1 text-sm text-[#496444]">
                                        Apne Svelta som en app direkte fra
                                        mobilen.
                                    </p>
                                </div>
                                <span
                                    className={[
                                        'rounded-full px-2.5 py-1 text-xs font-semibold',
                                        standalone
                                            ? 'bg-[#dff0cd] text-[#24471d]'
                                            : 'bg-[#efe8d6] text-[#6a5f43]',
                                    ].join(' ')}
                                >
                                    {standalone ? 'Klar' : 'Anbefalt'}
                                </span>
                            </div>

                            {standalone ? (
                                <p className="mt-4 text-sm font-medium text-[#24471d]">
                                    Svelta er allerede lagt til pa
                                    hjemskjermen.
                                </p>
                            ) : installPrompt ? (
                                <button
                                    type="button"
                                    onClick={() => void handleInstallClick()}
                                    className="mt-4 rounded-full bg-[#12340d] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99]"
                                >
                                    Legg til pa hjemskjermen
                                </button>
                            ) : isSafariOnIos() ? (
                                <div className="mt-4 rounded-2xl bg-[#f2f1e8] p-3 text-sm text-[#36533a]">
                                    Trykk delingsikonet i Safari og velg
                                    {' '}
                                    &quot;Legg til pa Hjem-skjerm&quot;. Apne
                                    deretter
                                    Svelta fra ikonet du far pa hjemskjermen.
                                </div>
                            ) : isIosDevice() ? (
                                <div className="mt-4 rounded-2xl bg-[#f2f1e8] p-3 text-sm text-[#36533a]">
                                    For iPhone og iPad ma siden apnes i Safari
                                    for a kunne legges til pa hjemskjermen.
                                </div>
                            ) : (
                                <div className="mt-4 rounded-2xl bg-[#f2f1e8] p-3 text-sm text-[#36533a]">
                                    Hvis installknappen ikke dukker opp ennå,
                                    kan du bruke nettlesermenyen og velge
                                    {' '}
                                    &quot;Installer app&quot; eller &quot;Legg
                                    til pa hjemskjermen&quot;.
                                </div>
                            )}
                        </section>

                        <section className="rounded-2xl border border-[#d8d7cb] bg-[#fbfaf4] p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-[#12340d]">
                                        Varsler
                                    </h3>
                                    <p className="mt-1 text-sm text-[#496444]">
                                        Fa beskjed nar noen liker,
                                        kommenterer, eller nar en du folger
                                        deler en ny oppskrift.
                                    </p>
                                </div>
                                <span
                                    className={[
                                        'rounded-full px-2.5 py-1 text-xs font-semibold',
                                        permission === 'granted'
                                            ? 'bg-[#dff0cd] text-[#24471d]'
                                            : 'bg-[#efe8d6] text-[#6a5f43]',
                                    ].join(' ')}
                                >
                                    {permission === 'granted'
                                        ? 'Aktivert'
                                        : 'Valgfritt'}
                                </span>
                            </div>

                            {!user ? (
                                <div className="mt-4 rounded-2xl bg-[#f2f1e8] p-3 text-sm text-[#36533a]">
                                    Logg inn for a aktivere personlige varsler
                                    for kontoen din.
                                </div>
                            ) : permission === 'granted' ? (
                                <p className="mt-4 text-sm font-medium text-[#24471d]">
                                    Varsler er aktivert pa denne enheten.
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleEnableNotifications()
                                    }
                                    disabled={enablingNotifications}
                                    className="mt-4 rounded-full border border-[#12340d] px-4 py-2 text-sm font-semibold text-[#12340d] transition hover:bg-[#f2f1e8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {enablingNotifications
                                        ? 'Aktiverer varsler...'
                                        : 'Aktiver varsler'}
                                </button>
                            )}

                            {notificationError ? (
                                <p className="mt-3 text-sm text-[#8a3c2e]">
                                    {notificationError}
                                </p>
                            ) : null}
                        </section>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-[#d8d7cb] bg-[#fbfaf4] p-4">
                        <button
                            type="button"
                            onClick={handleSnooze}
                            className="rounded-full px-4 py-2 text-sm font-semibold text-[#496444] transition hover:bg-[#f2f1e8]"
                        >
                            Ikke na
                        </button>
                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="rounded-full bg-[#12340d] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99]"
                        >
                            Fortsett
                        </button>
                    </div>
                </div>
            )}
        </AppModal>
    );
}
