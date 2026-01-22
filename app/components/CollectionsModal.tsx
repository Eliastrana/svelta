'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

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
        <>
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />

            <div
                className="fixed md:bottom-30 bottom-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-md z-50
                   p-4 rounded-2xl shadow-xl backdrop-blur
                   bg-white/95
                   border border-slate-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Mine lister</h3>
                    <button
                        className="material-symbols-outlined text-lg opacity-70 hover:opacity-100"
                        onClick={onClose}
                    >
                        close
                    </button>
                </div>

                {/* New list input */}
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Ny liste…"
                        className="flex-grow px-3 py-2 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-slate-300"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit();
                        }}
                    />
                    <button
                        className="p-2 rounded-lg text-slate-700 disabled:opacity-40"
                        onClick={handleSubmit}
                        disabled={!newListName.trim()}
                    >
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>

                {/* Lists */}
                {loading ? (
                    <p>Laster…</p>
                ) : collections.length === 0 ? (
                    <p className="text-sm">Ingen lister ennå.</p>
                ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {collections.map((c) => (
                            <li
                                key={c.id}
                                className="p-2 rounded-lg cursor-pointer hover:bg-slate-100"
                                onClick={() => {
                                    router.push(`/collections/${c.id}`);
                                    onClose();
                                }}
                            >
                                {c.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
};

export default CollectionsModal;
