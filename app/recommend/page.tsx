// app/recommend/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter }        from 'next/navigation';
import { useQuery }         from '@tanstack/react-query';
import RecipeCard           from '@/app/components/RecipeCard';
import { Recipe }           from '@/app/types/Recipe';
import { useAuthUser }      from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { fetchFollowedRecipes   } from '@/helpers/fetchFollowedRecipies';
import { fetchPopularRecipes    } from '@/helpers/fetchPopularRecipies';
import { fetchManyUsers         } from '@/helpers/fetchManyUsers';
import { UserDoc               } from '@/hooks/useUserData';

type Feed = 'following' | 'popular';

export default function RecommendPage() {
    const router       = useRouter();
    const user         = useAuthUser();
    const [activeFeed, setActiveFeed] = useState<Feed>('following');
    const following    = useUserFollowing(user?.uid ?? '');

    // fetch the same two lists…
    const { data: followed = [], isLoading: l1 } = useQuery<Recipe[]>({
        queryKey:   ['followedRecipes', following],
        queryFn:    () => fetchFollowedRecipes(following),
        enabled:    !!user?.uid && activeFeed === 'following' && following.length > 0,
        placeholderData: () => [],
    });
    const { data: popular = [], isLoading: l2 } = useQuery<Recipe[]>({
        queryKey: ['popularRecipes'],
        queryFn:  () => fetchPopularRecipes(),
        enabled:  activeFeed === 'popular',
        placeholderData: () => [],
    });

    const recipes = activeFeed === 'following' ? followed : popular;
    const loading = (activeFeed === 'following' ? l1 : l2);

    // load creators for display
    const ids       = React.useMemo(() => Array.from(new Set(recipes.map(r => r.userId))), [recipes]);
    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>>({
        queryKey: ['usersMap', ids],
        queryFn:  () => fetchManyUsers(ids),
        enabled:  ids.length > 0,
        placeholderData: () => ({}),
    });

    // local state for prompt + result
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState<Recipe | null>(null);
    const [error,  setError]  = useState<string | null>(null);
    const [busy,   setBusy]   = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setResult(null);

        try {
            const minimalList = recipes.map(r => ({
                id:          r.id,
                title:       r.title,
                description: r.description,
            }));

            const res = await fetch('/api/recommend', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ prompt, recipes: minimalList }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unknown error');

            router.push(`/recipe/${data.recipe.id}`);

            // setResult(data.recipe);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(String(err));
            }
        } finally {
            setBusy(false);
        }
    };


    if (loading) return <div className="p-4">Laster…</div>;

    return (
        <div className="p-4 md:max-w-3xl md:mx-auto">
            <h1 className="text-3xl font-bold mb-4">La meg velge en oppskrift</h1>

            {/* feed toggle */}
            <div className="inline-flex mb-6 rounded overflow-hidden relative">
                <div
                    className="absolute top-0 left-0 h-full w-1/2 transition-transform duration-300 bg-white rounded-full"
                    style={{ transform: activeFeed === 'popular' ? 'translateX(100%)' : undefined }}
                />
                {(['following','popular'] as Feed[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setActiveFeed(f)}
                        className={`relative px-4 py-1 w-1/2 focus:outline-none ${
                            activeFeed===f ? 'text-black' : 'text-gray-400'
                        }`}
                    >
                        {f === 'following' ? 'Følger' : 'Populære'}
                    </button>
                ))}
            </div>

            {/* prompt form */}
            <form onSubmit={handleSubmit} className="mb-6">
        <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Beskriv hva du ønsker – f.eks. “rask vegetarrett med kikerter”"
            className="w-full p-3 border rounded mb-2"
            rows={4}
        />
                <button
                    type="submit"
                    disabled={busy || !prompt.trim()}
                    className="confirm-button px-4 py-2 rounded"
                >
                    {busy ? 'Tenker…' : 'Finn oppskrift'}
                </button>
            </form>

            {error && <p className="text-red-500 mb-4">Feil: {error}</p>}

            {result && (
                <div>
                    <h2 className="text-2xl font-semibold mb-2">Anbefalt oppskrift</h2>
                    <RecipeCard
                        recipe={result}
                        creator={usersMap[result.userId]}
                    />
                </div>
            )}
        </div>
    );
}
