'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';

import { Recipe } from '@/app/types/Recipe';
import { RecipeDetail } from '@/app/types/RecipeDetail';
import { fetchRecipeById } from '@/helpers/fetchRecipeById';
import { DEFAULT_PROFILE_THEME_ID, ProfileTheme } from '@/helpers/profileAppearance';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/nb';

dayjs.extend(relativeTime);
dayjs.locale('nb');

type CombinedRecipe = Recipe & Partial<RecipeDetail>;

interface RecipeCardProps {
    recipe: CombinedRecipe;
    creator?: { name?: string; photoURL?: string };
    isOwner?: boolean;
    onDelete?: (recipeId: string) => void;
    theme?: ProfileTheme;
}

const RecipeCardSkeleton: React.FC = () => {
    return (
        <div className="animate-pulse rounded-xl bg-[#f2f1e8] p-3">
            <div className="aspect-[4/3] rounded-xl bg-[#deded0]" />

            <div className="mt-4 space-y-2 px-1">
                <div className="h-7 w-2/3 rounded-xl bg-[#deded0]" />
                <div className="h-4 w-full rounded-xl bg-[#deded0]" />
                <div className="h-4 w-5/6 rounded-xl bg-[#deded0]" />
            </div>

            <div className="mt-4 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-[#deded0]" />
                    <div className="space-y-2">
                        <div className="h-4 w-28 rounded-xl bg-[#deded0]" />
                        <div className="h-3 w-36 rounded-xl bg-[#deded0]" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="h-7 w-12 rounded-full bg-[#deded0]" />
                    <div className="h-7 w-12 rounded-full bg-[#deded0]" />
                </div>
            </div>
        </div>
    );
};

