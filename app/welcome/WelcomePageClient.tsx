'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { motion, useReducedMotion } from 'framer-motion';

import RecipeCard from '@/app/components/RecipeCard';
import { Recipe } from '@/app/types/Recipe';
import { UserDoc } from '@/hooks/useUserData';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { fetchPopularRecipesPage } from '@/helpers/fetchPopularRecipesPage';

const PAGE_SIZE = 8;

const landingHeroVariants = {
    hidden: { opacity: 0, y: 28, filter: 'blur(18px)' },
    show: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.95,
            ease: [0.22, 1, 0.36, 1] as const,
            staggerChildren: 0.14,
        },
    },
};

const landingHeroItemVariants = {
    hidden: { opacity: 0, y: 18, filter: 'blur(14px)' },
    show: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.85,
            ease: [0.22, 1, 0.36, 1] as const,
        },
    },
};

const SkeletonCard: React.FC = () => {
    return (
        <div className="animate-pulse">
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="h-72 bg-slate-100" />
            </div>

            <div className="mt-4 space-y-2">
                <div className="h-7 w-2/3 rounded-xl bg-slate-100" />
                <div className="h-4 w-full rounded-xl bg-slate-100" />
                <div className="h-4 w-5/6 rounded-xl bg-slate-100" />
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-slate-100" />
                    <div className="space-y-2">
                        <div className="h-4 w-28 rounded-xl bg-slate-100" />
                        <div className="h-3 w-36 rounded-xl bg-slate-100" />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-5 w-12 rounded-xl bg-slate-100" />
                    <div className="h-5 w-12 rounded-xl bg-slate-100" />
                </div>
            </div>
        </div>
    );
};

