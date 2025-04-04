'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import UserSearchModal from '@/app/components/UserSearchModal';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { useFollowedRecipes } from '@/hooks/useFollowedRecipes';
import { fetchUserData } from '@/helpers/fetchUserData';
import RecipeCard from '@/app/components/RecipeCard';
import { UserDoc } from '@/hooks/useUserData';

const Home = () => {
    const router = useRouter();
    const user = useAuthUser();
    const following = useUserFollowing(user?.uid || '');
    const [recipes, loading] = useFollowedRecipes(user?.uid || '', following);
    const [showModal, setShowModal] = React.useState(false);
    const [usersMap, setUsersMap] = React.useState<Record<string, UserDoc>>({});

    React.useEffect(() => {
        const uniqueUserIds = Array.from(new Set(recipes.map((r) => r.userId)));
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
    }, [recipes]);

    if (loading) return <div className="p-4">Laster...</div>;

    return (
        <div className="max-w-4xl md:w-2/3 mx-auto md:mb-20 p-2">
            <div className="flex items-center justify-between mb-4">
                <h1 className="md:text-6xl text-4xl font-bold mb-4">
                    Nyeste oppskrifter
                </h1>
                <div
                    onClick={() => {
                        if (user) {
                            router.push(`/user/${user.uid}`);
                        } else {
                            alert('No user logged in');
                        }
                    }}
                    className="flex items-center justify-between mb-4 cursor-pointer"
                >
                    {/* Optionally add a user icon */}
                </div>
            </div>

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
