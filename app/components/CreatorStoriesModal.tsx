'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase';
import AppModal from '@/app/components/AppModal';
import Image from 'next/image';
import { canViewRecipe } from '@/helpers/recipeVisibility';

type CreatorLite = {
    uid: string;
    name?: string;
    photoURL?: string;
};

type StoryRecipe = {
    id: string;
    userId: string;
    title: string;
    description?: string;
    coverImage?: string;
    createdAt?: unknown;
    visibility?: string;
};

type Props = {
    open: boolean;
    creators: CreatorLite[]; // rekkefølge = story-rekkefølge
    initialCreatorUid: string; // hvem du klikket på
    onClose: () => void;
    onCreatorViewed?: (uid: string) => void;

    autoAdvanceMs?: number; // default 10s
    maxRecipesPerCreator?: number; // default 25
    storyWindowHours?: number;
    viewerUid?: string;
    followingIds?: string[];
};

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

async function fetchCreatorRecipes(
    uid: string,
    maxRecipes: number,
    opts: { storyWindowHours: number; viewerUid?: string; followingIds?: string[] },
): Promise<StoryRecipe[]> {
    const q = query(
        collection(firestore, 'recipes'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(maxRecipes),
    );

    const snap = await getDocs(q);
    const cutoffMs = Date.now() - opts.storyWindowHours * 60 * 60 * 1000;

    return snap.docs
        .map((d) => {
            const data = d.data() as {
                userId?: string;
                title?: string;
                description?: string;
                coverImage?: string;
                createdAt?: unknown;
                visibility?: string;
            };

            return {
                id: d.id,
                userId: (data.userId ?? uid) as string,
                title: (data.title ?? 'Oppskrift') as string,
                description: data.description,
                coverImage: data.coverImage,
                createdAt: data.createdAt,
                visibility: data.visibility,
            };
        })
        .filter((recipe) => toMillis(recipe.createdAt) >= cutoffMs)
        .filter((recipe) => canViewRecipe(recipe, opts.viewerUid, opts.followingIds ?? []));
}

/* ---------- fast placeholder (shimmer blur) ---------- */
const toBase64 = (str: string) =>
    typeof window === 'undefined' ? Buffer.from(str).toString('base64') : window.btoa(str);

const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#0b1220" offset="20%"/>
      <stop stop-color="#141c2e" offset="50%"/>
      <stop stop-color="#0b1220" offset="70%"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#0b1220"/>
  <rect id="r" width="${w}" height="${h}" fill="url(#g)"/>
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1.2s" repeatCount="indefinite"  />
</svg>`;

const blurDataURL = `data:image/svg+xml;base64,${toBase64(shimmer(900, 1200))}`;

function preloadImages(urls: Array<string | undefined | null>) {
    if (typeof window === 'undefined') return;

    urls
        .filter(Boolean)
        .forEach((url) => {
            const img = new window.Image();
            img.decoding = 'async';
            img.loading = 'eager';
            img.src = url as string;
        });
}

const CreatorStoriesModal: React.FC<Props> = ({
                                                  open,
                                                  creators,
                                                  initialCreatorUid,
                                              onClose,
                                              onCreatorViewed,
                                              autoAdvanceMs = 10_000,
                                              maxRecipesPerCreator = 25,
                                              storyWindowHours = 24 * 30,
                                              viewerUid,
                                              followingIds = [],
                                          }) => {
    const router = useRouter();
    const closeWithAnimRef = useRef<() => void>(() => {});
    const timerRef = useRef<number | null>(null);

    const initialCreatorIndex = useMemo(() => {
        const idx = creators.findIndex((c) => c.uid === initialCreatorUid);
        return idx >= 0 ? idx : 0;
    }, [creators, initialCreatorUid]);

    const [creatorIndex, setCreatorIndex] = useState<number>(initialCreatorIndex);
    const [recipeIndex, setRecipeIndex] = useState<number>(0);

    // cache: uid -> recipes
    const [recipesByUid, setRecipesByUid] = useState<Record<string, StoryRecipe[]>>({});
    const [loadingUid, setLoadingUid] = useState<string>('');

    const creator = creators[creatorIndex];
    const currentUid = creator?.uid ?? '';
    const recipes = useMemo(() => recipesByUid[currentUid] ?? [], [currentUid, recipesByUid]);
    const currentRecipe = recipes[recipeIndex];

    const closeWithAnim = () => closeWithAnimRef.current();

    // If you later add coverImageStory:
    // const imgSrc = currentRecipe?.coverImageStory ?? currentRecipe?.coverImage;
    const imgSrc = currentRecipe?.coverImage;

    // ✅ never show black: fade in when image is actually ready
    const [imgLoaded, setImgLoaded] = useState(false);
    useEffect(() => {
        setImgLoaded(false);
    }, [imgSrc, currentUid, recipeIndex, creatorIndex]);

    // reset when opening
    useEffect(() => {
        if (!open) return;
        setCreatorIndex(initialCreatorIndex);
        setRecipeIndex(0);
    }, [open, initialCreatorIndex]);

    const resetTimer = () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;

        if (!open) return;
        if (autoAdvanceMs <= 0) return;

        timerRef.current = window.setTimeout(() => {
            next();
        }, autoAdvanceMs);
    };

    const next = () => {
        resetTimer();

        const list = recipesByUid[currentUid] ?? [];
        const atLastRecipe = recipeIndex >= list.length - 1;

        if (!atLastRecipe) {
            setRecipeIndex((i) => i + 1);
            return;
        }

        const nextIdx = creatorIndex + 1;
        if (nextIdx >= creators.length) {
            closeWithAnim();
            return;
        }

        const nextUid = creators[nextIdx]?.uid;
        if (nextUid) {
            onCreatorViewed?.(nextUid);
        }
        setCreatorIndex(nextIdx);
        setRecipeIndex(0);
    };

    const prev = () => {
        resetTimer();

        if (recipeIndex > 0) {
            setRecipeIndex((i) => i - 1);
            return;
        }

        const prevIdx = creatorIndex - 1;
        if (prevIdx < 0) return;

        const prevUid = creators[prevIdx]?.uid ?? '';
        const prevList = recipesByUid[prevUid] ?? [];
        if (prevUid) {
            onCreatorViewed?.(prevUid);
        }
        setCreatorIndex(prevIdx);
        setRecipeIndex(Math.max(prevList.length - 1, 0));
    };

    // keyboard
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeWithAnim();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, creatorIndex, recipeIndex, currentUid]);

    // fetch current + prefetch next creator
    useEffect(() => {
        if (!open) return;
        if (!currentUid) return;

        let cancelled = false;

        const ensure = async (uid: string) => {
            if (recipesByUid[uid]) return;

            setLoadingUid(uid);
            try {
                const list = await fetchCreatorRecipes(uid, maxRecipesPerCreator, {
                    storyWindowHours,
                    viewerUid,
                    followingIds,
                });
                if (cancelled) return;
                setRecipesByUid((prev) => ({ ...prev, [uid]: list }));
            } finally {
                if (!cancelled) setLoadingUid('');
            }
        };

        void ensure(currentUid);

        const nextCreator = creators[creatorIndex + 1];
        if (nextCreator?.uid) void ensure(nextCreator.uid);

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, currentUid, creatorIndex, creators, maxRecipesPerCreator, storyWindowHours, viewerUid, followingIds]);

    // ✅ Prefetch images (raw URLs) so browser cache is warm
    useEffect(() => {
        if (!open) return;

        const nextRecipe = recipes[recipeIndex + 1];
        const prevRecipe = recipes[recipeIndex - 1];

        const nextCreatorUid = creators[creatorIndex + 1]?.uid;
        const nextCreatorFirst = nextCreatorUid ? recipesByUid[nextCreatorUid]?.[0] : undefined;

        preloadImages([
            imgSrc,
            nextRecipe?.coverImage,
            prevRecipe?.coverImage,
            nextCreatorFirst?.coverImage,
        ]);
    }, [open, creatorIndex, creators, recipesByUid, recipes, recipeIndex, imgSrc]);

    // auto advance
    useEffect(() => {
        if (!open) return;
        resetTimer();
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, creatorIndex, recipeIndex, autoAdvanceMs]);

    // if creator has 0 recipes after load → jump/close
    useEffect(() => {
        if (!open) return;
        if (!currentUid) return;
        if (loadingUid === currentUid) return;

        const list = recipesByUid[currentUid];
        if (!list) return; // not loaded yet
        if (list.length > 0) return;

        const nextIdx = creatorIndex + 1;
        if (nextIdx >= creators.length) closeWithAnim();
        else {
            setCreatorIndex(nextIdx);
            setRecipeIndex(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, creatorIndex, currentUid, recipesByUid, loadingUid]);

    if (!open) return null;

    const name = creator?.name ?? 'Ukjent';
    const photoURL = creator?.photoURL ?? '';
    const totalSegments = Math.max(recipes.length, 1);
    const openHref = currentRecipe ? `/recipe/${currentRecipe.id}` : '#';
    const profileHref = creator ? `/user/${creator.uid}` : '#';

    return (
        <AppModal
            onClose={onClose}
            overlayClassName="z-[999] bg-black/60"
            useDefaultPanelStyle={false}
            panelClassName="fixed inset-0 md:inset-6 md:mx-auto md:max-w-3xl bg-black rounded-none md:rounded-[28px] overflow-hidden shadow-2xl border border-white/10"
        >
            {({ closeWithAnim: modalCloseWithAnim }) => {
                closeWithAnimRef.current = modalCloseWithAnim;

                return (
                    <>
                        {/* tap zones */}
                        <button type="button" aria-label="Forrige" onClick={prev} className="absolute inset-y-0 left-0 w-1/3 z-20" />
                        <button type="button" aria-label="Neste" onClick={next} className="absolute inset-y-0 right-0 w-2/3 z-20" />

                        {/* Top UI */}
                        <div className="absolute top-0 left-0 right-0 z-30 p-3">
                            {/* progress */}
                            <div className="flex gap-1">
                                {Array.from({ length: totalSegments }).map((_, i) => {
                                    const done = i < recipeIndex;
                                    const active = i === recipeIndex;

                                    return (
                                        <div key={`seg-${i}`} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                                            <div
                                                className={['h-full rounded-full', done ? 'w-full bg-white/80' : active ? 'bg-white/80' : 'w-0'].join(' ')}
                                                style={active && autoAdvanceMs > 0 ? { animation: `storyfill ${autoAdvanceMs}ms linear forwards` } : undefined}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeWithAnim();
                                            router.push(profileHref);
                                        }}
                                        className="relative z-40 h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/15 transition hover:scale-[1.03] active:scale-95"
                                        aria-label={`Gå til profilen til ${name}`}
                                    >
                                        {photoURL ? (
                                            <Image
                                                src={photoURL}
                                                alt={name}
                                                fill
                                                sizes="36px"
                                                className="object-cover"
                                            />
                                        ) : null}
                                    </button>

                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{name}</p>
                                        <p className="text-[11px] text-white/70">
                                            {loadingUid === currentUid ? 'Laster…' : recipes.length > 0 ? `${recipeIndex + 1}/${recipes.length}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-white/10 transition"
                                    aria-label="Lukk"
                                >
                                    <span className="material-symbols-outlined text-white">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Content (no key here -> prevents hard remount flashes) */}
                        <div className="relative h-full w-full">
                            <div className="absolute inset-0">
                                {imgSrc ? (
                                    <div className="relative h-full w-full">
                                        {/* Always-visible placeholder layer (so you never see pure black) */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-black" />

                                        <Image
                                            src={imgSrc}
                                            alt={currentRecipe?.title ?? 'Oppskrift'}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 768px"
                                            quality={70}
                                            priority
                                            placeholder="blur"
                                            blurDataURL={blurDataURL}
                                            loading="eager"
                                            onLoadingComplete={() => setImgLoaded(true)}
                                            className={[
                                                'object-cover transition-opacity duration-300',
                                                imgLoaded ? 'opacity-100' : 'opacity-0',
                                            ].join(' ')}
                                        />

                                        {/* Optional: subtle loader text for slow networks */}
                                        {!imgLoaded && (
                                            <div className="absolute inset-0 grid place-items-center">
                                                <p className="text-white/60 text-sm">Laster bilde…</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full w-full bg-gradient-to-b from-slate-900 via-slate-800 to-black" />
                                )}

                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
                            </div>

                            <div className="absolute inset-0">
                                <div className="absolute left-0 right-0 bottom-0 p-4 md:p-6 z-20">
                                    {currentRecipe ? (
                                        <div className="max-w-xl">
                                            <h2 className="text-2xl md:text-3xl font-semibold text-white leading-tight">{currentRecipe.title}</h2>

                                            {currentRecipe.description ? (
                                                <p className="mt-2 text-sm md:text-base text-white/80 line-clamp-4">{currentRecipe.description}</p>
                                            ) : null}

                                            <div className="mt-4 flex items-center gap-2">
                                                <a
                                                    href={openHref}
                                                    onClick={(e) => {
                                                        if (!currentRecipe) e.preventDefault();
                                                    }}
                                                    aria-label="Åpne oppskriften"
                                                    className={[
                                                        'inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold',
                                                        'bg-white/15 hover:bg-white/20 border border-white/20 text-white',
                                                        'backdrop-blur transition active:scale-[0.99]',
                                                    ].join(' ')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                                                    Åpne
                                                </a>

                                                <button
                                                    type="button"
                                                    onClick={next}
                                                    className={[
                                                        'inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold',
                                                        'bg-white/10 hover:bg-white/15 border border-white/10 text-white/90',
                                                        'backdrop-blur transition active:scale-[0.99]',
                                                    ].join(' ')}
                                                >
                                                    Neste
                                                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-w-xl">
                                            <div className="h-7 w-56 bg-white/20 rounded animate-pulse" />
                                            <div className="mt-3 h-4 w-72 bg-white/15 rounded animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* keyframes */}
                        <style jsx>{`
                            @keyframes storyfill {
                                from {
                                    width: 0%;
                                }
                                to {
                                    width: 100%;
                                }
                            }
                        `}</style>
                    </>
                );
            }}
        </AppModal>
    );
};

export default CreatorStoriesModal;
