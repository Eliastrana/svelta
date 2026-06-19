'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
    disablePushNotifications,
    enablePushNotifications,
    getPushNotificationsStatus,
    type PushNotificationsStatus,
} from '@/helpers/pushNotifications';

type NotificationSettingsSectionProps = {
    user: User | null;
};

const STATUS_COPY: Record<
    PushNotificationsStatus,
    { badge: string; description: string }
> = {
    unsupported: {
        badge: 'Ikke støttet',
        description:
            'Denne enheten eller nettleseren støtter ikke push-varsler for Svelta.',
    },
    blocked: {
        badge: 'Blokkert',
        description:
            'Varsler er blokkert i nettleseren. Tillat varsler i nettleserinnstillingene for å aktivere dem igjen.',
    },
    available: {
        badge: 'Av',
        description:
            'Få varsler når noen liker, kommenterer eller når en du følger deler en ny oppskrift.',
    },
    enabled: {
        badge: 'På',
        description:
            'Push-varsler er aktive på denne enheten for likes, kommentarer og nye oppskrifter fra folk du følger.',
    },
    paused: {
        badge: 'Pauset',
        description:
            'Push-varsler er slått av for denne enheten, men du kan aktivere dem igjen her.',
    },
};

export default function NotificationSettingsSection({
    user,
}: NotificationSettingsSectionProps) {
    const [status, setStatus] = useState<PushNotificationsStatus>('available');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        setStatus(getPushNotificationsStatus(user?.uid));
    }, [user?.uid]);

    const refreshStatus = () => {
        setStatus(getPushNotificationsStatus(user?.uid));
    };

    const handleEnable = async () => {
        if (!user) return;

        setBusy(true);
        setError('');

        try {
            const result = await enablePushNotifications(user);

            if (!result.ok) {
                if (result.reason === 'missing-vapid-key') {
                    setError(
                        'Push-varsler er ikke ferdig konfigurert i dette miljøet ennå.'
                    );
                } else if (result.reason === 'permission-blocked') {
                    setError(
                        'Varsler er blokkert i nettleseren. Åpne nettleserinnstillingene og tillat varsler for Svelta.'
                    );
                } else {
                    setError('Kunne ikke aktivere varsler på denne enheten.');
                }
            }
        } catch (enableError) {
            console.error('Could not enable notifications:', enableError);
            setError('Noe gikk galt da varsler skulle aktiveres.');
        } finally {
            refreshStatus();
            setBusy(false);
        }
    };

    const handleDisable = async () => {
        if (!user) return;

        setBusy(true);
        setError('');

        try {
            const result = await disablePushNotifications(user);

            if (!result.ok && result.reason === 'missing-vapid-key') {
                setError(
                    'Kunne ikke slå av varsler fordi push-oppsettet mangler VAPID-nøkkel.'
                );
            }
        } catch (disableError) {
            console.error('Could not disable notifications:', disableError);
            setError('Noe gikk galt da varsler skulle slås av.');
        } finally {
            refreshStatus();
            setBusy(false);
        }
    };

    const copy = STATUS_COPY[status];
    const canEnable = user && (status === 'available' || status === 'paused');
    const canDisable = user && status === 'enabled';

    return (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-slate-900">
                        Varsler
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        {copy.description}
                    </p>
                </div>

                <span
                    className={[
                        'rounded-full px-2.5 py-1 text-xs font-semibold',
                        status === 'enabled'
                            ? 'bg-[#dff0cd] text-[#24471d]'
                            : status === 'blocked'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-200 text-slate-700',
                    ].join(' ')}
                >
                    {copy.badge}
                </span>
            </div>

            {canEnable ? (
                <button
                    type="button"
                    onClick={() => void handleEnable()}
                    disabled={busy}
                    className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {busy ? 'Aktiverer…' : 'Aktiver varsler'}
                </button>
            ) : null}

            {canDisable ? (
                <button
                    type="button"
                    onClick={() => void handleDisable()}
                    disabled={busy}
                    className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {busy ? 'Slår av…' : 'Slå av varsler på denne enheten'}
                </button>
            ) : null}

            {status === 'blocked' ? (
                <p className="mt-3 text-sm text-slate-500">
                    Åpne nettleserinnstillingene på mobilen og tillat varsler
                    for nettstedet hvis du vil slå dem på igjen.
                </p>
            ) : null}

            {error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}
        </div>
    );
}