const RecipeCardComponent: React.FC<RecipeCardProps> = ({
                                                            recipe,
                                                            creator,
                                                            isOwner = false,
                                                            onDelete,
                                                            theme,
                                                        }) => {
    const router = useRouter();
    const qc = useQueryClient();

    const userName = creator?.name || 'Ukjent brukernavn';
    const userPhoto = creator?.photoURL;

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setMounted(true);
        });

        return () => cancelAnimationFrame(frame);
    }, []);

    const [tip, setTip] = useState<{ show: boolean; x: number; y: number }>({
        show: false,
        x: 0,
        y: 0,
    });
    const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
    const ownerMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!ownerMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!ownerMenuRef.current?.contains(event.target as Node)) {
                setOwnerMenuOpen(false);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [ownerMenuOpen]);

    const createdAtToDate = (createdAt?: Timestamp | Date | number): Date | null => {
        if (!createdAt) return null;
        if (createdAt instanceof Timestamp) return createdAt.toDate();
        if (createdAt instanceof Date) return createdAt;
        return new Date(createdAt);
    };

    const prefetchRecipe = () => {
        router.prefetch(`/recipe/${recipe.id}`);

        qc.setQueryData(['recipe', recipe.id], recipe);

        qc.prefetchQuery({
            queryKey: ['recipe', recipe.id],
            queryFn: () => fetchRecipeById(recipe.id),
            staleTime: 60_000,
        });
    };

    const handleEnter = (e: React.MouseEvent) => {
        setTip({ show: true, x: e.clientX, y: e.clientY });
        prefetchRecipe();
    };

    const handleMove = (e: React.MouseEvent) => {
        setTip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
    };

    const handleLeave = () => {
        setTip((prev) => ({ ...prev, show: false }));
    };

    const handleCardClick = () => {
        prefetchRecipe();
        router.push(`/recipe/${recipe.id}`);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOwnerMenuOpen(false);
        router.push(`/recipe/edit/${recipe.id}`);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOwnerMenuOpen(false);
        onDelete?.(recipe.id);
    };

    const handleCreatorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/user/${recipe.userId}`);
    };

    const displayLikes = recipe.likeCount ?? 0;
    const displayComments = recipe.commentCount ?? 0;

    const createdAtDate = createdAtToDate(recipe.createdAt);

    const ratingSum = typeof recipe.ratingSum === 'number' ? recipe.ratingSum : 0;
    const ratingCount = typeof recipe.ratingCount === 'number' ? recipe.ratingCount : 0;
    const avg = ratingCount > 0 ? ratingSum / ratingCount : 0;
    const avgText = avg.toFixed(1).replace('.', ',');
    const isBaseSveltaTheme = theme?.id === DEFAULT_PROFILE_THEME_ID;
    const cardBackground = theme
        ? isBaseSveltaTheme
            ? '#f2f1e8'
            : theme.soft
        : '#f2f1e8';
    const cardText = theme?.text ?? '#12340d';
    const cardMutedText = theme?.accent ?? '#496444';
    const cardSubtleText = theme ? `${theme.text}aa` : '#6f8068';
    const imageFallbackBackground = theme ? `${theme.main}22` : '#deded0';
    const chipBackground = theme ? `${theme.main}14` : '#e5e5d7';
    const chipText = theme?.text ?? '#12340d';
    const overlayChipBackground = theme ? `${theme.soft}f2` : '#fbfaf4f2';
    const ownerButtonBackground = theme ? `${theme.soft}f2` : '#fbfaf4f2';
    const ownerMenuEditBackground = theme ? `${theme.main}14` : '#eef3e4';
    const tooltipBackground = theme
        ? isBaseSveltaTheme
            ? '#12340d'
            : theme.main
        : '#12340d';

    return (
        <article
            className={[
                'relative rounded-xl p-3 transition-opacity duration-500 ease-out',
                mounted ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            style={{ backgroundColor: cardBackground, color: cardText }}
            onClick={handleCardClick}
            onMouseEnter={handleEnter}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onFocus={prefetchRecipe}
            onTouchStart={prefetchRecipe}
            role="button"
            tabIndex={0}
        >
            {/* Image */}
            <div className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl" style={{ backgroundColor: imageFallbackBackground }}>
                {recipe.coverImage ? (
                    <Image
                        src={recipe.coverImage}
                        alt={recipe.title || 'Cover'}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        quality={70}
                        className="object-cover transition-transform duration-300 ease-out hover:scale-105"
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center" style={{ color: cardMutedText }}>
                        <span className="material-symbols-outlined text-5xl">
                            restaurant
                        </span>
                    </div>
                )}

                {/* Top-right quick stats */}
                <div className="absolute right-3 top-3 flex items-center gap-2">
                    {ratingCount > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full px-2 text-xs font-bold shadow-sm backdrop-blur" style={{ backgroundColor: overlayChipBackground, color: chipText }}>
                            <span className="material-symbols-outlined text-[16px]">
                                grade
                            </span>
                            {avgText}
                        </div>
                    ) : null}

                    {displayLikes > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur" style={{ backgroundColor: overlayChipBackground, color: chipText }}>
                            <img
                                src="/icons/chef.png"
                                alt=""
                                className="h-4 w-4"
                                draggable={false}
                            />
                            {displayLikes}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Tooltip */}
            {tip.show && (
                <div
                    className="fixed z-[9999] pointer-events-none hidden md:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-xl"
                    style={{
                        top: tip.y + 12,
                        left: tip.x + 12,
                        backgroundColor: tooltipBackground,
                    }}
                >
                    <img
                        src="/icons/clock-gif.gif"
                        alt="Tid"
                        className="h-4 w-4 shrink-0 invert"
                        draggable={false}
                    />

                    <span>{recipe.cookingTime ?? '?'}</span>
                </div>
            )}

            {/* Text content */}
            <div className="px-1 pt-4">
                <h1 className="line-clamp-2 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                    {recipe.title}
                </h1>

                {recipe.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed md:text-base" style={{ color: cardMutedText }}>
                        {recipe.description}
                    </p>
                ) : null}
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 px-1">
                {/* Creator */}
                <button
                    type="button"
                    onClick={handleCreatorClick}
                    className="flex min-w-0 items-center gap-2 text-left transition hover:opacity-80"
                    aria-label={`Gå til profilen til ${userName}`}
                >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-ful" style={{ backgroundColor: imageFallbackBackground, borderColor: `${theme?.main ?? '#d8d7cb'}33` }}>
                        {userPhoto ? (
                            <Image
                                src={userPhoto}
                                alt="Creator"
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center" style={{ color: cardMutedText }}>
                                🧑‍🍳
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold" style={{ color: cardText }}>
                            {userName}
                        </p>

                        <p className="truncate text-xs" style={{ color: cardSubtleText }}>
                            {createdAtDate
                                ? dayjs(createdAtDate).fromNow()
                                : 'Akkurat nå'}
                        </p>
                    </div>
                </button>

                {/* Bottom stats */}
                <div className="flex shrink-0 items-center gap-2 text-sm">
                    {displayComments > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: chipBackground, color: chipText }}>
                            <span className="material-symbols-outlined text-[17px]">
                                mode_comment
                            </span>
                            {displayComments}
                        </div>
                    ) : null}

                    {recipe.cookingTime ? (
                        <div className="hidden items-center gap-1 rounded-full px-2.5 py-1 font-medium sm:inline-flex" style={{ backgroundColor: chipBackground, color: chipText }}>
                            <span className="material-symbols-outlined text-[17px]">
                                schedule
                            </span>
                            {recipe.cookingTime}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Owner controls */}
            {isOwner && (
                <div ref={ownerMenuRef} className="absolute top-5 left-5 z-20 flex items-start gap-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOwnerMenuOpen((prev) => !prev);
                        }}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-sm backdrop-blur transition"
                        style={{ backgroundColor: ownerButtonBackground, color: chipText }}
                        title="Flere valg"
                        aria-label="Flere valg"
                        aria-expanded={ownerMenuOpen}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            more_horiz
                        </span>
                    </button>

                    <div
                        className={[
                            'flex origin-left items-center gap-2 overflow-hidden rounded-full bg-[#fbfaf4]/95 shadow-sm backdrop-blur transition-all duration-200 ease-out',
                            ownerMenuOpen
                                ? 'max-w-[220px] scale-100 px-2 py-2 opacity-100'
                                : 'max-w-0 scale-95 px-0 py-2 opacity-0 pointer-events-none',
                        ].join(' ')}
                    >
                        <button
                            type="button"
                            onClick={handleEdit}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition"
                            style={{ backgroundColor: ownerMenuEditBackground, color: chipText }}
                            title="Rediger oppskrift"
                            aria-label="Rediger oppskrift"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                edit
                            </span>
                            Rediger
                        </button>

                        <button
                            type="button"
                            onClick={handleDelete}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-600"
                            title="Slett oppskrift"
                            aria-label="Slett oppskrift"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                delete
                            </span>
                            Slett
                        </button>
                    </div>
                </div>
            )}
        </article>
    );
};

const RecipeCard = Object.assign(RecipeCardComponent, {
    Skeleton: RecipeCardSkeleton,
});

export default RecipeCard;
