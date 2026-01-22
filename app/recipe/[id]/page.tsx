'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { deleteDoc, doc } from 'firebase/firestore';

import LikeButton from '@/app/components/LikeButton';
import CommentSection from '@/app/components/CommentSection';
import AddToCollectionModal from '@/app/components/AddToCollectionModal';

import { useRecipe } from '@/hooks/useRecipe';
import { useUserData } from '@/hooks/useUserData';
import { auth, firestore } from '@/firebase';

// ✅ New ingredient shape (supports amount + name)
type IngredientDetailed = { name: string; amount: string };

// ✅ Minimal “upgrade-safe” Recipe type for this page:
type RecipeForDetail = {
    id: string;
    userId: string;
    title: string;
    description?: string;
    coverImage?: string;
    cookingSteps: Array<{ title: string; description: string }>;
    temperature?: string;
    cookingTime?: string;
    poritons?: string;

    // legacy
    ingredients?: string[];

    // new
    ingredientsDetailed?: IngredientDetailed[];
};

const RecipeDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [showAddModal, setShowAddModal] = useState(false);

    // delete modal state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [recipeRaw, loading] = useRecipe(id as string);
    const recipe = recipeRaw as RecipeForDetail | null;

    const creatorDoc = useUserData(recipe?.userId || '');

    const currentUid = auth.currentUser?.uid ?? '';
    const isOwner = Boolean(recipe && currentUid && recipe.userId === currentUid);

    const ingredientsToRender: IngredientDetailed[] = useMemo(() => {
        if (!recipe) return [];

        return recipe.ingredientsDetailed && recipe.ingredientsDetailed.length > 0
            ? recipe.ingredientsDetailed
                .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() }))
                .filter((i) => i.name.length > 0)
            : (recipe.ingredients ?? [])
                .map((s) => ({ name: String(s).trim(), amount: '' }))
                .filter((i) => i.name.length > 0);
    }, [recipe]);

    if (loading) return <div className="p-4">Laster…</div>;
    if (!recipe) return <div className="p-4">Oppskrift ikke funnet.</div>;

    const userName = creatorDoc?.name || 'Ukjent brukernavn';
    const userPhoto = creatorDoc?.photoURL || '';

    const handleDelete = async () => {
        if (!recipe) return;
        if (!isOwner) return;

        try {
            setDeleting(true);
            await deleteDoc(doc(firestore, 'recipes', recipe.id));
            // send user tilbake til profilen sin (evt. "/")
            router.replace(`/user/${currentUid}`);
        } catch (err) {
            console.error('Error deleting recipe:', err);
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="pb-20">
            <div className="max-w-4xl md:mx-auto m-4 rounded-2xl">
                {/* Top bar */}
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={() => router.back()}
                        className="mb-4 px-4 py-2 rounded-full bg-cyan-100 hover:cursor-pointer flex items-center gap-2"
                        type="button"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Tilbake
                    </button>

                    {/* ✅ Owner actions */}
                </div>

                {/* Header */}
                <div className="overflow-hidden">
                    {/* Cover image */}
                    {recipe.coverImage && (
                        <div className="relative w-full aspect-square md:aspect-[16/9]">
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
                    <div className="mt-6">

                        <div className="md:flex items-center justify-between">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mb-4 px-4 py-2 rounded-full bg-cyan-100 hover:cursor-pointer flex items-center gap-2"
                            type="button"
                        >
                            <span className="material-symbols-outlined">bookmark_add</span>
                            Legg til i samling
                        </button>

                            {isOwner && (
                                <div className="mb-4 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/recipe/edit/${recipe.id}`)} // 👈 endre hvis route er annerledes
                                        className="px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                        Rediger
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                        Slett
                                    </button>
                                </div>
                            )}

                        </div>

                        <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-2">{recipe.title}</h2>

                        {recipe.description && (
                            <p className="text-base md:text-lg text-slate-600">{recipe.description}</p>
                        )}

                    </div>


                </div>
            </div>

            {/* Creator */}
            <div
                className="flex space-x-2 items-center max-w-4xl mx-auto px-4 py-2 cursor-pointer"
                onClick={() => router.push(`/user/${recipe.userId}`)}
            >
                <div className="h-16 w-16 rounded-full overflow-hidden">
                    {userPhoto && <img src={userPhoto} alt="Creator" className="w-full h-full object-cover" />}
                </div>
                <h1 className="text-xl font-medium text-slate-900">{userName}</h1>
            </div>

            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between gap-8">
                <h2 className="text-2xl font-semibold">Ingredienser</h2>
            </div>

            {/* Ingredients & meta */}
            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between gap-8">
                <div className="flex-1">
                    {ingredientsToRender.length > 0 && (
                        <ul className="rounded-2xl border border-slate-200 bg-cyan-100 shadow-sm overflow-hidden">
                            {ingredientsToRender.map((ing, idx) => (
                                <li
                                    key={`ing-${idx}`}
                                    className="flex items-start justify-between px-4 py-3 border-b border-slate-200 last:border-b-0"
                                >
                                    <div className="flex-1">
                                        <span className="font-semibold text-slate-900">{ing.name}</span>
                                    </div>

                                    {ing.amount ? <span className="shrink-0 text-slate-600">{ing.amount}</span> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-6 md:mt-0 md:min-w-[220px]">
                    {(recipe.temperature || recipe.cookingTime) && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            {recipe.temperature && (
                                <p className="text-slate-800">
                                    <span className="font-semibold">Temperatur:</span> {recipe.temperature}
                                </p>
                            )}
                            {recipe.cookingTime && (
                                <p className="text-slate-800 mt-2">
                                    <span className="font-semibold">Koketid:</span> {recipe.cookingTime}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between gap-8">
                <h2 className="text-2xl font-semibold">Fremgangsmåte</h2>
            </div>
            {/* Steps */}
            <div className="max-w-4xl mx-auto px-4 pb-6">
                <div className="space-y-4">
                    {recipe.cookingSteps.map((step, i) => (
                        <div
                            key={`step-${i}`}
                            className="rounded-2xl border border-slate-200 bg-cyan-100 p-4 shadow-sm"
                        >
                            <h3 className="md:text-xl text-base">
                                {i + 1}. {step.title}
                            </h3>
                            <p className="text-sm mt-2">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Social */}
            <div className="max-w-4xl mx-auto p-4">
                <LikeButton recipeId={recipe.id} />
                <CommentSection recipeId={recipe.id} />
            </div>

            {/* Add-to-list modal */}
            {showAddModal && <AddToCollectionModal recipeId={recipe.id} onClose={() => setShowAddModal(false)} />}

            {/* ✅ Delete confirm modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 bg-slate-900/30 flex items-center justify-center px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
                        <h2 className="text-xl font-semibold text-slate-900">Slette oppskriften?</h2>
                        <p className="text-slate-600 mt-2">
                            Dette kan ikke angres.
                        </p>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50"
                                disabled={deleting}
                            >
                                Avbryt
                            </button>

                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
                                disabled={deleting}
                            >
                                {deleting ? 'Sletter…' : 'Slett'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecipeDetail;