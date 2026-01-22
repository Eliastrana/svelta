'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import UserSearchModal from '@/app/components/UserSearchModal';
import RecipeCard      from '@/app/components/RecipeCard';
import { useAuthUser }       from '@/hooks/useAuthUser';
import { useUserFollowing }  from '@/hooks/useUserFollowing';
import { fetchManyUsers }      from '@/helpers/fetchManyUsers';
import { Recipe }  from '@/app/types/Recipe';
import { UserDoc } from '@/hooks/useUserData';
import { fetchFollowedRecipes } from '@/helpers/fetchFollowedRecipies';
import { fetchPopularRecipes } from '@/helpers/fetchPopularRecipies';

type Feed = 'following' | 'popular';

const Home: React.FC = () => {
    const router = useRouter();
    const user   = useAuthUser();

    const [activeFeed, setActiveFeed] = React.useState<Feed>('following');
    const [showModal,  setShowModal]  = React.useState(false);

    const following = useUserFollowing(user?.uid ?? '');

    const {
        data: followedRecipes = [],
        isLoading: loadingFollowed,
    } = useQuery<Recipe[], Error>({
        queryKey: ['followedRecipes', following],
        queryFn : () => fetchFollowedRecipes(following),
        enabled : !!user?.uid && activeFeed === 'following' && following.length > 0,
        placeholderData: (prev) => prev ?? [],
    });

    const {
        data: popularRecipes = [],
        isLoading: loadingPopular,
    } = useQuery<Recipe[], Error>({
        queryKey: ['popularRecipes'],
        queryFn : () => fetchPopularRecipes(),   // call with no ctx param
        enabled : activeFeed === 'popular',
        placeholderData: (prev) => prev ?? [],
    });

    const recipes: Recipe[] =
        activeFeed === 'following' ? followedRecipes : popularRecipes;
    const loading = activeFeed === 'following' ? loadingFollowed : loadingPopular;

    /* ─────────── Creator map (uid → UserDoc) ─────────── */
    const uniqueUserIds = React.useMemo(() => {
        const set = new Set<string>();
        recipes.forEach((r) => set.add(r.userId));
        return Array.from(set);
    }, [recipes]);

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn : () => fetchManyUsers(uniqueUserIds),
        enabled : uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
    });

    /* ─────────── Render ─────────── */
    if (loading) return <div className="p-4">Laster…</div>;

    return (
        <div className="p-4 md:max-w-5xl md:w-2/3 md:mx-auto md:mb-24">
            {/* Header & feed toggle */}
            <div className="md:flex items-center justify-between mb-6">
                <h2 className="md:text-3xl text-2xl font-semibold text-slate-900">Oppskrifter</h2>

                <div className="relative inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                    {/* sliding indicator */}
                    <div
                        className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                        style={{
                            transform: activeFeed === 'popular' ? 'translateX(100%)' : undefined,
                        }}
                    />

                    <button
                        onClick={() => setActiveFeed('following')}
                        className={`relative px-4 py-1 w-1/2 text-sm font-medium focus:outline-none ${
                            activeFeed === 'following'
                                ? 'text-slate-900'
                                : 'text-slate-500'
                        }`}
                    >
                        Følger
                    </button>

                    <button
                        onClick={() => setActiveFeed('popular')}
                        className={`relative px-4 py-1 w-1/2 text-sm font-medium focus:outline-none ${
                            activeFeed === 'popular'
                                ? 'text-slate-900'
                                : 'text-slate-500'
                        }`}
                    >
                        Populære
                    </button>
                </div>
            </div>

            {/* link to own profile */}
            <div
                onClick={() =>
                    user ? router.push(`/user/${user.uid}`) : alert('No user logged in')
                }
                className="flex items-center justify-between mb-4 cursor-pointer"
            />

            {/* recipe list / empty state */}
            <div className="mb-40">
                {recipes.length === 0 ? (
                    <>
                        <p className="text-slate-600">
                            Ingen tilgjengelige oppskrifter. Prøv å følg noen for å se
                            oppskrifter, eller sjekk ut populære oppskrifter!
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="confirm-button mt-4 px-4 py-2 rounded-full"
                        >
                            Søk etter kokker
                        </button>
                    </>
                ) : (
                    <div className="mt-6">
                        <div className="grid grid-cols-1 gap-10">
                            {recipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    creator={usersMap[recipe.userId]}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showModal && <UserSearchModal onClose={() => setShowModal(false)} />}
        </div>
    );
};

export default Home;
