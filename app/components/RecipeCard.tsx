'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { Recipe } from '@/app/types/Recipe';
import { RecipeDetail } from '@/app/types/RecipeDetail';


type CombinedRecipe = Recipe & Partial<RecipeDetail>;

interface RecipeCardProps {
    recipe: CombinedRecipe;
    creator?: { name?: string; photoURL?: string };
    isOwner?: boolean;
    onDelete?: (recipeId: string) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({
                                                   recipe,
                                                   creator,
                                                   isOwner = false,
                                                   onDelete,
                                               }) => {
    const router = useRouter();
    const userName  = creator?.name  || 'Ukjent brukernavn';
    const userPhoto = creator?.photoURL;

    /* fade-in ------------------------------------------------- */
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    /* tooltip state ------------------------------------------ */
    const [tip, setTip] = useState({ show: false, x: 0, y: 0 });
    const handleEnter = (e: React.MouseEvent) =>
        setTip({ show: true, x: e.clientX, y: e.clientY });
    const handleMove  = (e: React.MouseEvent) =>
        setTip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    const handleLeave = () => setTip(prev => ({ ...prev, show: false }));

    /* navigation / owner edits -------------------------------- */
    const handleCardClick = () => router.push(`/recipe/${recipe.id}`);
    const handleEdit   = (e: React.MouseEvent) => { e.stopPropagation(); router.push(`/recipe/edit/${recipe.id}`); };
    const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete?.(recipe.id); };

    /* render -------------------------------------------------- */
    return (
        <div
            className={`relative transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleCardClick}
        >
            {/* visual frame */}
            <div
                className={`relative group w-full cursor-pointer overflow-hidden
          ${!recipe.coverImage ? 'bg-gradient-to-t from-[#73628A] to-[#d89cf6]' : ''}`}
                style={{ minHeight: '30rem' }}
                onMouseEnter={handleEnter}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
            >
                {recipe.coverImage && (
                    <>
                        <Image
                            src={recipe.coverImage}
                            alt="Cover"
                            fill
                            className="object-cover w-full h-full rounded-lg transition-all duration-300 ease-out group-hover:scale-90 group-hover:rounded-3xl"
                        />
                        {/* corner frames */}
                        <div className="absolute top-0 left-0    w-8 h-8 border-t-4 border-l-4  opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute top-0 right-0   w-8 h-8 border-t-4 border-r-4  opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4  opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4  opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                )}
            </div>

            {/* tooltip */}
            {tip.show && (
                <div
                    className="fixed z-50 pointer-events-none bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-xl text-sm font-medium text-black"
                    style={{ top: tip.y + 12, left: tip.x + 12 }}
                >

                    <img
                        src="/icons/clock-gif.gif"
                        alt="Tid"
                        className="w-4 h-4 inline-block mr-1 mb-0.5"
                    />

                    {recipe.cookingTime ?? '?'}
                </div>
            )}

            {/* text content */}
            <h1 className="md:text-6xl text-4xl font-bold mt-4">{recipe.title}</h1>
            <p className="text-lg mt-2">{recipe.description}</p>

            <div className="flex justify-between mt-4 w-full">
                {/* creator */}
                <div className="flex space-x-2 items-center">
                    <div className="h-10 w-10 rounded-full overflow-hidden">
                        {userPhoto && <img src={userPhoto} alt="Creator" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                        <p className="text-xl font-semibold">{userName}</p>
                        <p className="text-xs">
                            {recipe.createdAt
                                ? (recipe.createdAt as Timestamp).toDate().toLocaleString('nb-NO', {
                                    timeZone: 'Europe/Oslo',
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })
                                : 'Ingen dato funnet'}
                        </p>
                    </div>
                </div>

                {/* likes / comments (keep optional so the card renders for detail objects) */}
                <div className="flex space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                        <img src="/icons/chef_white.png" alt="Like" className="w-6 h-6" />
                        <span>{(recipe as Recipe).likeCount ?? 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <span className="material-symbols-outlined">chat_bubble</span>
                        <span>{(recipe as Recipe).commentCount ?? 0}</span>
                    </div>
                </div>
            </div>

            {/* owner controls */}
            {isOwner && (
                <div className="relative right-2 flex space-x-2 z-20">
                    <button onClick={handleEdit}   className="p-1 rounded h-12 cursor-pointer" title="Edit recipe">
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button onClick={handleDelete} className="p-1 rounded cursor-pointer"   title="Delete recipe">
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default RecipeCard;
