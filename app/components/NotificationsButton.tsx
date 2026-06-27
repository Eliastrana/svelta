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
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#d8d7cb] bg-white text-[#12340d] shadow-sm transition hover:bg-[#f7f6ef] active:scale-[0.98]"
                    aria-label="Apne varsler"
                >
                    <span className="material-symbols-outlined">
                        notifications
                    </span>
                    {unreadCount > 0 ? (
                        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#365d2c] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    ) : null}
                </button>
            </div>

            {open ? (
                <NotificationsModal
                    currentUserId={user.uid}
                    notifications={notifications}
                    loading={loading}
                    markAllAsRead={markAllAsRead}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </>
    );
}
