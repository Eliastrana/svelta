'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import Image from 'next/image';

import { firestore } from '@/firebase';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { UserDoc } from '@/hooks/useUserData';
import CreatorStoriesModal from '@/app/components/CreatorStoriesModal';
import { normalizeRecipeVisibility } from '@/helpers/recipeVisibility';

type CreatorCount = { uid: string; recipeCount: number };
type RecipeMinimal = { userId: string; createdAt?: unknown; visibility?: string };

async function fetchTopActiveCreators(opts?: { topN?: number; scanLimit?: number }): Promise<CreatorCount[]> {
    const topN = opts?.topN ?? 8;
    const scanLimit = opts?.scanLimit ?? 200;

    try {
        const feedSnap = await getDoc(doc(firestore, 'publicFeedMeta', 'topActiveCreators'));
        if (feedSnap.exists()) {
            const data = feedSnap.data() as { creators?: CreatorCount[] };
            if (Array.isArray(data.creators) && data.creators.length > 0) {
                return data.creators.slice(0, topN);
            }
        }
    } catch {
        // Fall back to deriving it live until the precomputed doc exists.
    }

    const recipesRef = collection(firestore, 'recipes');
    const q = query(recipesRef, orderBy('createdAt', 'desc'), limit(scanLimit));
    const snap = await getDocs(q);

    const counts = new Map<string, number>();

    snap.forEach((d) => {
        const data = d.data() as RecipeMinimal;

        if (normalizeRecipeVisibility(data.visibility) !== 'public') return;

        const uid = (data.userId || '').trim();
        if (!uid) return;

        counts.set(uid, (counts.get(uid) ?? 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([uid, recipeCount]) => ({ uid, recipeCount }))
        .sort((a, b) => b.recipeCount - a.recipeCount)
        .slice(0, topN);
}

function StoryAvatar(props: { src?: string; name: string; animateKey?: number }) {
    const { src, name, animateKey } = props;

    return (
        <div
            key={animateKey}
            className="relative h-20 w-20 shrink-0 rounded-full md:h-20 md:w-20"
            aria-hidden="true"
        >
            <div className="absolute inset-[-4px] rounded-full storyRing storyRingIntro" />

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

            <style jsx>{`
                .storyRing {
                    background: conic-gradient(
                            from 180deg,
                            rgba(155, 212, 92, 0.35),
                            rgba(185, 231, 122, 0.98),
                            rgba(155, 212, 92, 0.55),
                            rgba(185, 231, 122, 0.92),
                            rgba(155, 212, 92, 0.35)
                    );
                    box-shadow: none;
                    opacity: 0.98;
                    transform: rotate(0deg);
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

export default function MostActiveCreators() {
    const { data: topCreators = [], isLoading } = useQuery<CreatorCount[], Error>({
        queryKey: ['topActiveCreators'],
        queryFn: () => fetchTopActiveCreators({ topN: 8, scanLimit: 250 }),
        placeholderData: (prev) => prev ?? [],
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const creatorIds = React.useMemo(() => topCreators.map((c) => c.uid), [topCreators]);

    const { data: usersMap = {}, isLoading: usersLoading } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['topCreatorsUsersMap', creatorIds],
        queryFn: () => fetchManyUsers(creatorIds),
        enabled: creatorIds.length > 0,
        placeholderData: (prev) => prev ?? {},
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const [storiesOpen, setStoriesOpen] = React.useState(false);
    const [initialCreatorUid, setInitialCreatorUid] = React.useState<string>('');

    const creators = React.useMemo(
        () =>
            creatorIds.map((uid) => ({
                uid,
                name: usersMap[uid]?.name,
                photoURL: usersMap[uid]?.photoURL,
            })),
        [creatorIds, usersMap],
    );

    const [ringAnimKey, setRingAnimKey] = React.useState(0);
    const introPlayedRef = React.useRef(false);

    const creatorsReady = !isLoading && !usersLoading && creators.length > 0;

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
            {isLoading ? (
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
                        {topCreators.map((c) => {
                            const u = usersMap[c.uid];
                            const name = u?.name ?? 'Ukjent';
                            const photoURL = u?.photoURL ?? '';

                            return (
                                <button
                                    key={c.uid}
                                    type="button"
                                    onClick={() => {
                                        setInitialCreatorUid(c.uid);
                                        setStoriesOpen(true);
                                    }}
                                    className="shrink-0 bg-transparent p-0 transition-transform duration-200 hover:scale-[1.06] hover:cursor-pointer active:scale-[0.98]"
                                    aria-label={`Åpne stories fra ${name}`}
                                >
                                    <StoryAvatar src={photoURL} name={name} animateKey={ringAnimKey} />
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
                autoAdvanceMs={10000}
                maxRecipesPerCreator={25}
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