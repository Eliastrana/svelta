'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppModal from '@/app/components/AppModal';

export interface CollectionDoc {
    id: string;
    name: string;
}

interface CollectionsModalProps {
    collections: CollectionDoc[];
    loading: boolean;
    onCreateList: (name: string) => void;
    onClose: () => void;
}

const CollectionsModal: React.FC<CollectionsModalProps> = ({
    collections,
    loading,
    onCreateList,
    onClose,
}) => {
    const router = useRouter();
    const [newListName, setNewListName] = useState('');

    const handleSubmit = () => {
        const trimmed = newListName.trim();
        if (!trimmed) return;
        onCreateList(trimmed);
        setNewListName('');
    };

    return (
        <AppModal onClose={onClose} overlayClassName="z-[999]">
            {({ closeWithAnim, closing }) => (
                <div className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Mine lister</h3>
                        <button
                            type="button"
                            className="material-symbols-outlined text-lg opacity-70 hover:opacity-100 hover:cursor-pointer"
                            onClick={closeWithAnim}
                            aria-label="Lukk"
                            disabled={closing}
                        >
                            close
                        </button>
                    </div>

                    {/* New list input */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Ny liste…"
                            className="flex-grow px-3 py-2 rounded-lg border border-slate-200
                       focus:outline-none focus:ring-2 focus:ring-slate-300"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="p-2 rounded-lg text-slate-700 disabled:opacity-40 hover:bg-slate-100"
                            onClick={handleSubmit}
                            disabled={!newListName.trim() || closing}
                            aria-label="Lag ny liste"
                        >
                            <span className="material-symbols-outlined">
                                add
                            </span>
                        </button>
                    </div>

                    {/* Lists */}
                    {loading ? (
                        <p>Laster…</p>
                    ) : collections.length === 0 ? (
                        <p className="text-sm text-slate-600">
                            Ingen lister ennå.
                        </p>
                    ) : (
                        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {collections.map((c) => (
                                <li
                                    key={c.id}
                                    className="p-2 rounded-lg cursor-pointer hover:bg-slate-100"
                                    onClick={() => {
                                        router.push(`/collections/${c.id}`);
                                        closeWithAnim();
                                    }}
                                >
                                    {c.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </AppModal>
    );
};

export default CollectionsModal;
