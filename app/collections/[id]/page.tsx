'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useCollections } from '@/hooks/collections/useCollections';
import { useCollectionRecipes } from '@/hooks/collections/useCollectionRecipies';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { useQuery } from '@tanstack/react-query';
import RecipeCard from '@/app/components/RecipeCard';
import { Recipe } from '@/app/types/Recipe';
import { Timestamp } from 'firebase/firestore';
import { UserDoc } from '@/hooks/useUserData';

type CollectionEntry = { recipe: Recipe };

const createdAtToMillis = (createdAt: Timestamp | Date | number | undefined): number => {
    if (!createdAt) return 0;
    if (createdAt instanceof Timestamp) return createdAt.toMillis();
    if (createdAt instanceof Date) return createdAt.getTime();
    return createdAt; // number (assumes millis)
};

export default function CollectionPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const user = useAuthUser();
    const uid = user?.uid ?? '';



    // user's own collections
    const { data: collections = [], isLoading: collectionsLoading } = useCollections(uid);

    // raw entries of recipes in this collection
    const { data: entries = [], isLoading: recipesLoading } = useCollectionRecipes(id);

    // ✅ no hydration; recipes already contain likeCount/commentCount
    const recipes: Recipe[] = React.useMemo(() => {
        const list = (entries as CollectionEntry[]).map((e) => e.recipe);
        // stable sort (createdAt is Timestamp)
        return list.sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
    }, [entries]);

    // fetch creators
    const uniqueUserIds = React.useMemo(
        () => Array.from(new Set(recipes.map((r) => r.userId))),
        [recipes],
    );

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
        staleTime: 60_000,
    });

    if (collectionsLoading || recipesLoading) return <div className="p-4">Laster…</div>;

    const currentCollection = collections.find((c) => c.id === id);
    const title = currentCollection?.name ?? 'Liste';

        return (
        <div className="p-4 md:mb-20 md:max-w-5xl md:w-2/3 md:mx-auto">
            <button onClick={() => router.back()} className="confirm-button mb-4">
                <span className="material-symbols-outlined">arrow_back</span>
                Tilbake
            </button>

            <h1 className="md:text-5xl text-4xl font-bold mb-6">{title}</h1>

            {recipes.length === 0 ? (
                <p>
                    Ingen oppskrifter i listen <em>{title}</em>.
                </p>
            ) : (
                <div className="grid md:grid-cols-2 grid-cols-1 md:gap-10 gap-20 mb-20 ">
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} creator={usersMap[recipe.userId]} />
                    ))}
                </div>
            )}
        </div>
    );
}
