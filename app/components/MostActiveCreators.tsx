'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import Image from 'next/image';

import { firestore } from '@/firebase';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { UserDoc } from '@/hooks/useUserData';
import CreatorStoriesModal from '@/app/components/CreatorStoriesModal';
import { normalizeRecipeVisibility } from '@/helpers/recipeVisibility';

type StoryCreator = { uid: string; recipeCount: number; latestCreatedAtMs: number };
type FeedMode = 'popular' | 'following';
type RecipeMinimal = { userId: string; createdAt?: unknown; visibility?: string };

type MostActiveCreatorsProps = {
    mode?: FeedMode;
    followingIds?: string[];
    viewerUid?: string;
    storyWindowHours?: number;
};

const SEEN_STORIES_STORAGE_KEY = 'seenStoryCreators';

function toMillis(value: unknown): number {
    if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }
    return 0;
}

async function fetchStoryCreators(opts?: {
    mode?: FeedMode;
    followingIds?: string[];
    viewerUid?: string;
    scanLimit?: number;
    storyWindowHours?: number;
}): Promise<StoryCreator[]> {
    const mode = opts?.mode ?? 'popular';
    const scanLimit = opts?.scanLimit ?? 400;
    const storyWindowHours = opts?.storyWindowHours ?? 24 * 30;
    const cutoffMs = Date.now() - storyWindowHours * 60 * 60 * 1000;

    const storyCreators = new Map<string, StoryCreator>();

    const accumulate = (recipes: RecipeMinimal[], includePrivate: boolean) => {
        recipes.forEach((recipe) => {
            const createdAtMs = toMillis(recipe.createdAt);
            if (createdAtMs < cutoffMs) return;
            if (!includePrivate && normalizeRecipeVisibility(recipe.visibility) !== 'public') return;

            const uid = (recipe.userId || '').trim();
            if (!uid) return;

            const existing = storyCreators.get(uid);
            if (existing) {
                storyCreators.set(uid, {
                    uid,
                    recipeCount: existing.recipeCount + 1,
                    latestCreatedAtMs: Math.max(existing.latestCreatedAtMs, createdAtMs),
                });
                return;
            }

            storyCreators.set(uid, {
                uid,
                recipeCount: 1,
                latestCreatedAtMs: createdAtMs,
            });
        });
    };

    if (mode === 'following') {
        const followingIds = Array.from(
            new Set(
                [...(opts?.followingIds ?? []), opts?.viewerUid].filter(
                    (value): value is string => typeof value === 'string' && value.trim().length > 0,
                ),
            ),
        );
        if (followingIds.length === 0) return [];

        const chunks: string[][] = [];
        for (let i = 0; i < followingIds.length; i += 10) {
            chunks.push(followingIds.slice(i, i + 10));
        }

        const snapshots = await Promise.all(
            chunks.map((chunk) =>
                getDocs(
                    query(
                        collection(firestore, 'recipes'),
                        where('userId', 'in', chunk),
                        orderBy('createdAt', 'desc'),
                        limit(Math.max(10, Math.ceil(scanLimit / Math.max(1, chunks.length)))),
                    ),
                ),
            ),
        );

        snapshots.forEach((snap) => {
            accumulate(snap.docs.map((d) => d.data() as RecipeMinimal), true);
        });
    } else {
        const recipesRef = collection(firestore, 'recipes');
        const q = query(recipesRef, orderBy('createdAt', 'desc'), limit(scanLimit));
        const snap = await getDocs(q);
        accumulate(snap.docs.map((d) => d.data() as RecipeMinimal), false);
    }

    return Array.from(storyCreators.values())
        .sort((a, b) => b.latestCreatedAtMs - a.latestCreatedAtMs);
}

