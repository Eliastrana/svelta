'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSwipeable } from 'react-swipeable';
import Image from 'next/image';
import LikeButton       from '@/app/components/LikeButton';
import CommentSection   from '@/app/components/CommentSection';
import AddToCollectionModal from '@/app/components/AddToCollectionModal';

import { useRecipe }   from '@/hooks/useRecipe';
import { useUserData } from '@/hooks/useUserData';

const RecipeDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [pageIndex,   setPageIndex]   = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [recipe, loading] = useRecipe(id as string);
    const creatorDoc        = useUserData(recipe?.userId || '');

    const handleNext = () => {
        if (!recipe) return;
        if (pageIndex < slides.length - 1) setPageIndex((p) => p + 1);
    };
    const handlePrev = () => {
        if (pageIndex > 0) setPageIndex((p) => p - 1);
    };
    const handlers = useSwipeable({
        onSwipedLeft : handleNext,
        onSwipedRight: handlePrev,
        trackMouse   : true,
    });

    if (loading)   return <div className="p-4">Laster…</div>;
    if (!recipe)   return <div className="p-4">Oppskrift ikke funnet.</div>;

    const userName  = creatorDoc?.name     || 'Ukjent brukernavn';
    const userPhoto = creatorDoc?.photoURL || '';
    const ingredients = recipe.ingredients ?? [];

    const slides = [
        <div key="intro" className="relative w-full h-full">
            {recipe.coverImage && (
                <div className="absolute inset-0">
                    <Image
                        src={recipe.coverImage}
                        alt="Cover"
                        fill
                        className="object-cover rounded-lg"
                    />
                </div>
            )}
            <div className="absolute inset-0 bg-black/30 z-10 rounded-lg" />
            <div className="relative z-20 flex flex-col justify-end h-full p-4">
                <div
                    className="w-64 h-64 md:w-64 md:h-64 overflow-hidden flex items-center justify-center hidden md:block"
                    style={{ filter: 'invert(1)' }}
                    dangerouslySetInnerHTML={{
                        __html: recipe.image
                            .replace(/class="[^"]*bg-white[^"]*"/, 'class=""')
                            .replace(/fill="white"/, 'fill="none"')
                            .replace(/width="\d+"/, '')
                            .replace(/height="\d+"/, '')
                            .replace(
                                /<svg([^>]*?)>/,
                                '<svg$1 viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">',
                            ),
                    }}
                />
                <h2 className="md:text-8xl text-5xl font-bold mb-2 text-white">
                    {recipe.title}
                </h2>
                <p className="mb-4 text-lg text-white">{recipe.description}</p>
            </div>
        </div>,
        ...recipe.cookingSteps.map((step, i) => (
            <div key={`step-${i}`} className="w-full h-full md:p-14 p-8">
                <h2 className="md:text-6xl text-4xl font-bold mb-2">
                    {i + 1}: {step.title}
                </h2>
                <p className="text-lg mt-2">{step.description}</p>
            </div>
        )),
    ];

    return (
        <div>
            <div className="max-w-4xl md:mx-auto m-2 rounded-lg">
                {/* Top bar */}
                <div className="flex justify-between">
                    <button onClick={() => router.back()} className="mb-4">
                        <span className="material-symbols-outlined">close</span>
                    </button>

                    {/* Add to list */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="mb-4"
                    >
                        <span className="material-symbols-outlined">bookmark_add</span>
                    </button>
                </div>

                {/* Swipeable slides */}
                <div
                    {...handlers}
                    className="overflow-hidden relative w-full rounded-lg shadow-lg"
                >
                    <div
                        className="flex transition-transform duration-300 ease-in-out w-full"
                        style={{ transform: `translateX(-${pageIndex * 100}%)` }}
                    >
                        {slides.map((slide, idx) => (
                            <div key={idx} className="w-full flex-shrink-0">
                                {slide}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dots */}
                <div className="flex justify-center space-x-2 mt-4">
                    {slides.map((_, idx) => (
                        <div
                            key={idx}
                            onClick={() => setPageIndex(idx)}
                            className={`w-3 h-3 rounded-full cursor-pointer ${
                                idx === pageIndex ? 'bg-[#373737]' : 'bg-gray-300'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Creator */}
            <div
                className="flex space-x-2 items-center max-w-4xl mx-auto p-2 cursor-pointer"
                onClick={() => router.push(`/user/${recipe.userId}`)}
            >
                <div className="h-16 w-16 rounded-full overflow-hidden">
                    {userPhoto && (
                        <img src={userPhoto} alt="Creator" className="w-full h-full object-cover" />
                    )}
                </div>
                <h1 className="text-2xl">{userName}</h1>
            </div>

            {/* Ingredients & meta */}
            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between">
                <div>
                    {ingredients.length > 0 && (
                        <>
                            <h2 className="text-xl font-bold">Ingredienser</h2>
                            <ul className="list-disc pl-5">
                                {ingredients.map((ing, idx) => (
                                    <li key={idx}>{ing}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
                <div>
                    {recipe.temperature && (
                        <p className="mt-2"><strong>Temperatur:</strong> {recipe.temperature}</p>
                    )}
                    {recipe.cookingTime && (
                        <p className="mt-2"><strong>Koketid:</strong> {recipe.cookingTime}</p>
                    )}
                </div>
            </div>

            {/* Social */}
            <div className="max-w-4xl mx-auto p-2">
                <LikeButton recipeId={recipe.id} />
                <CommentSection recipeId={recipe.id} />
            </div>

            {/* Add‑to‑list modal */}
            {showAddModal && (
                <AddToCollectionModal
                    recipeId={recipe.id}
                    onClose={() => setShowAddModal(false)}
                />
            )}
        </div>
    );
};

export default RecipeDetail;
