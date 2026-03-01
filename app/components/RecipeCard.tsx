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

// CombinedRecipe may include detail fields, but we primarily use Recipe fields
type CombinedRecipe = Recipe & Partial<RecipeDetail>;

interface RecipeCardProps {
    recipe: CombinedRecipe;
    creator?: { name?: string; photoURL?: string };
    isOwner?: boolean;
    onDelete?: (recipeId: string) => void;
}

/**
 * Use this where you want loading placeholders:
 * <RecipeCard.Skeleton />
 */
const RecipeCardSkeleton: React.FC = () => {
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

    /* fade-in ------------------------------------------------- */
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    /* tooltip state ------------------------------------------ */
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

    // ✅ Prefetch route + data when user shows intent (hover/focus/touch)
    const prefetchRecipe = () => {
        // prefetch the route chunk
        router.prefetch(`/recipe/${recipe.id}`);

        // seed cache with what we already have from the feed (instant render)
        qc.setQueryData(['recipe', recipe.id], recipe);

        // fetch full recipe doc in background (removes "loading..." on page)
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

    const handleMove = (e: React.MouseEvent) => setTip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
    const handleLeave = () => setTip((prev) => ({ ...prev, show: false }));

    /* navigation / owner edits -------------------------------- */
    const handleCardClick = () => {
        // ensure cache is warm right before navigation too
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

    /* compute display counts --------------------------------- */
    const displayLikes = recipe.likeCount ?? 0;
    const displayComments = recipe.commentCount ?? 0;

    const createdAtDate = createdAtToDate(recipe.createdAt);

    const ratingSum = typeof recipe.ratingSum === 'number' ? recipe.ratingSum : 0;
    const ratingCount = typeof recipe.ratingCount === 'number' ? recipe.ratingCount : 0;
    const avg = ratingCount > 0 ? ratingSum / ratingCount : 0;
    const avgText = avg.toFixed(1).replace('.', ',');

    /* render -------------------------------------------------- */
    return (
        <div
            className={`relative transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleCardClick}
            onMouseEnter={handleEnter}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onFocus={prefetchRecipe}
            onTouchStart={prefetchRecipe}
            role="button"
            tabIndex={0}
        >
            {/* visual frame */}
            <div
                className="relative group w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
                style={{ minHeight: '18rem' }}
            >
                {recipe.coverImage && (
                    <Image
                        src={recipe.coverImage ?? '/images/icons/corpcore.gif'}
                        alt="Cover"
                        fill
                        // ✅ helps Next pick correct image size (faster)
                        sizes="(max-width: 768px) 100vw, 50vw"
                        quality={70}
                        className="object-cover w-full h-full transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                )}
            </div>

            {/* tooltip */}
            {tip.show && (
                <div
                    className="fixed z-50 pointer-events-none bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1 shadow-xl text-sm font-medium text-slate-900 hidden md:block"
                    style={{ top: tip.y + 12, left: tip.x + 12 }}
                >
                    <img src="/icons/clock-gif.gif" alt="Tid" className="w-4 h-4 inline-block mr-1 mb-0.5" />
                    {recipe.cookingTime ?? '?'}
                </div>
            )}

            {/* text content */}
            <div className="mt-4">
                <h1 className="text-2xl md:text-3xl font-semibold ">{recipe.title}</h1>
                <p className="text-base mt-1 line-clamp-2">{recipe.description}</p>
            </div>


            <div className="flex justify-between mt-4 w-full">
                {/* creator */}
                <button
                    type="button"
                    onClick={handleCreatorClick}
                    className="flex space-x-2 items-center text-left hover:opacity-90 transition hover:cursor-pointer"
                    aria-label={`Gå til profilen til ${userName}`}
                >
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100">
                        {userPhoto && <img src={userPhoto} alt="Creator" className="w-full h-full object-cover" />}
                    </div>

                    <div>
                        <p className="text-xl font-semibold">{userName}</p>
                        <p className="text-xs text-slate-600">{createdAtDate ? dayjs(createdAtDate).fromNow() : 'Akkurat nå'}</p>
                    </div>
                </button>

                {/* likes / comments with fallback */}
                <div className="flex space-x-4 text-sm ">

                    {ratingCount > 0 ? (
                        <div className="flex items-center gap-2 text-sm mt-2 mb-2">
                            <span className="material-symbols-outlined text-[18px]">grade</span>
                            <span className="font-semibold tabular-nums pt-1">
            {avgText} <span className="text-slate-400 font-normal">({ratingCount})</span>
          </span>
                        </div>
                    ) : null}

                    <div className="flex items-center space-x-1">
                        <img src="/icons/chef_white.png" alt="Like" className="w-5 h-5 invert" />
                        <span>{displayLikes}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <span className="material-symbols-outlined">comment</span>
                        <span>{displayComments}</span>
                    </div>
                </div>
            </div>

            {/* owner controls */}
            {isOwner && (
                <div className="relative right-2 flex space-x-2 z-20">
                    <button onClick={handleEdit} className="p-1 rounded h-12 cursor-pointer" title="Edit recipe">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button onClick={handleDelete} className="p-1 rounded cursor-pointer" title="Delete recipe">
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            )}
        </div>
    );
};

// attach skeleton for convenient usage: RecipeCard.Skeleton
const RecipeCard = Object.assign(RecipeCardComponent, { Skeleton: RecipeCardSkeleton });

export default RecipeCard;