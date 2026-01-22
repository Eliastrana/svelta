// app/components/RecommendModal.tsx
'use client';

import React, { useState } from 'react';
import { useRouter }               from 'next/navigation';
import { useQuery }                from '@tanstack/react-query';
import { useAuthUser }             from '@/hooks/useAuthUser';
import { useUserFollowing }        from '@/hooks/useUserFollowing';
import { fetchFollowedRecipes }    from '@/helpers/fetchFollowedRecipies';
import { Recipe }                  from '@/app/types/Recipe';

interface Props {
    onClose: () => void;
}

export default function RecommendModal({ onClose }: Props) {
    const router    = useRouter();
    const user      = useAuthUser();
    const following = useUserFollowing(user?.uid ?? '');
    const [prompt, setPrompt]   = useState('');
    const [error, setError]     = useState<string | null>(null);
    const [busy, setBusy]       = useState(false);

    // Fetch recipes only from followed users
    const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
        queryKey: ['followedRecipes', following],
        queryFn:  () => fetchFollowedRecipes(following),
        enabled:  !!user?.uid && following.length > 0,
        placeholderData: () => [],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);

        try {
            // Send only id/title/description to LLM
            const minimal = recipes.map(r => ({
                id:          r.id,
                title:       r.title,
                description: r.description,
            }));

            const res = await fetch('/api/recommend', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ prompt, recipes: minimal }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error ?? 'Ukjent feil fra server');
            }

            onClose();
            router.push(`/recipe/${data.recipe.id}`);
        } catch (err: unknown) {
            // Safely extract message from unknown
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50">
            <div
                className="fixed md:bottom-30 bottom-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-md z-50
                   p-4 rounded-2xl shadow-xl backdrop-blur
                   bg-white/95
                   border border-slate-200"
            >
                <button
                    onClick={onClose}
                    className="confirm-button absolute top-3 right-3 h-8 w-8 p-0"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-semibold mb-2 text-slate-900">Spør CorpCoreKokken!</h2>
                <p className="mb-2 text-slate-600">Se så uproposjonal han er!</p>

                <img
                    className="mt-2 mb-2"
                    src="/corpcore.gif"
                    alt="CorpCoreKokken"
                />

                {isLoading ? (
                    <p className="text-slate-600">Laster oppskrifter du følger…</p>
                ) : recipes.length === 0 ? (
                    <p className="text-slate-600">
                        Du følger ingen kokker—legg til noen for å få anbefalinger!
                    </p>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="Eksempel: Noe som både har brownie og cookie i seg"
                            className="w-full p-2 border border-slate-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            rows={3}
                        />
                        <button
                            type="submit"
                            disabled={busy || !prompt.trim()}
                            className="confirm-button w-full disabled:opacity-50"
                        >
                            {busy ? 'Tenker…' : 'Finn oppskrift'}
                        </button>
                    </form>
                )}

                {error && <p className="text-red-600 mt-3">{error}</p>}
            </div>
        </div>
    );
}
