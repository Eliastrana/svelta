import { createCollection } from '@/helpers/collectionHelpers';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateCollection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            uid,
            name,
            coverImage,
            description,
            isPublic,
        }: {
            uid: string;
            name: string;
            coverImage?: string;
            description?: string;
            isPublic?: boolean;
        }) => createCollection(uid, name, coverImage, description, isPublic),
        onSuccess: (_res, vars) => {
            queryClient.invalidateQueries({
                queryKey: ['collections', vars.uid],
            });
        },
    });
}
