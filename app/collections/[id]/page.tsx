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

    const user = useAuthUser();
    const uid = user?.uid ?? '';

    const {
        data: collections = [],
        isLoading: collectionsLoading,
    } = useCollections(uid);

    const {
        data: entries = [],
        isLoading: recipesLoading,
    } = useCollectionRecipes(id);

    const uniqueUserIds = [
        ...new Set(entries.map((e) => e.recipe.userId)),
    ];

    const { data: usersMap = {} } = useQuery({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: {},
    });

    if (collectionsLoading || recipesLoading) {
        return <div className="p-4">Laster…</div>;
    }

    const currentCollection = collections.find((c) => c.id === id);
    const title = currentCollection?.name ?? 'Liste';

    return (
        <div className="p-4 md:mx-auto">
            <button onClick={() => router.back()} className="mb-4">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>

            <h1 className="md:text-8xl text-4xl font-bold mb-6">{title}</h1>

            {entries.length === 0 ? (
                <p>
                    Ingen oppskrifter i listen <em>{title}</em>.
                </p>
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
