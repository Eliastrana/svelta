import { fetchCollectionRecipes } from '@/helpers/collectionHelpers';
import { useQuery } from '@tanstack/react-query';

export function useCollectionRecipes(collectionId: string, enabled = true) {
    return useQuery({
        queryKey: ['collectionRecipes', collectionId],
        queryFn : () => fetchCollectionRecipes(collectionId),
        enabled : !!collectionId && enabled,
        placeholderData: (prev) => prev ?? [],
    });
}
