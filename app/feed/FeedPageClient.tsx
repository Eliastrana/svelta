'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { onAuthStateChanged } from 'firebase/auth';

import MostActiveCreators from '@/app/components/MostActiveCreators';
import NotificationsButton from '@/app/components/NotificationsButton';
import OnboardingIntro from '@/app/components/OnboardingIntro';
import RecipeCard from '@/app/components/RecipeCard';
import { auth } from '@/firebase';
import { Recipe } from '@/app/types/Recipe';
import { UserDoc } from '@/hooks/useUserData';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { ensureUserDocument } from '@/helpers/ensureUserDocument';
import { fetchFollowedRecipes } from '@/helpers/fetchFollowedRecipies';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { fetchPopularRecipesPage } from '@/helpers/fetchPopularRecipesPage';
import { DEFAULT_PROFILE_THEME_ID } from '@/helpers/profileAppearance';

type Feed = 'following' | 'popular';

type IngredientDetailed = { name: string; amount: string };

type SearchableRecipe = Recipe & {
    ingredients?: string[];
    ingredientsDetailed?: IngredientDetailed[];
};

const PAGE_SIZE = 8;
const LOGGED_IN_POPULAR_PREFETCH_MIN = PAGE_SIZE * 3;

const normalize = (s: string) =>
    s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

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

const FullPageLoader: React.FC<{ label?: string }> = ({ label = 'Gjør klart…' }) => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#fbfaf4] px-4">
            <div className="flex flex-col items-center gap-4 text-slate-600">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
                <p className="text-sm font-medium">{label}</p>
            </div>
        </div>
    );
};

