'use client';

import React from 'react';
import AppModal from '@/app/components/AppModal';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { UserDoc } from '@/hooks/useUserData';

export type CoAuthorInvitee = {
    uid: string;
    name: string;
    photoURL?: string;
};

type Props = {
    followingIds: string[];
    selectedUid?: string;
    onClose: () => void;
    onSelect: (user: CoAuthorInvitee) => void;
};

export default function CoAuthorPickerModal({
    followingIds,
    selectedUid,
    onClose,
    onSelect,
}: Props) {
    const [loading, setLoading] = React.useState(true);
    const [users, setUsers] = React.useState<CoAuthorInvitee[]>([]);
    const [search, setSearch] = React.useState('');

    React.useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!followingIds.length) {
                setUsers([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const usersMap = await fetchManyUsers(followingIds);
                if (cancelled) return;

                const nextUsers = followingIds
                    .map((uid) => {
                        const user = (usersMap[uid] ?? {}) as UserDoc;
                        return {
                            uid,
                            name: user.name?.trim() || 'Kokk uten navn',
                            photoURL: user.photoURL?.trim() || '',
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));

                setUsers(nextUsers);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [followingIds]);

    const filteredUsers = React.useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter((user) => user.name.toLowerCase().includes(query));
    }, [search, users]);

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim, closing }) => (
                <div className="max-h-[78vh] overflow-hidden">
                    <div className="flex items-start justify-between gap-3 border-b border-[#d8d7cb] p-4">
                        <div>
                            <h2 className="text-lg font-bold text-[#12340d]">
                                Inviter medforfatter
                            </h2>
                            <p className="mt-1 text-sm text-[#496444]">
                                Velg en kokk du allerede følger.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#e5e5d7] active:scale-95"
                            aria-label="Lukk medforfattervelger"
                        >
                            <span className="material-symbols-outlined text-[#12340d]">
                                close
                            </span>
                        </button>
                    </div>

                    <div className="p-4">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Søk etter kokk..."
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />

                        <div className="mt-4 max-h-[56vh] overflow-y-auto pr-1">
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 rounded-2xl bg-[#f2f1e8] p-3"
                                        >
                                            <div className="h-12 w-12 animate-pulse rounded-full bg-[#deded0]" />
                                            <div className="h-4 w-32 animate-pulse rounded bg-[#deded0]" />
                                        </div>
                                    ))}
                                </div>
                            ) : followingIds.length === 0 ? (
                                <div className="rounded-2xl bg-[#f2f1e8] p-4 text-sm text-[#496444]">
                                    Du må følge noen før du kan invitere dem som
                                    medforfatter.
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="rounded-2xl bg-[#f2f1e8] p-4 text-sm text-[#496444]">
                                    Ingen kokker matcher søket ditt.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredUsers.map((user) => (
                                        <button
                                            key={user.uid}
                                            type="button"
                                            onClick={() => {
                                                onSelect(user);
                                                closeWithAnim();
                                            }}
                                            className={[
                                                'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
                                                selectedUid === user.uid
                                                    ? 'border-[#cdddb9] bg-[#f2f7ea]'
                                                    : 'border-[#e5e5d7] bg-white hover:bg-[#fbfaf4]',
                                            ].join(' ')}
                                        >
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e5d7]">
                                                {user.photoURL ? (
                                                    <img
                                                        src={user.photoURL}
                                                        alt={user.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-lg">
                                                        👩‍🍳
                                                    </span>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-semibold text-[#12340d]">
                                                    {user.name}
                                                </p>
                                            </div>

                                            {selectedUid === user.uid ? (
                                                <span className="material-symbols-outlined text-[#365d2c]">
                                                    check_circle
                                                </span>
                                            ) : (
                                                <span className="material-symbols-outlined text-slate-400">
                                                    add_circle
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AppModal>
    );
}