function StoryAvatar(props: { src?: string; name: string; animateKey?: number; isSeen?: boolean; isOwn?: boolean }) {
    const { src, name, animateKey, isSeen = false, isOwn = false } = props;

    return (
        <div
            key={animateKey}
            className="relative h-20 w-20 shrink-0 rounded-full md:h-20 md:w-20"
            aria-hidden="true"
        >
            <div
                className={`absolute inset-[-4px] rounded-full storyRing ${
                    isSeen ? 'storyRingSeen' : 'storyRingFresh'
                } storyRingIntro`}
            />

            <div className="absolute inset-0 rounded-full bg-[#fbfaf4] p-[3px]">
                <div className="h-full w-full overflow-hidden rounded-full bg-slate-100">
                    {src ? (
                        <div className="relative h-full w-full">
                            <Image src={src} alt={name} fill sizes="96px" className="object-cover" />
                        </div>
                    ) : (
                        <div className="grid h-full w-full place-items-center text-3xl text-slate-500">
                            🧑‍🍳
                        </div>
                    )}
                </div>
            </div>

            {isOwn ? (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#fbfaf4] px-2 py-[2px] text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-black/5">
                    Deg
                </div>
            ) : null}

            <style jsx>{`
                .storyRing {
                    box-shadow: none;
                    opacity: 0.98;
                    transform: rotate(0deg);
                }

                .storyRingFresh {
                    background: conic-gradient(
                            from 180deg,
                            rgba(155, 212, 92, 0.35),
                            rgba(185, 231, 122, 0.98),
                            rgba(155, 212, 92, 0.55),
                            rgba(185, 231, 122, 0.92),
                            rgba(155, 212, 92, 0.35)
                    );
                }

                .storyRingSeen {
                    background: conic-gradient(
                            from 180deg,
                            rgba(180, 185, 192, 0.45),
                            rgba(203, 208, 215, 0.96),
                            rgba(170, 176, 184, 0.58),
                            rgba(205, 210, 217, 0.94),
                            rgba(180, 185, 192, 0.45)
                    );
                }

                .storyRingIntro {
                    animation:
                            ringSpinOnce 1100ms ease-out 1,
                            ringPop 520ms ease-out 1;
                    will-change: transform, opacity;
                }

                @keyframes ringSpinOnce {
                    from {
                        transform: rotate(0deg);
                    }

                    to {
                        transform: rotate(360deg);
                    }
                }

                @keyframes ringPop {
                    0% {
                        filter: saturate(1) brightness(1);
                        transform: scale(0.92);
                        opacity: 0.15;
                    }

                    45% {
                        transform: scale(1.06);
                        opacity: 1;
                    }

                    100% {
                        transform: scale(1);
                        opacity: 0.98;
                    }
                }
            `}</style>
        </div>
    );
}

