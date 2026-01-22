'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import LikeButton       from '@/app/components/LikeButton';
import CommentSection   from '@/app/components/CommentSection';
import AddToCollectionModal from '@/app/components/AddToCollectionModal';

import { useRecipe }   from '@/hooks/useRecipe';
import { useUserData } from '@/hooks/useUserData';

const RecipeDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [showAddModal, setShowAddModal] = useState(false);
    const [recipe, loading] = useRecipe(id as string);
    const creatorDoc        = useUserData(recipe?.userId || '');

    if (loading)   return <div className="p-4">Laster…</div>;
    if (!recipe)   return <div className="p-4">Oppskrift ikke funnet.</div>;

    const userName  = creatorDoc?.name     || 'Ukjent brukernavn';
    const userPhoto = creatorDoc?.photoURL || '';
    const ingredients = recipe.ingredients ?? [];

    return (
        <div className="pb-20">
            <div className="max-w-4xl md:mx-auto m-4 rounded-2xl">
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


                {/* Header */}
                <div className="overflow-hidden ">
                    {/* Cover image */}
                    {recipe.coverImage && (
                        <div className="relative w-full aspect-[16/9] md:aspect-[16/9]">
                            <Image
                                src={recipe.coverImage}
                                alt={`${recipe.title} cover`}
                                fill
                                className="object-cover rounded-2xl"
                                priority
                            />
                        </div>
                    )}

                    {/* Content under image */}
                    <div className=" mt-6">
                        <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-2">
                            {recipe.title}
                        </h2>

                        {recipe.description && (
                            <p className="text-base md:text-lg text-slate-600">
                                {recipe.description}
                            </p>
                        )}

           {/*             <div className="mt-6 w-24 h-24 md:w-28 md:h-28 flex items-center justify-center overflow-hidden">
                            <div className="w-full h-full flex items-center justify-center">
                                <div
                                    className="w-20 h-20 md:w-24 md:h-24"
                                    dangerouslySetInnerHTML={{
                                        __html: recipe.image
                                            .replace(/class="[^"]*bg-white[^"]*"/, 'class=""')
                                            .replace(/fill="white"/, 'fill="none"')
                                            .replace(/width="\d+"/, 'width="100%"')
                                            .replace(/height="\d+"/, 'height="100%"')
                                            .replace(
                                                /<svg([^>]*?)>/,
                                                '<svg$1 viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">',
                                            ),
                                    }}
                                />
                            </div>
                        </div>
*/}

                    </div>
                </div>


            </div>

            {/* Creator */}
            <div
                className="flex space-x-2 items-center max-w-4xl mx-auto px-4 py-2 cursor-pointer"
                onClick={() => router.push(`/user/${recipe.userId}`)}
            >
                <div className="h-16 w-16 rounded-full overflow-hidden">
                    {userPhoto && (
                        <img src={userPhoto} alt="Creator" className="w-full h-full object-cover" />
                    )}
                </div>
                <h1 className="text-xl font-medium text-slate-900">{userName}</h1>
            </div>

            {/* Ingredients & meta */}
            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between gap-8">
                <div className="flex-1">
                    {ingredients.length > 0 && (
                        <>
                            <h2 className="text-lg font-semibold text-slate-900">Ingredienser</h2>
                            <ul className="list-disc pl-5 text-slate-700">
                                {ingredients.map((ing, idx) => (
                                    <li key={idx}>{ing}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
                <div className="text-slate-700">
                    {recipe.temperature && (
                        <p className="mt-2"><strong>Temperatur:</strong> {recipe.temperature}</p>
                    )}
                    {recipe.cookingTime && (
                        <p className="mt-2"><strong>Koketid:</strong> {recipe.cookingTime}</p>
                    )}
                </div>
            </div>

            {/* Steps */}
            <div className="max-w-4xl mx-auto px-4 pb-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Fremgangsmåte</h2>
                <div className="space-y-4">
                    {recipe.cookingSteps.map((step, i) => (
                        <div
                            key={`step-${i}`}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <h3 className="text-base font-semibold text-slate-900">
                                {i + 1}. {step.title}
                            </h3>
                            <p className="text-sm text-slate-600 mt-2">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Social */}
            <div className="max-w-4xl mx-auto p-4">
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
