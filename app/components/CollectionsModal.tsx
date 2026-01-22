'use client';

import React, { useEffect, useState } from 'react';
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

const ANIM_MS = 180;

const CollectionsModal: React.FC<CollectionsModalProps> = ({
                                                               collections,
                                                               loading,
                                                               onCreateList,
                                                               onClose,
                                                           }) => {
    const router = useRouter();
    const [newListName, setNewListName] = useState('');

    // ✅ local open state so we can animate in/out before unmount
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);

    // animate in on mount
    useEffect(() => {
        const t = setTimeout(() => setOpen(true), 10);
        return () => clearTimeout(t);
    }, []);

    const closeWithAnim = () => {
        if (closing) return;
        setClosing(true);
        setOpen(false);
        window.setTimeout(() => {
            onClose();
        }, ANIM_MS);
    };

    const handleSubmit = () => {
        const trimmed = newListName.trim();
        if (!trimmed) return;
        onCreateList(trimmed);
        setNewListName('');
    };

    // ✅ ESC closes
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeWithAnim();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closing]);

    return (
        // ✅ overlay catches outside clicks (also over navbar)
        <div
            className={[
                'fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm',
                'transition-opacity duration-200',
                open ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            onClick={closeWithAnim}
            aria-hidden="true"
        >
            {/* ✅ Modal box: stop bubbling so inside clicks don't close */}
            <div
                className={[
                    'fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-[90vw] max-w-md',
                    'p-4 rounded-2xl shadow-xl backdrop-blur bg-white/95 border border-slate-200',
                    'transition-all duration-200 ease-out',
                    open
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-3 scale-[0.98]',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
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
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>

                {/* Lists */}
                {loading ? (
                    <p>Laster…</p>
                ) : collections.length === 0 ? (
                    <p className="text-sm text-slate-600">Ingen lister ennå.</p>
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
        </div>
    );
};

export default CollectionsModal;