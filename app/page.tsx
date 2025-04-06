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
        <div className="max-w-4xl md:w-2/3 mx-auto md:mb-20 p-2">
            <div className="md:flex items-center justify-between mb-4">
                <h1 className="md:text-6xl text-4xl font-bold mb-4">
                    Nyeste oppskrifter
                </h1>

                <div className=" space-x-2 ">
                    <button
                        onClick={() => setActiveFeed('following')}
                        className={`px-4 py-2 rounded ${activeFeed === 'following' ? 'confirm-button' : 'bg-gray-300'}`}
                    >
                        Følger
                    </button>
                    <button
                        onClick={() => setActiveFeed('popular')}
                        className={`px-4 py-2 rounded ${activeFeed === 'popular' ? 'confirm-button' : 'bg-gray-300'}`}
                    >
                        Chef de Cuisine
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
                        <p className="text-2xl">
                            Ingen tilgjengelige oppskrifter. Prøv å følg noen
                            for å se oppskrifter!
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
