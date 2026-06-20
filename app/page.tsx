'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';

import RecipeCard from '@/app/components/RecipeCard';
import MostActiveCreators from '@/app/components/MostActiveCreators';
import OnboardingIntro from '@/app/components/OnboardingIntro';
import NotificationsButton from '@/app/components/NotificationsButton';

import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { ensureUserDocument } from '@/helpers/ensureUserDocument';
import { fetchFollowedRecipes } from '@/helpers/fetchFollowedRecipies';
import { fetchPopularRecipesPage } from '@/helpers/fetchPopularRecipesPage';
import { DEFAULT_PROFILE_THEME_ID } from '@/helpers/profileAppearance';

import { Recipe } from '@/app/types/Recipe';
import { UserDoc } from '@/hooks/useUserData';
import { QueryDocumentSnapshot } from 'firebase/firestore';

type Feed = 'following' | 'popular';

type IngredientDetailed = { name: string; amount: string };

// Utvider Recipe lokalt (uten å endre globale typer)
type SearchableRecipe = Recipe & {
    ingredients?: string[]; // legacy
    ingredientsDetailed?: IngredientDetailed[]; // new
};

const SkeletonCard: React.FC = () => {
    return (
        <div className="animate-pulse">
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
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
                    {trackRecipes.map((recipe, index) => {
                        return (
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

                                {/*<div className="px-1 pt-3 text-left">*/}
                                {/*    <p className="line-clamp-2 text-lg font-semibold leading-tight text-slate-900">*/}
                                {/*        {recipe.title}*/}
                                {/*    </p>*/}
                                {/*    <p className="mt-1 truncate text-sm text-slate-600">*/}
                                {/*        {creator?.name || 'Svelta-kokk'}*/}
                                {/*    </p>*/}
                                {/*</div>*/}
                            </button>
                        );
                    })}
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

const normalize = (s: string) =>
    s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

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

const Home: React.FC = () => {
    const router = useRouter();
    const user = useAuthUser();
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

    const [activeFeed, setActiveFeed] = React.useState<Feed>('popular');
    const [search, setSearch] = React.useState('');
    const [viewerProfile, setViewerProfile] = React.useState<UserDoc | null>(
        null
    );
    const [showOnboarding, setShowOnboarding] = React.useState(false);
    const [onboardingResolved, setOnboardingResolved] = React.useState(false);

    const following = useUserFollowing(user?.uid ?? '');
    const isLoggedIn = !!user?.uid;

    React.useEffect(() => {
        let cancelled = false;

        const loadViewerProfile = async () => {
            if (!user) {
                setViewerProfile(null);
                setShowOnboarding(false);
                setOnboardingResolved(true);
                return;
            }

            setOnboardingResolved(false);
            const result = await ensureUserDocument(user);
            if (cancelled) return;

            const nextProfile = result.data as UserDoc;
            setViewerProfile(nextProfile);
            setShowOnboarding(nextProfile.hasCompletedOnboarding === false);
            setOnboardingResolved(true);
        };

        void loadViewerProfile();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const followsNobody = isLoggedIn && following.length === 0;
    const followsSomebody = isLoggedIn && following.length > 0;

    const { data: followedRecipes = [], isLoading: loadingFollowed } = useQuery<
        Recipe[],
        Error
    >({
        queryKey: ['followedRecipes', following],
        queryFn: () => fetchFollowedRecipes(following),
        enabled:
            isLoggedIn && activeFeed === 'following' && following.length > 0,
        placeholderData: (prev) => prev ?? [],
    });

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
        enabled: activeFeed === 'popular',
        initialPageParam: null as QueryDocumentSnapshot | null,
        queryFn: ({ pageParam }) =>
            fetchPopularRecipesPage({
                pageSize: PAGE_SIZE,
                cursor: pageParam,
            }),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

    const popularRecipes: Recipe[] = React.useMemo(
        () => popularData?.pages.flatMap((p) => p.items) ?? [],
        [popularData]
    );

    const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (activeFeed !== 'popular') return;
        if (!hasNextPopular) return;

        const el = loadMoreRef.current;
        if (!el) return;

        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !fetchingNextPopular) {
                    fetchNextPopular();
                }
            },
            { rootMargin: '600px' }
        );

        obs.observe(el);
        return () => obs.disconnect();
    }, [activeFeed, hasNextPopular, fetchNextPopular, fetchingNextPopular]);

    const baseRecipes: SearchableRecipe[] =
        activeFeed === 'following'
            ? (followedRecipes as SearchableRecipe[])
            : (popularRecipes as SearchableRecipe[]);

    const q = React.useMemo(() => normalize(search), [search]);

    const recipes: SearchableRecipe[] = React.useMemo(() => {
        if (!q) return baseRecipes;

        return baseRecipes.filter((r) => {
            const title = normalize(r.title ?? '');
            const desc = normalize(r.description ?? '');

            const ingLegacy = Array.isArray(r.ingredients)
                ? r.ingredients.join(' ')
                : '';

            const ingDetailed = Array.isArray(r.ingredientsDetailed)
                ? r.ingredientsDetailed
                      .map((i) => `${i.amount ?? ''} ${i.name ?? ''}`)
                      .join(' ')
                : '';

            const tags = Array.isArray(r.tags) ? r.tags.join(' ') : '';
            const hay = `${title} ${desc} ${normalize(ingLegacy)} ${normalize(ingDetailed)} ${normalize(tags)}`;
            return hay.includes(q);
        });
    }, [baseRecipes, q]);

    const showPopularSkeleton = activeFeed === 'popular' && loadingPopular;
    const showFollowingCTA = activeFeed === 'following' && followsNobody;
    const showFollowingSkeleton =
        activeFeed === 'following' && followsSomebody && loadingFollowed;
    const showSkeletonGrid = showPopularSkeleton || showFollowingSkeleton;

    const uniqueUserIds = React.useMemo(() => {
        const set = new Set<string>();
        recipes.forEach((r) => set.add(r.userId));
        return Array.from(set);
    }, [recipes]);

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['usersMap', uniqueUserIds],
        queryFn: () => fetchManyUsers(uniqueUserIds),
        enabled: uniqueUserIds.length > 0,
        placeholderData: (prev) => prev ?? {},
    });

    const shouldBlockHome = Boolean(user && !onboardingResolved);
    const shouldShowOnboarding = Boolean(
        user && showOnboarding && viewerProfile
    );
    const showPublicLanding = !isLoggedIn;

    if (shouldBlockHome) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#fbfaf4] px-4">
                <div className="flex flex-col items-center gap-4 text-slate-600">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
                    <p className="text-sm font-medium">Gjør klart…</p>
                </div>
            </div>
        );
    }

    if (shouldShowOnboarding && user && viewerProfile) {
        return (
            <OnboardingIntro
                open
                uid={user.uid}
                initialName={viewerProfile.name || user.displayName || 'Kokken'}
                initialBio={viewerProfile.bio || ''}
                initialFavoriteFood={viewerProfile.favoriteFood || ''}
                initialPhotoURL={viewerProfile.photoURL || user.photoURL || ''}
                initialBackgroundPhotoURL={
                    viewerProfile.backgroundPhotoURL || ''
                }
                initialProfileThemeId={
                    viewerProfile.profileThemeId || DEFAULT_PROFILE_THEME_ID
                }
                initialProfileFontId={viewerProfile.profileFontId || 'urbanist'}
                initialIsProfilePrivate={Boolean(
                    viewerProfile.isProfilePrivate
                )}
                onComplete={(next) => {
                    setViewerProfile((prev) => ({
                        ...(prev ?? {}),
                        ...next,
                    }));
                    setShowOnboarding(false);
                    setOnboardingResolved(true);
                }}
            />
        );
    }

    return (
        <div className="p-4 md:max-w-5xl lg:w-2/3 md:mx-auto md:mb-24">
            <div className="mb-4">
                <NotificationsButton />
            </div>

            <div className="mb-3">
                {!showPublicLanding &&
                (activeFeed === 'popular' ||
                    (activeFeed === 'following' && following.length > 0)) ? (
                    <MostActiveCreators
                        mode={
                            activeFeed === 'following' ? 'following' : 'popular'
                        }
                        followingIds={
                            activeFeed === 'following' ? following : []
                        }
                        viewerUid={user?.uid ?? ''}
                        storyWindowHours={24 * 30}
                    />
                ) : null}
            </div>

            {showPublicLanding ? (
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
                            Svelta er en sosial oppskriftsapp der du kan dele
                            egne retter, oppdage nye favoritter, følge andre
                            kokker og lagre oppskrifter i egne kokebøker.
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
                        onRecipeClick={(recipeId) =>
                            router.push(`/recipe/${recipeId}`)
                        }
                    />
                </motion.section>
            ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                            search
                        </span>

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Søk etter oppskrifter, ingredienser, beskrivelser..."
                            className="w-full text-sm rounded-full border border-slate-200 bg-white py-2 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />

                        {search.trim().length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full hover:bg-slate-100"
                                aria-label="Tøm søk"
                            >
                                <span className="material-symbols-outlined text-slate-600">
                                    close
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="relative inline-flex w-full rounded-full border border-slate-200 bg-slate-50 p-1 md:w-72 md:shrink-0">
                        <div
                            className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                            style={{
                                transform:
                                    activeFeed === 'popular'
                                        ? 'translateX(100%)'
                                        : undefined,
                            }}
                        />

                        <button
                            onClick={() => setActiveFeed('following')}
                            className={`relative w-1/2 py-1 text-sm font-medium focus:outline-none flex items-center justify-center ${
                                activeFeed === 'following'
                                    ? 'text-slate-900'
                                    : 'text-slate-500'
                            }`}
                            type="button"
                        >
                            Følger
                        </button>

                        <button
                            onClick={() => setActiveFeed('popular')}
                            className={`relative w-1/2 py-1 text-sm font-medium focus:outline-none flex items-center justify-center ${
                                activeFeed === 'popular'
                                    ? 'text-slate-900'
                                    : 'text-slate-500'
                            }`}
                            type="button"
                        >
                            Populære
                        </button>
                    </div>
                </div>
            )}

            {showPublicLanding ? (
                <div className="mt-10">
                    <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                        Populære oppskrifter på Svelta
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 md:text-base">
                        Utforsk offentlige oppskrifter fra våre flinke kokker!
                    </p>
                </div>
            ) : null}

            {!showPublicLanding ? (
                <>
                    {/*{activeFeed === 'popular' && <MostActiveCreators />}*/}

                    <div className=" sticky top-0 z-30 py-2">
                        <div className="relative">
                            {/*<span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">*/}
                            {/*    search*/}
                            {/*</span>*/}

                            {/*<input*/}
                            {/*    value={search}*/}
                            {/*    onChange={(e) => setSearch(e.target.value)}*/}
                            {/*    placeholder="Søk etter oppskrifter, ingredienser, beskrivelser..."*/}
                            {/*    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-slate-200"*/}
                            {/*/>*/}

                            {/*{search.trim().length > 0 && (*/}
                            {/*    <button*/}
                            {/*        type="button"*/}
                            {/*        onClick={() => setSearch('')}*/}
                            {/*        className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full hover:bg-slate-100"*/}
                            {/*        aria-label="Tøm søk"*/}
                            {/*    >*/}
                            {/*        <span className="material-symbols-outlined text-slate-600">close</span>*/}
                            {/*    </button>*/}
                            {/*)}*/}
                        </div>

                        {q && !showSkeletonGrid && (
                            <p className="mt-2 text-sm text-slate-600">
                                Viser {recipes.length} treff
                            </p>
                        )}
                    </div>
                </>
            ) : null}

            {/* optional: link to own profile */}
            {user ? (
                <div
                    onClick={() => router.push(`/user/${user.uid}`)}
                    className="mb-4 flex cursor-pointer items-center justify-between"
                />
            ) : null}

            {activeFeed === 'popular' && popularIsError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Klarte ikke å hente populære oppskrifter:{' '}
                    {String(popularErr?.message ?? popularErr)}
                </div>
            )}

            {/* Content */}
            <div className="mb-40">
                {showFollowingCTA ? (
                    <div className="mt-3 rounded-2xl bg-white shadow-sm p-4">
                        <p className="text-slate-700">Du følger ingen enda.</p>
                        <button
                            onClick={() => router.push('/add-friends')}
                            className="mt-4 rounded-full px-5 py-2 bg-slate-900 text-white font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition"
                        >
                            Legg til kokker
                        </button>
                    </div>
                ) : showSkeletonGrid ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-10">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={`sk-${i}`} />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="mt-6">
                        <p className="text-slate-600">
                            Ingen tilgjengelige oppskrifter.
                        </p>
                    </div>
                ) : (
                    <div className="">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    creator={usersMap[recipe.userId]}
                                />
                            ))}
                        </div>

                        {/* Auto-pagination sentinel (popular) */}
                        {activeFeed === 'popular' && hasNextPopular && (
                            <div ref={loadMoreRef} className="h-10" />
                        )}

                        {/* Bottom-loading skeletons (popular) */}
                        {activeFeed === 'popular' && fetchingNextPopular && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <SkeletonCard key={`sk-next-${i}`} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!showPublicLanding ? (
                <div className="text-xl text-center flex flex-col items-center justify-center mt-20 mb-10 ">
                    Vet du fortsatt ikke hva du vil ha?
                    <button
                        type="button"
                        onClick={() => router.push('/?recommend=1')}
                        className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 brown-button transition"
                    >
                        <span className="material-symbols-outlined">
                            skillet
                        </span>
                        Spør kokken
                    </button>
                </div>
            ) : (
                <div></div>
            )}
        </div>
    );
};

export default Home;
