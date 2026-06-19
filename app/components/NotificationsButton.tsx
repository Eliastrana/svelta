'use client';

import { useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationsModal from '@/app/components/NotificationsModal';

export default function NotificationsButton() {
    const user = useAuthUser();
    const [open, setOpen] = useState(false);

    const { notifications, unreadCount, loading, markAllAsRead } =
        useNotifications(user?.uid ?? '');

    if (!user) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed right-4 top-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#d8d7cb] bg-white/92 text-[#12340d] backdrop-blur md:right-6 md:top-6"
                aria-label="Apne varsler"
            >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#365d2c] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                ) : null}
            </button>

            {open ? (
                <NotificationsModal
                    notifications={notifications}
                    loading={loading}
                    markAllAsRead={markAllAsRead}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </>
    );
}
