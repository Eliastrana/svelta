import { createCollection } from '@/helpers/collectionHelpers';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateCollection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ uid, name }: { uid: string; name: string }) =>
            createCollection(uid, name),
        onSuccess: (_res, vars) => {
            queryClient.invalidateQueries({ queryKey: ['collections', vars.uid] });
        },
    });
}