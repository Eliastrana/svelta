import { fetchCollectionSummary } from '@/helpers/collectionHelpers';
import { useQueries } from '@tanstack/react-query';

type CollectionSummaryItem = {
    id: string;
};

export function useCollectionSummaries(collections: CollectionSummaryItem[]) {
    const summaryQueries = useQueries({
        queries: collections.map((collection) => ({
            queryKey: ['collectionSummary', collection.id],
            queryFn: () => fetchCollectionSummary(collection.id),
            enabled: !!collection.id,
            staleTime: 60_000,
        })),
    });

    return collections.reduce<
        Record<string, { previewImage: string; recipeCount: number }>
    >((acc, collection, index) => {
        acc[collection.id] = summaryQueries[index]?.data ?? {
            previewImage: '',
            recipeCount: 0,
        };
        return acc;
    }, {});
}
