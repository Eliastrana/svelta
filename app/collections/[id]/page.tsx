'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useCollections } from '@/hooks/collections/useCollections';
import { useCollectionRecipes } from '@/hooks/collections/useCollectionRecipies';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { useQuery } from '@tanstack/react-query';
import RecipeCard from '@/app/components/RecipeCard';

export default function CollectionPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    // get current user
    const user = useAuthUser();
    const uid = user?.uid ?? '';

    // fetch all collections so we can grab the name
    const {
        data: collections = [],
        isLoading: collectionsLoading,
    } = useCollections(uid);

    // fetch the entries in this one collection
    const {
        data: entries = [],
        isLoading: recipesLoading,
    } = useCollectionRecipes(id);

    // while either collection-list or recipes are loading...
    if (collectionsLoading || recipesLoading) {
        return <div className="p-4">Laster…</div>;
    }

    // find the current collection object to get its name
    const currentCollection = collections.find((c) => c.id === id);
    const title = currentCollection?.name ?? 'Liste';

    // build unique user IDs from the fetched recipes
    const uniqueUserIds = [
        ...new Set(entries.map((e) => e.recipe.userId)),
    ];

    // fetch all those users in one go
    const { data: usersMap = {} } = useQuery({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: {},
    });

    return (
        <div className="p-4 md:mx-auto">
            <button onClick={() => router.back()} className="mb-4">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>

            <h1 className="md:text-8xl text-4xl font-bold mb-6">{title}</h1>

            {entries.length === 0 ? (
                <p>Ingen oppskrifter i listen <em>{title}</em>.</p>
            ) : (
                <div className="grid md:grid-cols-3 grid-cols-1 md:gap-10 gap-20 mb-20">
                    {entries.map(({ recipe }) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            creator={usersMap[recipe.userId]}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
