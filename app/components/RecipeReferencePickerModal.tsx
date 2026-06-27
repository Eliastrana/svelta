'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AppModal from '@/app/components/AppModal';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { fetchRecipesByUsers } from '@/helpers/fetchRecipesByUsers';
import { filterVisibleRecipes } from '@/helpers/recipeVisibility';
import { LinkedRecipeReference } from '@/app/types/CookingStep';
import { Recipe } from '@/app/types/Recipe';
import { UserDoc } from '@/hooks/useUserData';
import Image from 'next/image';

type FollowedUserItem = {
    id: string;
    name: string;
    photoURL?: string;
    recipeCount: number;
};

type Props = {
    currentUserId: string;
    excludeRecipeId?: string;
    followingIds: string[];
    onClose: () => void;
    onSelect: (recipe: LinkedRecipeReference) => void;
};

type ViewState = {
    direction: 1 | -1;
    selectedUserId: string | null;
};

function toReference(recipe: Recipe): LinkedRecipeReference {
    return {
        id: recipe.id,
        title: recipe.title?.trim() || 'Oppskrift uten tittel',
        coverImage: recipe.coverImage,
    };
}

export default function RecipeReferencePickerModal({
    currentUserId,
    excludeRecipeId,
    followingIds,
    onClose,
    onSelect,
}: Props) {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [users, setUsers] = React.useState<FollowedUserItem[]>([]);
    const [recipesByUser, setRecipesByUser] = React.useState<
        Record<string, Recipe[]>
    >({});
    const [{ direction, selectedUserId }, setViewState] =
        React.useState<ViewState>({
            direction: 1,
            selectedUserId: null,
        });
    const candidateUserIds = React.useMemo(
        () =>
            Array.from(
                new Set(
                    [currentUserId, ...followingIds].filter(
                        (id): id is string => Boolean(id)
                    )
                )
            ),
        [currentUserId, followingIds]
    );

    React.useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!candidateUserIds.length) {
                setUsers([]);
                setRecipesByUser({});
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const [usersMap, recipes] = await Promise.all([
                    fetchManyUsers(candidateUserIds),
                    fetchRecipesByUsers(candidateUserIds),
                ]);

                if (cancelled) return;

                const visibleRecipes = filterVisibleRecipes(
                    recipes,
                    currentUserId,
                    followingIds
                )
                    .filter((recipe) => recipe.id !== excludeRecipeId)
                    .sort((a, b) => {
                        const aTime = a.createdAt?.toMillis?.() ?? 0;
                        const bTime = b.createdAt?.toMillis?.() ?? 0;
                        return bTime - aTime;
                    });

                const nextRecipesByUser = visibleRecipes.reduce<
                    Record<string, Recipe[]>
                >((acc, recipe) => {
                    if (!acc[recipe.userId]) acc[recipe.userId] = [];
                    acc[recipe.userId].push(recipe);
                    return acc;
                }, {});

                const orderedUserIds = [
                    currentUserId,
                    ...candidateUserIds.filter((id) => id !== currentUserId),
                ];

                const nextUserList = orderedUserIds
                    .filter((id) => (nextRecipesByUser[id] ?? []).length > 0)
                    .map((id) => {
                        const user = (usersMap[id] ?? {}) as UserDoc;
                        return {
                            id,
                            name:
                                user.name?.trim() || 'Kokk uten brukernavn',
                            photoURL: user.photoURL,
                            recipeCount: nextRecipesByUser[id]?.length ?? 0,
                        };
                    });

                setUsers(nextUserList);
                setRecipesByUser(nextRecipesByUser);
            } catch (nextError) {
                console.error('Could not load followed recipes for reference:', nextError);
                if (!cancelled) {
                    setError('Kunne ikke hente oppskrifter akkurat nå.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [candidateUserIds, currentUserId, excludeRecipeId, followingIds]);

    const selectedUser = React.useMemo(
        () => users.find((user) => user.id === selectedUserId) ?? null,
        [selectedUserId, users]
    );

    const selectedRecipes = React.useMemo(
        () => (selectedUserId ? recipesByUser[selectedUserId] ?? [] : []),
        [recipesByUser, selectedUserId]
    );

    const changeView = (nextUserId: string | null, nextDirection: 1 | -1) => {
        setViewState({
            selectedUserId: nextUserId,
            direction: nextDirection,
        });
    };

    const getEnterAnimation = (nextDirection: 1 | -1) => ({
        x: nextDirection > 0 ? 56 : -56,
        opacity: 0,
    });

    const getExitAnimation = (nextDirection: 1 | -1) => ({
        x: nextDirection > 0 ? -56 : 56,
        opacity: 0,
    });

    return (
        <AppModal
            onClose={onClose}
            panelClassName="w-[92vw] max-w-lg overflow-hidden rounded-[28px] border border-[#ddd8ca] bg-[#fbfaf4] shadow-2xl"
        >
            {({ closeWithAnim, closing }) => (
                <div className="flex max-h-[78vh] min-h-[520px] flex-col">
                    <div className="flex items-center justify-between border-b border-[#e5e1d4] px-5 py-4">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#7a7a6a]">
                                Oppskriftsreferanse
                            </p>
                            <h2 className="truncate text-lg font-semibold text-[#12340d]">
                                {selectedUser
                                    ? selectedUser.name
                                    : 'Velg en kokk du følger'}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="grid h-10 w-10 place-items-center rounded-full text-[#12340d] transition hover:bg-[#ece7d9] active:scale-95"
                            aria-label="Lukk modal"
                        >
                            <span className="material-symbols-outlined">
                                close
                            </span>
                        </button>
                    </div>

                    {selectedUserId ? (
                        <div className="border-b border-[#f0ecdf] px-5 py-3">
                            <button
                                type="button"
                                onClick={() => changeView(null, -1)}
                                className="inline-flex items-center gap-2 rounded-full bg-[#efe9db] px-3 py-2 text-sm font-semibold text-[#12340d] transition hover:bg-[#e4ddce]"
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    arrow_back
                                </span>
                                Tilbake til kokker
                            </button>
                        </div>
                    ) : null}

                    <div className="relative flex-1 overflow-hidden">
                        <AnimatePresence custom={direction} mode="wait">
                            {selectedUserId ? (
                                <motion.div
                                    key={`recipes-${selectedUserId}`}
                                    custom={direction}
                                    initial={getEnterAnimation(direction)}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={getExitAnimation(direction)}
                                    transition={{
                                        duration: 0.24,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    className="absolute inset-0 overflow-y-auto px-5 py-4"
                                >
                                    {selectedRecipes.length === 0 ? (
                                        <div className="rounded-3xl bg-white p-5 text-sm text-[#496444] shadow-sm">
                                            Ingen oppskrifter tilgjengelig.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedRecipes.map((recipe) => (
                                                <button
                                                    key={recipe.id}
                                                    type="button"
                                                    onClick={() => {
                                                        onSelect(
                                                            toReference(recipe)
                                                        );
                                                        closeWithAnim();
                                                    }}
                                                    className="flex w-full items-center gap-3 rounded-3xl border border-[#e5e1d4] bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-[#d3cdbd] hover:bg-[#fffdf7]"
                                                >
                                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#ece7d9]">
                                                        {recipe.coverImage ? (
                                                            <Image
                                                                width={64}
                                                                height={64}
                                                                src={
                                                                    recipe.coverImage
                                                                }
                                                                alt={
                                                                    recipe.title
                                                                }
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[#496444]">
                                                                restaurant
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-base font-semibold text-[#12340d]">
                                                            {recipe.title}
                                                        </p>
                                                        <p className="mt-1 line-clamp-2 text-sm text-[#5d6e57]">
                                                            {recipe.description?.trim() ||
                                                                'Trykk for å velge denne oppskriften som referanse.'}
                                                        </p>
                                                    </div>

                                                    <span className="material-symbols-outlined text-[#496444]">
                                                        arrow_forward
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="users"
                                    custom={direction}
                                    initial={getEnterAnimation(direction)}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={getExitAnimation(direction)}
                                    transition={{
                                        duration: 0.24,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    className="absolute inset-0 overflow-y-auto px-5 py-4"
                                >
                                    {loading ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: 5 }).map(
                                                (_, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm"
                                                    >
                                                        <div className="h-14 w-14 animate-pulse rounded-2xl bg-[#ece7d9]" />
                                                        <div className="flex-1">
                                                            <div className="h-4 w-32 animate-pulse rounded bg-[#ece7d9]" />
                                                            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[#f2eee1]" />
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ) : error ? (
                                        <div className="rounded-3xl bg-white p-5 text-sm text-red-600 shadow-sm">
                                            {error}
                                        </div>
                                    ) : candidateUserIds.length === 1 &&
                                      candidateUserIds[0] === currentUserId ? (
                                        <div className="rounded-3xl bg-white p-5 shadow-sm">
                                            <h3 className="text-base font-semibold text-[#12340d]">
                                                Bare dine egne oppskrifter tilgjengelig
                                            </h3>
                                            <p className="mt-1 text-sm text-[#496444]">
                                                Du kan fortsatt referere til dine
                                                egne oppskrifter her. Følg flere
                                                kokker for å få dem med i listen.
                                            </p>
                                        </div>
                                    ) : users.length === 0 ? (
                                        <div className="rounded-3xl bg-white p-5 shadow-sm">
                                            <h3 className="text-base font-semibold text-[#12340d]">
                                                Ingen oppskrifter å velge mellom
                                            </h3>
                                            <p className="mt-1 text-sm text-[#496444]">
                                                Ingen av kokkene du følger har
                                                tilgjengelige oppskrifter akkurat
                                                nå.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {users.map((user) => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() =>
                                                        changeView(user.id, 1)
                                                    }
                                                    className="flex w-full items-center gap-3 rounded-3xl border border-[#e5e1d4] bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-[#d3cdbd] hover:bg-[#fffdf7]"
                                                >
                                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#ece7d9]">
                                                        {user.photoURL ? (
                                                            <img
                                                                src={
                                                                    user.photoURL
                                                                }
                                                                alt={user.name}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[#496444]">
                                                                person
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-base font-semibold text-[#12340d]">
                                                            {user.name}
                                                        </p>
                                                        <p className="mt-1 text-sm text-[#5d6e57]">
                                                            {user.recipeCount}{' '}
                                                            {user.recipeCount ===
                                                            1
                                                                ? 'oppskrift'
                                                                : 'oppskrifter'}
                                                        </p>
                                                    </div>

                                                    <span className="material-symbols-outlined text-[#496444]">
                                                        arrow_forward
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </AppModal>
    );
}