export default function FeedPageClient() {
    const router = useRouter();
    const user = useAuthUser();

    const [authReady, setAuthReady] = React.useState(false);
    const [activeFeed, setActiveFeed] = React.useState<Feed>('popular');
    const [search, setSearch] = React.useState('');
    const [viewerProfile, setViewerProfile] = React.useState<UserDoc | null>(
        null
    );
    const [showOnboarding, setShowOnboarding] = React.useState(false);
    const [onboardingResolved, setOnboardingResolved] = React.useState(false);

    const following = useUserFollowing(user?.uid ?? '');
    const isLoggedIn = Boolean(user?.uid);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, () => {
            setAuthReady(true);
        });

        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!authReady || user) return;
        router.replace('/welcome');
    }, [authReady, router, user]);

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
            authReady &&
            isLoggedIn &&
            activeFeed === 'following' &&
            following.length > 0,
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
        enabled: authReady && isLoggedIn && activeFeed === 'popular',
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
    }, [activeFeed, fetchNextPopular, fetchingNextPopular, hasNextPopular]);

    React.useEffect(() => {
        if (activeFeed !== 'popular') return;
        if (loadingPopular || fetchingNextPopular) return;
        if (!hasNextPopular) return;
        if (popularRecipes.length >= LOGGED_IN_POPULAR_PREFETCH_MIN) return;

        void fetchNextPopular();
    }, [
        activeFeed,
        fetchNextPopular,
        fetchingNextPopular,
        hasNextPopular,
        loadingPopular,
        popularRecipes.length,
    ]);

    const baseRecipes: SearchableRecipe[] =
        activeFeed === 'following'
            ? (followedRecipes as SearchableRecipe[])
            : (popularRecipes as SearchableRecipe[]);

    const q = React.useMemo(() => normalize(search), [search]);

    const recipes: SearchableRecipe[] = React.useMemo(() => {
        if (!q) return baseRecipes;

        return baseRecipes.filter((recipe) => {
            const title = normalize(recipe.title ?? '');
            const desc = normalize(recipe.description ?? '');
            const legacyIngredients = Array.isArray(recipe.ingredients)
                ? recipe.ingredients.join(' ')
                : '';
            const detailedIngredients = Array.isArray(recipe.ingredientsDetailed)
                ? recipe.ingredientsDetailed
                      .map((ingredient) =>
                          `${ingredient.amount ?? ''} ${ingredient.name ?? ''}`.trim()
                      )
                      .join(' ')
                : '';
            const tags = Array.isArray(recipe.tags) ? recipe.tags.join(' ') : '';
            const haystack = `${title} ${desc} ${normalize(legacyIngredients)} ${normalize(detailedIngredients)} ${normalize(tags)}`;

            return haystack.includes(q);
        });
    }, [baseRecipes, q]);

    const showPopularSkeleton = activeFeed === 'popular' && loadingPopular;
    const showFollowingCTA = activeFeed === 'following' && followsNobody;
    const showFollowingSkeleton =
        activeFeed === 'following' && followsSomebody && loadingFollowed;
    const showSkeletonGrid = showPopularSkeleton || showFollowingSkeleton;

    const uniqueUserIds = React.useMemo(() => {
        const ids = new Set<string>();
        recipes.forEach((recipe) => ids.add(recipe.userId));
        return Array.from(ids);
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

    if (!authReady || (!user && !onboardingResolved)) {
        return <FullPageLoader />;
    }

    if (!user) {
        return <FullPageLoader label="Sender deg videre…" />;
    }

    if (shouldBlockHome) {
        return <FullPageLoader />;
    }

    if (shouldShowOnboarding && viewerProfile) {
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
        <div className="p-4 md:mx-auto md:mb-24 md:max-w-5xl lg:w-2/3">
            <div className="mb-4">
                <NotificationsButton />
            </div>

            <div className="mb-3">
                {activeFeed === 'popular' ||
                (activeFeed === 'following' && following.length > 0) ? (
                    <MostActiveCreators
                        mode={
                            activeFeed === 'following' ? 'following' : 'popular'
                        }
                        followingIds={
                            activeFeed === 'following' ? following : []
                        }
                        viewerUid={user.uid}
                        storyWindowHours={24 * 30}
                    />
                ) : null}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        search
                    </span>

                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Søk etter oppskrifter, ingredienser, beskrivelser..."
                        className="w-full rounded-full border border-slate-200 bg-white py-2 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
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
                        className="absolute left-0 top-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                        style={{
                            transform:
                                activeFeed === 'popular'
                                    ? 'translateX(100%)'
                                    : undefined,
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => setActiveFeed('following')}
                        className={`relative flex w-1/2 items-center justify-center py-1 text-sm font-medium focus:outline-none ${
                            activeFeed === 'following'
                                ? 'text-slate-900'
                                : 'text-slate-500'
                        }`}
                    >
                        Følger
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveFeed('popular')}
                        className={`relative flex w-1/2 items-center justify-center py-1 text-sm font-medium focus:outline-none ${
                            activeFeed === 'popular'
                                ? 'text-slate-900'
                                : 'text-slate-500'
                        }`}
                    >
                        Populære
                    </button>
                </div>
            </div>

            <div className="sticky top-0 z-30 py-2">
                {q && !showSkeletonGrid ? (
                    <p className="mt-2 text-sm text-slate-600">
                        Viser {recipes.length} treff
                    </p>
                ) : null}
            </div>

            {activeFeed === 'popular' && popularIsError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Klarte ikke å hente populære oppskrifter:{' '}
                    {String(popularErr?.message ?? popularErr)}
                </div>
            ) : null}

            <div className="mb-40">
                {showFollowingCTA ? (
                    <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-slate-700">Du følger ingen enda.</p>
                        <button
                            type="button"
                            onClick={() => router.push('/add-friends')}
                            className="mt-4 rounded-full bg-slate-900 px-5 py-2 font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
                        >
                            Legg til kokker
                        </button>
                    </div>
                ) : showSkeletonGrid ? (
                    <div className="mt-3 grid grid-cols-1 gap-10 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <SkeletonCard key={`sk-${index}`} />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="mt-6">
                        <p className="text-slate-600">
                            Ingen tilgjengelige oppskrifter.
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {recipes.map((recipe) => (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    creator={usersMap[recipe.userId]}
                                />
                            ))}
                        </div>

                        {activeFeed === 'popular' && hasNextPopular ? (
                            <div ref={loadMoreRef} className="h-10" />
                        ) : null}

                        {activeFeed === 'popular' && fetchingNextPopular ? (
                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                {Array.from({ length: 2 }).map((_, index) => (
                                    <SkeletonCard key={`sk-next-${index}`} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <motion.div className="mb-10 mt-20 flex flex-col items-center justify-center text-center text-xl">
                Vet du fortsatt ikke hva du vil ha?
                <button
                    type="button"
                    onClick={() => router.push('/feed?recommend=1')}
                    className="brown-button mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 transition"
                >
                    <span className="material-symbols-outlined">skillet</span>
                    Spør kokken
                </button>
            </motion.div>
        </div>
    );
}
