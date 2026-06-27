'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/nb';
import AppModal from '@/app/components/AppModal';
import type { AppNotification } from '@/app/types/AppNotification';
import { respondToCoAuthorInvite } from '@/helpers/coAuthorInvites';

dayjs.extend(relativeTime);
dayjs.locale('nb');

interface NotificationsModalProps {
    currentUserId: string;
    notifications: AppNotification[];
    loading: boolean;
    markAllAsRead: () => Promise<void>;
    onClose: () => void;
}

export default function NotificationsModal({
    currentUserId,
    notifications,
    loading,
    markAllAsRead,
    onClose,
}: NotificationsModalProps) {
    const router = useRouter();
    const [busyNotificationId, setBusyNotificationId] = useState<string | null>(
        null
    );

    useEffect(() => {
        void markAllAsRead().catch((error) => {
            console.error('Could not mark notifications as read:', error);
        });
    }, [markAllAsRead]);

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim, closing }) => (
                <div className="max-h-[78vh] overflow-hidden">
                    <div className="flex items-start justify-between gap-3 border-b border-[#d8d7cb] p-4">
                        <div>
                            <h2 className="text-lg font-bold text-[#12340d]">
                                Varsler
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#e5e5d7] active:scale-95"
                            aria-label="Lukk varsler"
                        >
                            <span className="material-symbols-outlined text-[#12340d]">
                                close
                            </span>
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto p-4">
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="rounded-2xl bg-[#f2f1e8] p-4"
                                    >
                                        <div className="h-4 w-28 animate-pulse rounded bg-[#d8d7cb]" />
                                        <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#e5e5d7]" />
                                        <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[#e5e5d7]" />
                                    </div>
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="rounded-2xl bg-[#f2f1e8] p-5">
                                <h3 className="text-base font-bold text-[#12340d]">
                                    Ingen varsler enda
                                </h3>
                                <p className="mt-1 text-sm text-[#496444]">
                                    Når noen liker, kommenterer eller deler en
                                    ny oppskrift, dukker det opp her.
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {notifications.map((notification) => {
                                    const relativeLabel =
                                        notification.createdAt?.toDate
                                            ? dayjs(
                                                  notification.createdAt.toDate()
                                              ).fromNow()
                                            : 'Nettopp';

                                    return (
                                        <li key={notification.id}>
                                            <div
                                                className={[
                                                    'rounded-2xl border p-4 transition',
                                                    notification.readAt
                                                        ? 'border-[#e5e5d7] bg-[#fbfaf4]'
                                                        : 'border-[#cdddb9] bg-[#f2f7ea]',
                                                ].join(' ')}
                                            >
                                                <button
                                                    type="button"
                                                    disabled={
                                                        busyNotificationId ===
                                                        notification.id
                                                    }
                                                    onClick={() => {
                                                        closeWithAnim();
                                                        router.push(
                                                            notification.link ||
                                                                '/'
                                                        );
                                                    }}
                                                    className="w-full text-left"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#d8d7cb]">
                                                            {notification.actorPhotoURL ? (
                                                                <img
                                                                    src={
                                                                        notification.actorPhotoURL
                                                                    }
                                                                    alt={
                                                                        notification.actorName ||
                                                                        'Bruker'
                                                                    }
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-lg">
                                                                    👩‍🍳
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <p className="font-semibold text-[#12340d]">
                                                                    {
                                                                        notification.title
                                                                    }
                                                                </p>
                                                                {!notification.readAt ? (
                                                                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#365d2c]" />
                                                                ) : null}
                                                            </div>

                                                            <p className="mt-1 text-sm text-[#36533a]">
                                                                {
                                                                    notification.body
                                                                }
                                                            </p>

                                                            <p className="mt-2 text-xs text-[#6f8068]">
                                                                {relativeLabel}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>

                                                {notification.type ===
                                                    'coauthor_invite' &&
                                                notification.coAuthorInviteStatus !==
                                                    'accepted' &&
                                                notification.coAuthorInviteStatus !==
                                                    'declined' ? (
                                                    <div className="mt-3 flex gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                busyNotificationId ===
                                                                notification.id
                                                            }
                                                            onClick={async () => {
                                                                try {
                                                                    setBusyNotificationId(
                                                                        notification.id
                                                                    );
                                                                    await respondToCoAuthorInvite(
                                                                        {
                                                                            userId: currentUserId,
                                                                            notificationId:
                                                                                notification.id,
                                                                            accept: true,
                                                                        }
                                                                    );
                                                                } catch (error) {
                                                                    console.error(
                                                                        'Could not accept co-author invite:',
                                                                        error
                                                                    );
                                                                } finally {
                                                                    setBusyNotificationId(
                                                                        null
                                                                    );
                                                                }
                                                            }}
                                                            className="rounded-full bg-[#365d2c] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                                                        >
                                                            Godta
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                busyNotificationId ===
                                                                notification.id
                                                            }
                                                            onClick={async () => {
                                                                try {
                                                                    setBusyNotificationId(
                                                                        notification.id
                                                                    );
                                                                    await respondToCoAuthorInvite(
                                                                        {
                                                                            userId: currentUserId,
                                                                            notificationId:
                                                                                notification.id,
                                                                            accept: false,
                                                                        }
                                                                    );
                                                                } catch (error) {
                                                                    console.error(
                                                                        'Could not decline co-author invite:',
                                                                        error
                                                                    );
                                                                } finally {
                                                                    setBusyNotificationId(
                                                                        null
                                                                    );
                                                                }
                                                            }}
                                                            className="rounded-full border border-[#d8d7cb] bg-white px-4 py-2 text-sm font-semibold text-[#12340d] transition hover:bg-[#f5f3ec] disabled:opacity-60"
                                                        >
                                                            Avslå
                                                        </button>
                                                    </div>
                                                ) : null}

                                                {notification.type ===
                                                    'coauthor_invite' &&
                                                notification.coAuthorInviteStatus ===
                                                    'accepted' ? (
                                                    <p className="mt-3 text-xs font-semibold text-[#365d2c]">
                                                        Du har godtatt
                                                        invitasjonen.
                                                    </p>
                                                ) : null}

                                                {notification.type ===
                                                    'coauthor_invite' &&
                                                notification.coAuthorInviteStatus ===
                                                    'declined' ? (
                                                    <p className="mt-3 text-xs font-semibold text-slate-500">
                                                        Invitasjonen er avslått.
                                                    </p>
                                                ) : null}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </AppModal>
    );
}
