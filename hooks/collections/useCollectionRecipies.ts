import { fetchCollectionRecipes } from '@/helpers/collectionHelpers';
import { useQuery } from '@tanstack/react-query';

export function useCollectionRecipes(collectionId: string) {
    return useQuery({
        queryKey: ['collectionRecipes', collectionId],
        queryFn : () => fetchCollectionRecipes(collectionId),
        enabled : !!collectionId,
        placeholderData: (prev) => prev ?? [],
    });
}