const PublicGallery: React.FC<{
    recipes: Recipe[];
    loading: boolean;
    onRecipeClick: (recipeId: string) => void;
}> = ({ recipes, loading, onRecipeClick }) => {
    const shouldReduceMotion = useReducedMotion();

    if (loading && recipes.length === 0) {
        return (
            <div className="relative left-1/2 mt-8 w-screen -translate-x-1/2 overflow-hidden px-4 md:px-8 lg:px-12">
                <div className="flex gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={`gallery-sk-${index}`}
                            className="gallery-card shrink-0 animate-pulse"
                        >
                            <div className="aspect-[4/5] rounded-[24px] bg-slate-100" />
                            <div className="mt-3 h-5 w-3/4 rounded-full bg-slate-100" />
                            <div className="mt-2 h-4 w-1/2 rounded-full bg-slate-100" />
                        </div>
                    ))}
                </div>

                <style jsx>{`
                    .gallery-card {
                        width: clamp(220px, 24vw, 360px);
                    }

                    @media (max-width: 640px) {
                        .gallery-card {
                            width: min(72vw, 300px);
                        }
                    }
                `}</style>
            </div>
        );
    }

    if (recipes.length === 0) return null;

    const trackRecipes = [...recipes, ...recipes];

    return (
        <div className="relative left-1/2 mt-8 w-screen -translate-x-1/2">
            <div className="gallery-mask mt-5 px-4 md:px-8 lg:px-12">
                <div className="gallery-track">
                    {trackRecipes.map((recipe, index) => (
                        <button
                            key={`${recipe.id}-${index}`}
                            type="button"
                            onClick={() => onRecipeClick(recipe.id)}
                            className="gallery-card group"
                            aria-label={`Åpne oppskriften ${recipe.title}`}
                        >
                            <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[#f2f1e8]">
                                {recipe.coverImage ? (
                                    <Image
                                        src={recipe.coverImage}
                                        alt={recipe.title}
                                        fill
                                        sizes="(max-width: 1000px) 72vw, (max-width: 1600px) 32vw, 24vw"
                                        className="object-cover transition duration-500 group-hover:scale-[1.03] hover:cursor-pointer"
                                    />
                                ) : (
                                    <div className="grid h-full w-full place-items-center text-5xl text-[#496444]">
                                        🍽️
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .gallery-mask {
                    overflow: hidden;
                }

                .gallery-track {
                    display: flex;
                    width: max-content;
                    gap: 1rem;
                    animation: ${shouldReduceMotion
                        ? 'none'
                        : 'publicGalleryScroll 42s linear infinite'};
                }

                .gallery-track:hover {
                    animation-play-state: paused;
                }

                .gallery-card {
                    width: clamp(450px, 24vw, 540px);
                    flex-shrink: 0;
                    border-radius: 24px;
                    transition: transform 180ms ease;
                }

                .gallery-card:hover {
                    transform: translateY(-2px);
                }

                @keyframes publicGalleryScroll {
                    from {
                        transform: translateX(0);
                    }
                    to {
                        transform: translateX(calc(-50% - 0.5rem));
                    }
                }

                @media (max-width: 640px) {
                    .gallery-card {
                        width: min(72vw, 300px);
                    }

                    .gallery-track {
                        gap: 0.75rem;
                        animation-duration: ${shouldReduceMotion
                            ? '0s'
                            : '34s'};
                    }
                }
            `}</style>
        </div>
    );
};

export default function WelcomePageClient() {
    const router = useRouter();
    const shouldReduceMotion = useReducedMotion();

    const heroVariants = React.useMemo(
        () =>
            shouldReduceMotion
                ? {
                      hidden: { opacity: 1, y: 0, filter: 'blur(0px)' },
                      show: { opacity: 1, y: 0, filter: 'blur(0px)' },
                  }
                : landingHeroVariants,
        [shouldReduceMotion]
    );

    const heroItemVariants = React.useMemo(
        () =>
            shouldReduceMotion
                ? {
                      hidden: { opacity: 1, y: 0, filter: 'blur(0px)' },
                      show: { opacity: 1, y: 0, filter: 'blur(0px)' },
                  }
                : landingHeroItemVariants,
        [shouldReduceMotion]
    );

    const {
        data: popularData,
        isLoading: loadingPopular,
        fetchNextPage: fetchNextPopular,
        hasNextPage: hasNextPopular,
        isFetchingNextPage: fetchingNextPopular,
        isError: popularIsError,
        error: popularErr,
    } = useInfiniteQuery({
        queryKey: ['popularRecipesInfinite', PAGE_SIZE],
        initialPageParam: null as QueryDocumentSnapshot | null,
        queryFn: ({ pageParam }) =>
            fetchPopularRecipesPage({
                pageSize: PAGE_SIZE,
                cursor: pageParam,
            }),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

    const popularRecipes: Recipe[] = React.useMemo(
        () => popularData?.pages.flatMap((page) => page.items) ?? [],
        [popularData]
    );

    const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (!hasNextPopular) return;

        const el = loadMoreRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !fetchingNextPopular) {
                    fetchNextPopular();
                }
            },
            { rootMargin: '600px' }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [fetchNextPopular, fetchingNextPopular, hasNextPopular]);

    const uniqueUserIds = React.useMemo(() => {
        const ids = new Set<string>();
        popularRecipes.forEach((recipe) => ids.add(recipe.userId));
        return Array.from(ids);
    }, [popularRecipes]);

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
    });

    return (
        <div className="p-4 md:mx-auto md:mb-24 md:max-w-5xl lg:w-2/3">
            <motion.section
                className="py-8 pt-20 md:pt-40"
                variants={heroVariants}
                initial="hidden"
                animate="show"
            >
                <div className="max-w-5xl sm:mx-auto">
                    <motion.div
                        className="flex flex-col items-center gap-4 sm:flex-row sm:items-stretch"
                        variants={heroItemVariants}
                    >
                        <motion.div
                            className="relative h-20 w-20 shrink-0 sm:h-auto"
                            variants={heroItemVariants}
                        >
                            <Image
                                src="/brod.png"
                                alt="Brod"
                                fill
                                className="object-contain"
                            />
                        </motion.div>

                        <motion.h1
                            className="text-center text-4xl font-semibold tracking-tight text-slate-900 sm:text-left sm:text-5xl"
                            variants={heroItemVariants}
                        >
                            Oppskrifter, kokebøker og matglede samlet på ett
                            sosialt medium
                        </motion.h1>
                    </motion.div>

                    <motion.p
                        className="mx-auto mt-4 text-center text-base leading-relaxed text-slate-600 sm:text-left sm:text-lg"
                        variants={heroItemVariants}
                    >
                        Svelta er en sosial oppskriftsapp der du kan dele egne
                        retter, oppdage nye favoritter, følge andre kokker og
                        lagre oppskrifter i egne kokebøker.
                    </motion.p>

                    <motion.div
                        className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-start"
                        variants={heroItemVariants}
                    >
                        <motion.button
                            type="button"
                            onClick={() => router.push('/login')}
                            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 font-semibold text-white transition hover:opacity-95 active:scale-[0.99]"
                            whileHover={
                                shouldReduceMotion ? undefined : { y: -1 }
                            }
                            whileTap={
                                shouldReduceMotion
                                    ? undefined
                                    : { scale: 0.99 }
                            }
                        >
                            Bli med!
                        </motion.button>
                    </motion.div>
                </div>

                <PublicGallery
                    recipes={popularRecipes}
                    loading={loadingPopular}
                    onRecipeClick={(recipeId) => router.push(`/recipe/${recipeId}`)}
                />
            </motion.section>

            <div className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                    Populære oppskrifter på Svelta
                </h2>
                <p className="mt-2 text-sm text-slate-600 md:text-base">
                    Utforsk offentlige oppskrifter fra våre flinke kokker!
                </p>
            </div>

            {popularIsError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Klarte ikke å hente populære oppskrifter:{' '}
                    {String(popularErr?.message ?? popularErr)}
                </div>
            ) : null}

            <div className="mb-40">
                {loadingPopular && popularRecipes.length === 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-10 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <SkeletonCard key={`sk-${index}`} />
                        ))}
                    </div>
                ) : popularRecipes.length === 0 ? (
                    <div className="mt-6">
                        <p className="text-slate-600">
                            Ingen tilgjengelige oppskrifter.
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {popularRecipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    creator={usersMap[recipe.userId]}
                                />
                            ))}
                        </div>

                        {hasNextPopular ? (
                            <div ref={loadMoreRef} className="h-10" />
                        ) : null}

                        {fetchingNextPopular ? (
                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                {Array.from({ length: 2 }).map((_, index) => (
                                    <SkeletonCard key={`sk-next-${index}`} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
