'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import UserSearchModal from '@/app/components/UserSearchModal';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { useFollowedRecipes } from '@/hooks/useFollowedRecipes';
import { usePopularRecipes } from '@/hooks/usePopularRecipes';
import { fetchUserData } from '@/helpers/fetchUserData';
import RecipeCard from '@/app/components/RecipeCard';
import { UserDoc } from '@/hooks/useUserData';

const Home = () => {
    const router = useRouter();
    const user = useAuthUser();
    const following = useUserFollowing(user?.uid || '');

    // Toggle state: "following" feed vs. "popular" feed.
    const [activeFeed, setActiveFeed] = React.useState<'following' | 'popular'>(
        'following'
    );

    // Get recipes from followed users (only for logged-in users) and from the popular feed.
    const [followedRecipes, loadingFollowed] = useFollowedRecipes(
        user?.uid || '',
        following
    );
    const [popularRecipes, loadingPopular] = usePopularRecipes();

    // Select the appropriate data and loading state based on activeFeed.
    const recipes =
        activeFeed === 'following' ? followedRecipes : popularRecipes;
    const loading =
        activeFeed === 'following' ? loadingFollowed : loadingPopular;

    const [showModal, setShowModal] = React.useState(false);
    const [usersMap, setUsersMap] = React.useState<Record<string, UserDoc>>({});

    // Get unique user IDs from the displayed recipes and fetch the user data.
    const uniqueUserIds = React.useMemo(() => {
        return Array.from(new Set(recipes.map((r) => r.userId)));
    }, [recipes]);

    React.useEffect(() => {
        if (uniqueUserIds.length === 0) return;
        const fetchUsers = async () => {
            const dataMap: Record<string, UserDoc> = {};
            await Promise.all(
                uniqueUserIds.map(async (uid) => {
                    const userDoc = await fetchUserData(uid);
                    if (userDoc) dataMap[uid] = userDoc;
                })
            );
            setUsersMap(dataMap);
        };
        fetchUsers();
    }, [uniqueUserIds.join(',')]);

    if (loading) return <div className="p-4">Laster...</div>;

    return (
        <div className="p-2 md:max-w-4xl md:w-2/3 md:mx-auto md:mb-20 ">
            <div className="md:flex items-center justify-between mb-4">
                <h2 className="md:text-4xl text-2xl font-bold mb-4">
                    Nyeste oppskrifter
                </h2>

                <div className="relative inline-flex bg-gray-300 rounded overflow-hidden rounded-full">
                    {/* Sliding focus indicator */}
                    <div
                        className="absolute top-0 left-0 h-full w-1/2 dark-purple-bg  transition-transform duration-300"
                        style={{ transform: activeFeed === 'popular' ? 'translateX(100%)' : 'translateX(0)' }}
                    ></div>

                    {/* Button for 'Følger' */}
                    <button
                        onClick={() => setActiveFeed('following')}
                        className={`relative px-6 py-1 w-1/2 focus:outline-none ${activeFeed === 'following' ? 'text-white' : 'text-gray-700'}`}
                    >
                        Følger
                    </button>

                    {/* Button for 'Populære' */}
                    <button
                        onClick={() => setActiveFeed('popular')}
                        className={`relative px-6 py-1 w-1/2 focus:outline-none ${activeFeed === 'popular' ? 'text-white' : 'text-gray-700'}`}
                    >
                        Populære
                    </button>
                </div>

            </div>

            <div
                onClick={() => {
                    if (user) {
                        router.push(`/user/${user.uid}`);
                    } else {
                        alert('No user logged in');
                    }
                }}
                className="flex items-center justify-between mb-4 cursor-pointer"
            ></div>

            <div className="mb-40">
                {recipes.length === 0 ? (
                    <div>
                        <p className="">
                            Ingen tilgjengelige oppskrifter. Prøv å følg noen
                            for å se oppskrifter, eller sjekk ut populære oppskrifter!
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="confirm-button mt-4 p-2 rounded-lg cursor-pointer hover:underline"
                        >
                            Søk etter kokker
                        </button>
                    </div>
                ) : (
                    <div className="mt-8 white-text">
                        <div className="grid grid-cols-1 md:gap-24 gap-8">
                            {recipes.map((recipe) => {
                                const creator = usersMap[recipe.userId];
                                return (
                                    <RecipeCard
                                        key={recipe.id}
                                        recipe={recipe}
                                        creator={creator}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <UserSearchModal onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

export default Home;
