'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import RecipeCard from '@/app/components/RecipeCard';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';

import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { fetchFollowedRecipes } from '@/helpers/fetchFollowedRecipies';
import { fetchPopularRecipes } from '@/helpers/fetchPopularRecipies';

import { Recipe } from '@/app/types/Recipe';
import { UserDoc } from '@/hooks/useUserData';

type Feed = 'following' | 'popular';

const SkeletonCard: React.FC = () => {
    return (
        <div className="animate-pulse">
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="h-72 bg-slate-100" />
            </div>

            <div className="mt-4 space-y-2">
                <div className="h-7 w-2/3 rounded-xl bg-slate-100" />
                <div className="h-4 w-full rounded-xl bg-slate-100" />
                <div className="h-4 w-5/6 rounded-xl bg-slate-100" />
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-slate-100" />
                    <div className="space-y-2">
                        <div className="h-4 w-28 rounded-xl bg-slate-100" />
                        <div className="h-3 w-36 rounded-xl bg-slate-100" />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-5 w-12 rounded-xl bg-slate-100" />
                    <div className="h-5 w-12 rounded-xl bg-slate-100" />
                </div>
            </div>
        </div>
    );
};

const Home: React.FC = () => {
    const router = useRouter();
    const user = useAuthUser();

    // ✅ Default: Populære
    const [activeFeed, setActiveFeed] = React.useState<Feed>('popular');

    const following = useUserFollowing(user?.uid ?? '');
    const isLoggedIn = !!user?.uid;

    const followsNobody = isLoggedIn && following.length === 0;
    const followsSomebody = isLoggedIn && following.length > 0;

    const {
        data: followedRecipes = [],
        isLoading: loadingFollowed,
    } = useQuery<Recipe[], Error>({
        queryKey: ['followedRecipes', following],
        queryFn: () => fetchFollowedRecipes(following),
        enabled: isLoggedIn && activeFeed === 'following' && following.length > 0,
        placeholderData: (prev) => prev ?? [],
    });

    const {
        data: popularRecipes = [],
        isLoading: loadingPopular,
    } = useQuery<Recipe[], Error>({
        queryKey: ['popularRecipes'],
        queryFn: () => fetchPopularRecipes(),
        enabled: activeFeed === 'popular',
        placeholderData: (prev) => prev ?? [],
    });

    const recipes: Recipe[] = activeFeed === 'following' ? followedRecipes : popularRecipes;

    // ✅ SKELETON-LOGIKK
    // Populære: skeleton når den laster, eller når lista er tom (første load vibe)
    const showPopularSkeleton = activeFeed === 'popular' && (loadingPopular || popularRecipes.length === 0);

    // Følger:
    // - følger 0 → CTA ("Legg til kokker")
    // - følger 1+ → skeleton mens den laster
    const showFollowingCTA = activeFeed === 'following' && followsNobody;
    const showFollowingSkeleton = activeFeed === 'following' && followsSomebody && loadingFollowed;

    const showSkeletonGrid = showPopularSkeleton || showFollowingSkeleton;

    /* ─────────── Creator map (uid → UserDoc) ─────────── */
    const uniqueUserIds = React.useMemo(() => {
        const set = new Set<string>();
        recipes.forEach((r) => set.add(r.userId));
        return Array.from(set);
    }, [recipes]);

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
    });

    return (
        <div className="p-4 md:max-w-5xl md:w-2/3 md:mx-auto md:mb-24">
            {/* Header & feed toggle */}
            <div className="md:flex items-center justify-between mb-6">
                <h2 className="md:text-3xl text-2xl font-semibold text-slate-900">Oppskrifter</h2>

                <div className="relative inline-flex rounded-full bg-slate-50 p-1 mt-4 shadow-sm">
                    <div
                        className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                        style={{ transform: activeFeed === 'popular' ? 'translateX(100%)' : undefined }}
                    />

                    <button
                        onClick={() => setActiveFeed('following')}
                        className={`relative px-4 py-1 w-1/2 text-sm font-medium focus:outline-none ${
                            activeFeed === 'following' ? 'text-slate-900' : 'text-slate-500'
                        }`}
                    >
                        Følger
                    </button>

                    <button
                        onClick={() => setActiveFeed('popular')}
                        className={`relative px-4 py-1 w-1/2 text-sm font-medium focus:outline-none ${
                            activeFeed === 'popular' ? 'text-slate-900' : 'text-slate-500'
                        }`}
                    >
                        Populære
                    </button>
                </div>
            </div>

            {/* optional: link to own profile */}
            <div
                onClick={() => (user ? router.push(`/user/${user.uid}`) : alert('No user logged in'))}
                className="flex items-center justify-between mb-4 cursor-pointer"
            />

            {/* Content */}
            <div className="mb-40">
                {showFollowingCTA ? (
                    <div className="mt-6 rounded-2xl bg-white shadow-sm p-4">
                        <p className="text-slate-700">
                            Du følger ingen enda.
                        </p>
                        <button
                            onClick={() => router.push('/add-friends')}
                            className="mt-4 rounded-full px-5 py-2 bg-slate-900 text-white font-semibold shadow-sm
                         hover:opacity-95 active:scale-[0.99] transition"
                        >
                            Legg til kokker
                        </button>
                    </div>
                ) : showSkeletonGrid ? (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-10">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={`sk-${i}`} />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="mt-6">
                        <p className="text-slate-600">Ingen tilgjengelige oppskrifter.</p>
                    </div>
                ) : (
                    <div className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {recipes.map((recipe) => (
                                <RecipeCard key={recipe.id} recipe={recipe} creator={usersMap[recipe.userId]} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="text-xl text-center">
                Vet du fortsatt ikke hva du vil ha?

                <button
                    type="button"
                    onClick={() => router.push('/?recommend=1')}
                    className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 bg-cyan-100 hover:bg-cyan-200 transition"
                >
                    <span className="material-symbols-outlined">skillet</span>
                    Anbefal meg noe
                </button>
            </div>
        </div>
    );
};

export default Home;