export default function MostActiveCreators({
    mode = 'popular',
    followingIds = [],
    viewerUid,
    storyWindowHours = 24 * 30,
}: MostActiveCreatorsProps) {
    const uniqueFollowingIds = React.useMemo(() => Array.from(new Set(followingIds.filter(Boolean))), [followingIds]);
    const [seenCreators, setSeenCreators] = React.useState<Record<string, number>>({});

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(SEEN_STORIES_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Record<string, number>;
            if (parsed && typeof parsed === 'object') {
                setSeenCreators(parsed);
            }
        } catch {
            window.localStorage.removeItem(SEEN_STORIES_STORAGE_KEY);
        }
    }, []);

    const { data: topCreators = [], isLoading } = useQuery<StoryCreator[], Error>({
        queryKey: ['storyCreators', mode, storyWindowHours, uniqueFollowingIds],
        queryFn: () =>
            fetchStoryCreators({
                mode,
                followingIds: uniqueFollowingIds,
                viewerUid,
                scanLimit: 400,
                storyWindowHours,
            }),
        enabled: mode === 'popular' || uniqueFollowingIds.length > 0,
        placeholderData: (prev) => prev ?? [],
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const topCreatorsWithOwnFirst = React.useMemo(() => {
        if (!viewerUid) return topCreators;
        const ownCreator = topCreators.find((creator) => creator.uid === viewerUid);
        if (!ownCreator) return topCreators;
        return [ownCreator, ...topCreators.filter((creator) => creator.uid !== viewerUid)];
    }, [topCreators, viewerUid]);

    const orderedCreatorIds = React.useMemo(() => topCreatorsWithOwnFirst.map((creator) => creator.uid), [topCreatorsWithOwnFirst]);

    const { data: usersMap = {}, isLoading: usersLoading } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['topCreatorsUsersMap', orderedCreatorIds],
        queryFn: () => fetchManyUsers(orderedCreatorIds),
        enabled: orderedCreatorIds.length > 0,
        placeholderData: (prev) => prev ?? {},
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const [storiesOpen, setStoriesOpen] = React.useState(false);
    const [initialCreatorUid, setInitialCreatorUid] = React.useState<string>('');

    const creators = React.useMemo(
        () =>
            topCreatorsWithOwnFirst.map((creator) => ({
                uid: creator.uid,
                name: usersMap[creator.uid]?.name,
                photoURL: usersMap[creator.uid]?.photoURL,
            })),
        [topCreatorsWithOwnFirst, usersMap],
    );

    const latestCreatedAtByUid = React.useMemo(
        () =>
            Object.fromEntries(topCreatorsWithOwnFirst.map((creator) => [creator.uid, creator.latestCreatedAtMs])),
        [topCreatorsWithOwnFirst],
    );

    const markCreatorSeen = React.useCallback(
        (uid: string) => {
            const latestCreatedAtMs = latestCreatedAtByUid[uid];
            if (!latestCreatedAtMs) return;

            setSeenCreators((prev) => {
                if ((prev[uid] ?? 0) >= latestCreatedAtMs) return prev;
                const next = { ...prev, [uid]: latestCreatedAtMs };
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(SEEN_STORIES_STORAGE_KEY, JSON.stringify(next));
                }
                return next;
            });
        },
        [latestCreatedAtByUid],
    );

    const [ringAnimKey, setRingAnimKey] = React.useState(0);
    const introPlayedRef = React.useRef(false);

    const showLoading = isLoading || usersLoading;
    const creatorsReady = !showLoading && creators.length > 0;

    React.useEffect(() => {
        if (!creatorsReady) return;
        if (introPlayedRef.current) return;

        introPlayedRef.current = true;

        requestAnimationFrame(() => {
            setRingAnimKey((k) => k + 1);
        });
    }, [creatorsReady]);

    return (
        <div className="mt-4 overflow-visible">
            {showLoading ? (
                <div className="overflow-visible">
                    <div className="stories-row flex gap-4 overflow-x-auto overflow-y-visible px-2 pt-5">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={`story-skeleton-${index}`}
                                className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-slate-100 md:h-24 md:w-24"
                            />
                        ))}
                    </div>
                </div>
            ) : creators.length === 0 ? null : (
                <div className="overflow-visible">
                    <div className="stories-row flex gap-4 overflow-x-auto overflow-y-visible px-2 pt-5 pb-3">
                        {orderedCreatorIds.map((uid) => {
                            const u = usersMap[uid];
                            const name = u?.name ?? 'Ukjent';
                            const photoURL = u?.photoURL ?? '';
                            const latestCreatedAtMs = latestCreatedAtByUid[uid] ?? 0;
                            const isSeen = (seenCreators[uid] ?? 0) >= latestCreatedAtMs;
                            const isOwn = Boolean(viewerUid && uid === viewerUid);

                            return (
                                <button
                                    key={uid}
                                    type="button"
                                    onClick={() => {
                                        markCreatorSeen(uid);
                                        setInitialCreatorUid(uid);
                                        setStoriesOpen(true);
                                    }}
                                    className="shrink-0 bg-transparent p-0 transition-transform duration-200 hover:scale-[1.06] hover:cursor-pointer active:scale-[0.98]"
                                    aria-label={`Åpne stories fra ${name}`}
                                >
                                    <StoryAvatar
                                        src={photoURL}
                                        name={name}
                                        animateKey={ringAnimKey}
                                        isSeen={isSeen}
                                        isOwn={isOwn}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <CreatorStoriesModal
                open={storiesOpen}
                creators={creators}
                initialCreatorUid={initialCreatorUid}
                onClose={() => setStoriesOpen(false)}
                onCreatorViewed={markCreatorSeen}
                autoAdvanceMs={10000}
                maxRecipesPerCreator={25}
                storyWindowHours={storyWindowHours}
                viewerUid={viewerUid}
                followingIds={uniqueFollowingIds}
            />

            <style jsx>{`
                .stories-row {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }

                .stories-row::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}
