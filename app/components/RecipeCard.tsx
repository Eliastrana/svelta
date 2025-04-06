'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import { Recipe } from '@/app/types/Recipe';

interface RecipeCardProps {
    recipe: Recipe;
    creator?: {
        name?: string;
        photoURL?: string;
    };

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
    const userName = creator?.name || 'Ukjent brukernavn';
    const userPhoto = creator?.photoURL;

    const handleCardClick = () => {
        router.push(`/recipe/${recipe.id}`);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/recipe/edit/${recipe.id}`);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(recipe.id);
        }
    };

    return (
        <div className="relative" onClick={handleCardClick}>
            <div
                className="relative group bg-[#73628A] md:p-12 p-4 rounded-lg w-full cursor-pointer shadow-lg overflow-hidden white-text"
                style={{ minHeight: '24rem' }}
            >
                {recipe.coverImage && (
                    <div>
                        <Image
                            src={recipe.coverImage}
                            height={1000}
                            width={2000}
                            alt="Cover"
                            className="absolute top-0 left-0 w-full h-full object-cover rounded-lg"
                        />
                        <div className="absolute top-0 left-0 w-full h-full bg-black/30 opacity-100 group-hover:opacity-0 transition-opacity duration-300 z-10 rounded-lg" />
                    </div>
                )}
                <div className="relative z-10">
                    <div
                        className="w-64 h-64 md:w-64 md:h-64 overflow-hidden flex items-center justify-center"
                        style={{ filter: 'invert(1)' }}
                        dangerouslySetInnerHTML={{
                            __html: recipe.image
                                .replace(
                                    /class="[^"]*bg-white[^"]*"/,
                                    'class=""'
                                )
                                .replace(/fill="white"/, 'fill="none"')
                                .replace(/width="\+"/, '')
                                .replace(/height="\d+"/, '')
                                .replace(
                                    /<svg([^>]*?)>/,
                                    `<svg$1 viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
                                ),
                        }}
                    />
                    <h1 className="md:text-8xl text-5xl font-bold">
                        {recipe.title}
                    </h1>
                    <p className="text-lg mt-2">{recipe.description}</p>
                    <div className="flex justify-between mt-4">
                        <div className="flex space-x-2 items-center">
                            <div className="h-10 w-10 rounded-full overflow-hidden">
                                {userPhoto && (
                                    <img
                                        src={userPhoto}
                                        alt="Creator Photo"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            <div>
                                <p className="text-xl font-semibold">
                                    {userName}
                                </p>
                                <p className="text-xs">
                                    {recipe.createdAt
                                        ? (
                                              recipe.createdAt as unknown as Timestamp
                                          )
                                              .toDate()
                                              .toLocaleString('nb-NO', {
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
                        <div className="flex space-x-4 mt-4 text-sm">
                            <div className="flex items-center space-x-1">
                                <img
                                    src="/icons/chef_white.png"
                                    alt="Like"
                                    className="w-6 h-6"
                                />
                                <span>{recipe.likeCount ?? 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <span className="material-symbols-outlined">
                                    chat_bubble
                                </span>
                                <span>{recipe.commentCount ?? 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isOwner && (
                <div className="relative right-2 flex space-x-2 z-20 ">
                    <button
                        onClick={handleEdit}
                        className=" p-1 rounded  h-12 cursor-pointer "
                        title="Edit recipe"
                    >
                        <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button
                        onClick={handleDelete}
                        className=" p-1 rounded  cursor-pointer"
                        title="Delete recipe"
                    >
                        <span className="material-symbols-outlined">
                            delete
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default RecipeCard;
