'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useCollections } from '@/hooks/collections/useCollections';
import { useCollectionRecipes } from '@/hooks/collections/useCollectionRecipies';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { useQuery } from '@tanstack/react-query';
import { getFirestore, collection, getCountFromServer } from 'firebase/firestore';
import RecipeCard from '@/app/components/RecipeCard';
import { Recipe } from '@/app/types/Recipe';
import React from 'react';

export default function CollectionPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const user = useAuthUser();
    const uid = user?.uid ?? '';

    // user's own collections
    const { data: collections = [], isLoading: collectionsLoading } = useCollections(uid);

    // raw entries of recipes in this collection
    const { data: entries = [], isLoading: recipesLoading } = useCollectionRecipes(id);

    // hydrate recipes with live counts
    const [hydrated, setHydrated] = React.useState<{ recipe: Recipe }[]>([]);
    React.useEffect(() => {
        if (!entries.length) {
            setHydrated([]);
            return;
        }
        const db = getFirestore();
        (async () => {
            const results = await Promise.all(
                entries.map(async ({ recipe }) => {
                    const likesSnap = await getCountFromServer(
                        collection(db, 'recipes', recipe.id, 'likes')
                    );
                    const commentsSnap = await getCountFromServer(
                        collection(db, 'recipes', recipe.id, 'comments')
                    );
                    return { recipe: { ...recipe, likes: likesSnap.data().count, comments: commentsSnap.data().count } };
                })
            );
            results.sort((a, b) => Number(b.recipe.createdAt) - Number(a.recipe.createdAt));
            setHydrated(results);
        })();
    }, [entries]);

    const recipes = hydrated.map(({ recipe }) => recipe);

    // fetch creators
    const uniqueUserIds = [...new Set(recipes.map((r) => r.userId))];
    const { data: usersMap = {} } = useQuery({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: {},
    });

    if (collectionsLoading || recipesLoading) return <div className="p-4">Laster…</div>;

    const currentCollection = collections.find((c) => c.id === id);
    const title = currentCollection?.name ?? 'Liste';

    return (
        <div className="p-4 md:mb-20">
            <button onClick={() => router.back()} className="mb-4">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>

            <h1 className="md:text-8xl text-4xl font-bold mb-6">{title}</h1>

            {recipes.length === 0 ? (
                <p>
                    Ingen oppskrifter i listen <em>{title}</em>.
                </p>
            ) : (
                <div className="grid md:grid-cols-3 grid-cols-1 md:gap-10 gap-20 mb-20">
                    {recipes.map((recipe) => (
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
