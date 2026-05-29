'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import RecipeCard from '@/app/components/RecipeCard';
import MostActiveCreators from '@/app/components/MostActiveCreators';
import OnboardingIntro from '@/app/components/OnboardingIntro';

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

const normalize = (s: string) =>
    s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const PAGE_SIZE = 8;

const Home: React.FC = () => {
    const router = useRouter();
    const user = useAuthUser();

    const [activeFeed, setActiveFeed] = React.useState<Feed>('popular');
    const [search, setSearch] = React.useState('');
    const [viewerProfile, setViewerProfile] = React.useState<UserDoc | null>(null);
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

    const { data: followedRecipes = [], isLoading: loadingFollowed } = useQuery<Recipe[], Error>({
        queryKey: ['followedRecipes', following],
        queryFn: () => fetchFollowedRecipes(following),
        enabled: isLoggedIn && activeFeed === 'following' && following.length > 0,
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
        [popularData],
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
            { rootMargin: '600px' },
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

            const ingLegacy = Array.isArray(r.ingredients) ? r.ingredients.join(' ') : '';

            const ingDetailed = Array.isArray(r.ingredientsDetailed)
                ? r.ingredientsDetailed.map((i) => `${i.amount ?? ''} ${i.name ?? ''}`).join(' ')
                : '';

            const tags = Array.isArray(r.tags) ? r.tags.join(' ') : '';
            const hay = `${title} ${desc} ${normalize(ingLegacy)} ${normalize(ingDetailed)} ${normalize(tags)}`;
            return hay.includes(q);
        });
    }, [baseRecipes, q]);

    const showPopularSkeleton = activeFeed === 'popular' && loadingPopular;
    const showFollowingCTA = activeFeed === 'following' && followsNobody;
    const showFollowingSkeleton = activeFeed === 'following' && followsSomebody && loadingFollowed;
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
    const shouldShowOnboarding = Boolean(user && showOnboarding && viewerProfile);
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
                initialBackgroundPhotoURL={viewerProfile.backgroundPhotoURL || ''}
                initialProfileThemeId={viewerProfile.profileThemeId || DEFAULT_PROFILE_THEME_ID}
                initialProfileFontId={viewerProfile.profileFontId || 'urbanist'}
                initialIsProfilePrivate={Boolean(viewerProfile.isProfilePrivate)}
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
            {showPublicLanding ? (
                <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Svelta
                        </p>
                        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                            Oppskrifter, kokebøker og matglede samlet på ett sted
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                            Svelta er en sosial oppskriftsapp der du kan dele egne retter, oppdage nye favoritter,
                            følge andre kokker og lagre oppskrifter i egne kokebøker.
                        </p>

                        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => router.push('/login')}
                                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:opacity-95 active:scale-[0.99]"
                            >
                                Logg inn med Google
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setActiveFeed('popular');
                                    window.scrollTo({ top: 640, behavior: 'smooth' });
                                }}
                                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.99]"
                            >
                                Se populære oppskrifter
                            </button>
                        </div>
                    </div>
                </section>
            ) : (
                <div className="md:flex items-center justify-between ">
                    <h2 className="md:text-3xl text-2xl font-semibold text-slate-900">Oppskrifter</h2>

                    <div className="relative inline-flex w-full max-w-sm rounded-full border border-slate-200 bg-slate-50 p-1 mt-6">
                        <div
                            className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                            style={{ transform: activeFeed === 'popular' ? 'translateX(100%)' : undefined }}
                        />

                        <button
                            onClick={() => setActiveFeed('following')}
                            className={`relative w-1/2 py-1 text-sm font-medium focus:outline-none flex items-center justify-center ${
                                activeFeed === 'following' ? 'text-slate-900' : 'text-slate-500'
                            }`}
                            type="button"
                        >
                            Følger
                        </button>

                        <button
                            onClick={() => setActiveFeed('popular')}
                            className={`relative w-1/2 py-1 text-sm font-medium focus:outline-none flex items-center justify-center ${
                                activeFeed === 'popular' ? 'text-slate-900' : 'text-slate-500'
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
                    <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">Populære oppskrifter på Svelta</h2>
                    <p className="mt-2 text-sm text-slate-600 md:text-base">
                        Utforsk offentlige oppskrifter fra Svelta før du logger inn.
                    </p>
                </div>
            ) : null}

            {activeFeed === 'popular' && <MostActiveCreators />}

            {/* ✅ Search field */}
            <div className="mt-4 sticky top-0 z-30 py-2">
                <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            search
          </span>

                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Søk etter oppskrifter, ingredienser, beskrivelser..."
                        className="w-full pl-12 pr-12 py-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />

                    {search.trim().length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full hover:bg-slate-100 grid place-items-center"
                            aria-label="Tøm søk"
                        >
                            <span className="material-symbols-outlined text-slate-600">close</span>
                        </button>
                    )}
                </div>

                {q && !showSkeletonGrid && (
                    <p className="mt-2 text-sm text-slate-600">Viser {recipes.length} treff</p>
                )}
            </div>

            {/* optional: link to own profile */}
            {user ? (
                <div
                    onClick={() => router.push(`/user/${user.uid}`)}
                    className="mb-4 flex cursor-pointer items-center justify-between"
                />
            ) : null}

            {activeFeed === 'popular' && popularIsError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Klarte ikke å hente populære oppskrifter: {String(popularErr?.message ?? popularErr)}
                </div>
            )}

            {/* Content */}
            <div className="mb-40">
                {showFollowingCTA ? (
                    <div className="mt-6 rounded-2xl bg-white shadow-sm p-4">
                        <p className="text-slate-700">Du følger ingen enda.</p>
                        <button
                            onClick={() => router.push('/add-friends')}
                            className="mt-4 rounded-full px-5 py-2 bg-slate-900 text-white font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition"
                        >
                            Legg til kokker
                        </button>
                    </div>
                ) : showSkeletonGrid ? (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-10">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={`sk-${i}`} />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="mt-6">
                        <p className="text-slate-600">Ingen tilgjengelige oppskrifter.</p>
                    </div>
                ) : (
                    <div className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recipes.map((recipe) => (
                                <RecipeCard key={recipe.id} recipe={recipe} creator={usersMap[recipe.userId]} />
                            ))}
                        </div>

                        {/* Auto-pagination sentinel (popular) */}
                        {activeFeed === 'popular' && hasNextPopular && <div ref={loadMoreRef} className="h-10" />}

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

            <div className="text-xl text-center flex flex-col items-center justify-center mt-20 mb-10 ">
                Vet du fortsatt ikke hva du vil ha?
                <button
                    type="button"
                    onClick={() => router.push('/?recommend=1')}
                    className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 brown-button transition"
                >
                    <span className="material-symbols-outlined">skillet</span>
                    Spør kokken
                </button>
            </div>
        </div>
    );
};

export default Home;
