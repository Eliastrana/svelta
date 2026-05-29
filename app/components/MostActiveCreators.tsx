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
    const topN = opts?.topN ?? 2;
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

    // ✅ re-mount ringen når animateKey endrer seg (restart anim)
    return (
        <div key={animateKey} className="relative h-10 w-10 shrink-0 rounded-full" aria-hidden="true">
            <div className="absolute inset-[-3px] rounded-full storyRing storyRingIntro" />

            <div className="absolute inset-0 rounded-full bg-white p-[2px]">
                <div className="h-full w-full rounded-full overflow-hidden bg-slate-100">
                    {src ? (
                        <div className="relative h-full w-full">
                            <Image src={src} alt={name} fill sizes="40px" className="object-cover" />
                        </div>
                    ) : (
                        <div className="h-full w-full grid place-items-center text-slate-500">🧑‍🍳</div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .storyRing {
                    background: conic-gradient(
                            from 180deg,
                            rgba(120, 78, 52, 0.25),
                            rgba(176, 120, 84, 0.98),
                            rgba(120, 78, 52, 0.35),
                            rgba(210, 164, 122, 0.92),
                            rgba(120, 78, 52, 0.25)
                    );
                    box-shadow:
                            0 0 0 1px rgba(15, 23, 42, 0.10),
                            0 10px 24px rgba(120, 78, 52, 0.18);
                    opacity: 0.98;
                    transform: rotate(0deg);
                }

                /* ✅ intro anim (one spin + pop) */
                .storyRingIntro {
                    animation: ringSpinOnce 1100ms ease-out 1, ringPop 520ms ease-out 1;
                    will-change: transform, opacity;
                }

                @keyframes ringSpinOnce {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes ringPop {
                    0% {
                        filter: saturate(1) brightness(1);
                        transform: scale(0.92);
                        opacity: 0.15;
                    }
                    45% { transform: scale(1.06); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.98; }
                }
            `}</style>
        </div>
    );
}

export default function MostActiveCreators() {
    const { data: topCreators = [], isLoading } = useQuery<CreatorCount[], Error>({
        queryKey: ['topActiveCreators'],
        queryFn: () => fetchTopActiveCreators({ topN: 2, scanLimit: 250 }),
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

    // ✅ modal state
    const [storiesOpen, setStoriesOpen] = React.useState(false);
    const [initialCreatorUid, setInitialCreatorUid] = React.useState<string>('');

    // ✅ creators array som modal forventer
    const creators = React.useMemo(
        () =>
            creatorIds.map((uid) => ({
                uid,
                name: usersMap[uid]?.name,
                photoURL: usersMap[uid]?.photoURL,
            })),
        [creatorIds, usersMap],
    );

    /**
     * ✅ Run intro animation exactly once, but ONLY after we actually have creators rendered.
     * We do this by bumping a key (`ringAnimKey`) after creators are ready.
     */
    const [ringAnimKey, setRingAnimKey] = React.useState(0);
    const introPlayedRef = React.useRef(false);

    const creatorsReady = !isLoading && !usersLoading && creators.length > 0;

    React.useEffect(() => {
        if (!creatorsReady) return;
        if (introPlayedRef.current) return;

        introPlayedRef.current = true;

        // next paint -> bump key so ring mounts right when visible
        requestAnimationFrame(() => {
            setRingAnimKey((k) => k + 1);
        });
    }, [creatorsReady]);

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Aktive kokker</h3>
            </div>

            {isLoading ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                        <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                        <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
                    </div>
                </div>
            ) : creators.length === 0 ? null : (
                <div className="mt-3 grid grid-cols-2 gap-3">
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
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 transition text-left hover:cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    {/* ✅ ring anim triggers when creators are actually visible */}
                                    <StoryAvatar src={photoURL} name={name} animateKey={ringAnimKey} />

                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{name}</p>
                                        <p className="text-sm text-slate-600">{c.recipeCount} oppskrifter</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
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
        </div>
    );
}
