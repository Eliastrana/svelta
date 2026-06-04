import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleRecipeInCollection } from '@/helpers/collectionHelpers';

export function useToggleRecipeInCollection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            collectionId,
            recipeId,
            inCollection,
            ownerId,
        }: {
            collectionId: string;
            recipeId: string;
            inCollection: boolean;
            ownerId: string;
        }) =>
            toggleRecipeInCollection(
                collectionId,
                recipeId,
                inCollection,
                ownerId
            ),
        onSuccess: (_res, vars) => {
            qc.invalidateQueries({
                queryKey: ['collectionRecipes', vars.collectionId],
            });
            qc.invalidateQueries({
                queryKey: ['collectionSummary', vars.collectionId],
            });
            qc.invalidateQueries({ queryKey: ['collections', vars.ownerId] });
        },
    });
}
