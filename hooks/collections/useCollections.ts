import { fetchCollections } from '@/helpers/collectionHelpers';
import { useQuery } from '@tanstack/react-query';

export function useCollections(uid: string) {
    return useQuery({
        queryKey: ['collections', uid],
        queryFn : () => fetchCollections(uid),
        enabled : !!uid,
        placeholderData: (prev) => prev ?? [],
    });
}