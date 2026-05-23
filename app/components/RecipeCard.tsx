'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';

import { Recipe } from '@/app/types/Recipe';
import { RecipeDetail } from '@/app/types/RecipeDetail';
import { fetchRecipeById } from '@/helpers/fetchRecipeById';

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
        router.push(`/recipe/edit/${recipe.id}`);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
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

    return (
        <article
            className={[
                'relative rounded-xl bg-[#f2f1e8] p-3 text-[#12340d]',
                'transition-[opacity,background-color] duration-500 ease-out hover:bg-[#ecebdd]',
                mounted ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
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
            <div className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl bg-[#deded0]">
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
                    <div className="grid h-full w-full place-items-center text-[#496444]">
                        <span className="material-symbols-outlined text-5xl">
                            restaurant
                        </span>
                    </div>
                )}

                {/* Top-right quick stats */}
                <div className="absolute right-3 top-3 flex items-center gap-2">
                    {ratingCount > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-[#fbfaf4]/95 px-2  text-xs font-bold text-[#12340d] shadow-sm backdrop-blur">
                            <span className="material-symbols-outlined text-[16px]">
                                grade
                            </span>
                            {avgText}
                        </div>
                    ) : null}

                    {displayLikes > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-[#fbfaf4]/95 px-2.5 py-1 text-xs font-bold text-[#12340d] shadow-sm backdrop-blur">
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
                    className="fixed z-[9999] pointer-events-none hidden md:flex items-center gap-1.5 rounded-full bg-[#12340d] px-3 py-1.5 text-sm font-medium text-white shadow-xl"
                    style={{
                        top: tip.y + 12,
                        left: tip.x + 12,
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
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#496444] md:text-base">
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
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#deded0] ring-1 ring-[#d8d7cb]">
                        {userPhoto ? (
                            <img
                                src={userPhoto}
                                alt="Creator"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-[#496444]">
                                🧑‍🍳
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#12340d]">
                            {userName}
                        </p>

                        <p className="truncate text-xs text-[#6f8068]">
                            {createdAtDate
                                ? dayjs(createdAtDate).fromNow()
                                : 'Akkurat nå'}
                        </p>
                    </div>
                </button>

                {/* Bottom stats */}
                <div className="flex shrink-0 items-center gap-2 text-sm">
                    {displayComments > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-[#e5e5d7] px-2.5 py-1 font-medium text-[#12340d]">
                            <span className="material-symbols-outlined text-[17px]">
                                comment
                            </span>
                            {displayComments}
                        </div>
                    ) : null}

                    {recipe.cookingTime ? (
                        <div className="hidden items-center gap-1 rounded-full bg-[#e5e5d7] px-2.5 py-1 font-medium text-[#12340d] sm:inline-flex">
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
                <div className="absolute bottom-3 right-3 z-20 flex gap-2">
                    <button
                        onClick={handleEdit}
                        className="grid h-9 w-9 place-items-center rounded-full bg-[#fbfaf4]/95 text-[#12340d] shadow-sm backdrop-blur transition hover:bg-[#e5e5d7]"
                        title="Edit recipe"
                        aria-label="Rediger oppskrift"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            edit
                        </span>
                    </button>

                    <button
                        onClick={handleDelete}
                        className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                        title="Delete recipe"
                        aria-label="Slett oppskrift"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            delete
                        </span>
                    </button>
                </div>
            )}
        </article>
    );
};

const RecipeCard = Object.assign(RecipeCardComponent, {
    Skeleton: RecipeCardSkeleton,
});

export default RecipeCard;