'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

import UserSearchModal from '@/app/components/UserSearchModal';
import RecipeCard       from '@/app/components/RecipeCard';

import { useAuthUser }        from '@/hooks/useAuthUser';
import { useUserFollowing }   from '@/hooks/useUserFollowing';
import { useFollowedRecipes } from '@/hooks/useFollowedRecipes';
import { usePopularRecipes }  from '@/hooks/usePopularRecipes';
import { UserDoc }            from '@/hooks/useUserData';

import { fetchManyUsers } from '@/helpers/fetchManyUsers';

const Home = () => {
    const router    = useRouter();
    const user      = useAuthUser();
    const following = useUserFollowing(user?.uid ?? '');

    /* ───────────────────────── TOGGLES ───────────────────────── */
    const [activeFeed, setActiveFeed] =
        React.useState<'following' | 'popular'>('following');

    const [showModal, setShowModal] = React.useState<boolean>(false);

    /* ───────────────────────── FETCH RECIPES ──────────────────── */
    const [followedRecipes, loadingFollowed] = useFollowedRecipes(
        user?.uid ?? '',
        following,
    );
    const [popularRecipes,  loadingPopular]  = usePopularRecipes();

    const recipes =
        activeFeed === 'following' ? followedRecipes : popularRecipes;
    const loading =
        activeFeed === 'following' ? loadingFollowed  : loadingPopular;

    /* ───────────────────────── FETCH CREATORS ─────────────────── */
    const [usersMap, setUsersMap] =
        React.useState<Record<string, UserDoc>>({});

    const uniqueUserIds = React.useMemo(
        () => [...new Set(recipes.map((r) => r.userId))],
        [recipes],
    );

    React.useEffect(() => {
        // clear previous map to avoid stale usernames
        setUsersMap({});

        if (!uniqueUserIds.length) return;

        (async () => {
            const map = await fetchManyUsers(uniqueUserIds);
            setUsersMap(map);
        })();
    }, [uniqueUserIds]);

    /* ───────────────────────── RENDER ─────────────────────────── */
    if (loading) return <div className="p-4">Laster…</div>;

    return (
        <div className="p-2 md:max-w-4xl md:w-2/3 md:mx-auto md:mb-20">
            {/* Header & feed toggle */}
            <div className="md:flex items-center justify-between mb-4">
                <h2 className="md:text-4xl text-2xl font-bold mb-4">Oppskrifter</h2>

                <div className="relative inline-flex rounded overflow-hidden">
                    {/* sliding indicator */}
                    <div
                        className="absolute top-0 left-0 h-full w-1/2 transition-transform duration-300"
                        style={{
                            transform:
                                activeFeed === 'popular' ? 'translateX(100%)' : undefined,
                        }}
                    />

                    <button
                        onClick={() => setActiveFeed('following')}
                        className={`relative px-6 py-1 w-1/2 focus:outline-none ${
                            activeFeed === 'following'
                                ? 'text-black bg-white rounded-full'
                                : 'text-gray-200'
                        }`}
                    >
                        Følger
                    </button>

                    <button
                        onClick={() => setActiveFeed('popular')}
                        className={`relative px-6 py-1 w-1/2 focus:outline-none ${
                            activeFeed === 'popular'
                                ? 'text-black bg-white rounded-full'
                                : 'text-gray-200'
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
                        <p>
                            Ingen tilgjengelige oppskrifter. Prøv å følg noen for å se
                            oppskrifter, eller sjekk ut populære oppskrifter!
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="confirm-button mt-4 p-2 rounded-lg hover:underline"
                        >
                            Søk etter kokker
                        </button>

                        <img
                            src="/images/empty-recipes.png"
                            alt="No recipes"
                            className="w-full h-auto mt-8"
                        />
                    </>
                ) : (
                    <div className="mt-8 white-text">
                        <div className="grid grid-cols-1 md:gap-24 gap-20">
                            {recipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    creator={usersMap[recipe.userId]}  // may be undefined while loading
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
