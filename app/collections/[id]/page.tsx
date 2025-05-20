'use client';

import { useParams, useRouter } from 'next/navigation';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { useQuery } from '@tanstack/react-query';
import RecipeCard from '@/app/components/RecipeCard';
import { useCollectionRecipes } from '@/hooks/collections/useCollectionRecipies';

export default function CollectionPage() {
    const { id } = useParams<{ id: string }>();
    const router  = useRouter();

    const { data: entries = [], isLoading } = useCollectionRecipes(id);

    const uniqueUserIds = [...new Set(entries.map((e) => e.recipe.userId))];
    const { data: usersMap = {} } = useQuery({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn : () => fetchManyUsers(uniqueUserIds),
        enabled : uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
    });

    if (isLoading) return <div className="p-4">Laster…</div>;

    return (
        <div className="p-4 md:mx-auto">
            <button onClick={() => router.back()} className="mb-4">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>

            <h1 className="text-3xl font-bold mb-6">Liste</h1>

            {entries.length === 0 ? (
                <p>Ingen oppskrifter i denne listen.</p>
            ) : (
                <div className="grid grid-cols-3 md:gap-10 gap-20 mb-20">
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
