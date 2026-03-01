'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { deleteDoc, doc } from 'firebase/firestore';

import LikeButton from '@/app/components/LikeButton';
import CommentSection from '@/app/components/CommentSection';
import AddToCollectionModal from '@/app/components/AddToCollectionModal';
import AppModal from '@/app/components/AppModal';

import { useRecipe } from '@/hooks/useRecipe';
import { useUserData } from '@/hooks/useUserData';
import { auth, firestore } from '@/firebase';
import RatingStars from '@/app/components/RatingStars';

type IngredientDetailed = { name: string; amount: string };

type RecipeForDetail = {
    id: string;
    userId: string;
    title: string;
    description?: string;
    coverImage?: string;
    cookingSteps: Array<{ title: string; description: string }>;
    temperature?: string;
    cookingTime?: string;
    portions?: string;
    ingredients?: string[];
    ingredientsDetailed?: IngredientDetailed[];
    tags?: string[];
};

type Props = {
    id: string;
};

const RecipeDetailSkeleton: React.FC = () => {
    return (
        <div className="pb-20 animate-pulse">
            <div className="max-w-4xl md:mx-auto m-4 rounded-2xl">
                {/* Top bar */}
                <div className="flex items-center justify-between gap-2">
                    <div className="mb-4 h-10 w-28 rounded-full bg-slate-100" />
                </div>

                {/* Header */}
                <div className="overflow-hidden">
                    {/* Cover image skeleton */}
                    <div className="relative w-full aspect-square md:aspect-[16/9] rounded-2xl bg-slate-100" />

                    <div className="mt-6">
                        <div className="md:flex items-center justify-between">
                            <div className="mb-4 h-10 w-48 rounded-full bg-slate-100" />

                            <div className="mb-4 flex items-center gap-2">
                                <div className="h-10 w-28 rounded-full bg-slate-100" />
                                <div className="h-10 w-24 rounded-full bg-slate-100" />
                            </div>
                        </div>

                        <div className="h-10 w-3/4 rounded-xl bg-slate-100" />
                        <div className="mt-3 h-5 w-full rounded-xl bg-slate-100" />
                        <div className="mt-2 h-5 w-5/6 rounded-xl bg-slate-100" />
                    </div>

                    {/* Tags skeleton */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={`tag-sk-${i}`} className="h-7 w-16 rounded-full bg-slate-100" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Creator skeleton */}
            <div className="flex space-x-2 items-center max-w-4xl mx-auto px-4 md:px-0 py-2">
                <div className="h-16 w-16 rounded-full bg-slate-100" />
                <div className="h-6 w-44 rounded-xl bg-slate-100" />
            </div>

            {/* Like / Rating skeleton */}
            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between gap-8">
                <div className="h-10 w-44 rounded-full bg-slate-100" />
                <div className="mt-4 md:mt-0 h-10 w-40 rounded-full bg-slate-100" />
            </div>

            {/* Ingredients header */}
            <div className="max-w-4xl mx-auto p-4 md:p-0 md:flex md:justify-between gap-8">
                <div className="h-8 w-44 rounded-xl bg-slate-100" />
            </div>

            <div className="max-w-4xl mx-auto p-4 md:px-0 md:flex md:justify-between gap-8">
                {/* Ingredients list */}
                <div className="flex-1">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={`ing-sk-${i}`}
                                className="flex items-start justify-between px-4 py-3 border-b border-slate-200 last:border-b-0"
                            >
                                <div className="h-5 w-48 rounded-xl bg-slate-100" />
                                <div className="h-5 w-20 rounded-xl bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Side meta box */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 self-start md:mt-0 mt-6 shadow-sm w-full md:w-48">
                    <div className="h-5 w-32 rounded-xl bg-slate-100" />
                    <div className="mt-3 h-5 w-28 rounded-xl bg-slate-100" />
                    <div className="mt-3 h-5 w-24 rounded-xl bg-slate-100" />
                </div>
            </div>

            {/* Steps header */}
            <div className="max-w-4xl mx-auto p-4 md:px-0 md:flex md:justify-between gap-8">
                <div className="h-8 w-52 rounded-xl bg-slate-100" />
            </div>

            {/* Steps skeleton */}
            <div className="max-w-4xl mx-auto px-4 md:px-0 pb-6">
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={`step-sk-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="h-6 w-2/3 rounded-xl bg-slate-100" />
                            <div className="mt-3 h-4 w-full rounded-xl bg-slate-100" />
                            <div className="mt-2 h-4 w-5/6 rounded-xl bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Comments skeleton */}
            <div className="max-w-4xl mx-auto p-4 md:px-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="h-5 w-2/3 rounded-xl bg-slate-100" />
                    <div className="mt-3 h-10 w-32 rounded-full bg-slate-100" />
                </div>
            </div>
        </div>
    );
};

const RecipeDetailClient: React.FC<Props> = ({ id }) => {
    const router = useRouter();

    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [recipeRaw, loading] = useRecipe(id);
    const recipe = recipeRaw as RecipeForDetail | null;

    const creatorDoc = useUserData(recipe?.userId || '');

    const currentUid = auth.currentUser?.uid ?? '';
    const isLoggedIn = Boolean(currentUid);
    const isOwner = Boolean(recipe && currentUid && recipe.userId === currentUid);

    const goLogin = useCallback(() => {
        const next = window.location.pathname + window.location.search;
        router.push(`/login?next=${encodeURIComponent(next)}`);
    }, [router]);

    const requireAuth = useCallback(
        (fn: () => void) => {
            if (!isLoggedIn) {
                goLogin();
                return;
            }
            fn();
        },
        [isLoggedIn, goLogin],
    );

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

    // ✅ skeleton instead of "Laster…"
    if (loading) return <RecipeDetailSkeleton />;
    if (!recipe) return <div className="p-4">Oppskrift ikke funnet.</div>;

    const userName = creatorDoc?.name || 'Ukjent brukernavn';
    const userPhoto = creatorDoc?.photoURL || '';

    const handleDelete = async () => {
        if (!isOwner) return;

        try {
            setDeleting(true);
            await deleteDoc(doc(firestore, 'recipes', recipe.id));
            router.replace(`/user/${currentUid}`);
        } catch (err) {
            console.error('Error deleting recipe:', err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="pb-20">
            <div className="max-w-4xl md:mx-auto m-4 rounded-2xl">
                {/* Top bar */}
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={() => router.back()}
                        className="mb-4 px-4 py-2 rounded-full brown-button hover:cursor-pointer flex items-center gap-2"
                        type="button"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Tilbake
                    </button>
                </div>

                {/* Header */}
                <div className="overflow-hidden">
                    {recipe.coverImage && (
                        <div className="relative w-full aspect-square md:aspect-[16/9]">
                            <Image
                                src={recipe.coverImage}
                                alt={`${recipe.title} cover`}
                                fill
                                className="object-cover rounded-2xl"
                                priority
                                sizes="(max-width: 768px) 100vw, 896px"
                                quality={70}
                            />
                        </div>
                    )}

                    <div className="mt-6">
                        <div className="md:flex items-center justify-between">
                            {/* Add to collection -> require login */}
                            <button
                                onClick={() => requireAuth(() => setShowAddModal(true))}
                                className="mb-4 px-4 py-2 rounded-full brown-button hover:cursor-pointer flex items-center gap-2"
                                type="button"
                            >
                                <span className="material-symbols-outlined">bookmark_add</span>
                                Legg til i samling
                            </button>

                            {isOwner && (
                                <div className="mb-4 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/recipe/edit/${recipe.id}`)}
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
                        {recipe.description && <p className="text-base md:text-lg text-neutral-600">{recipe.description}</p>}
                    </div>

                    {Array.isArray(recipe.tags) && recipe.tags.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {recipe.tags.map((t) => (
                                <span
                                    key={t}
                                    className="inline-flex items-center rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs"
                                >
                  #{t}
                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Creator */}
            <div
                className="flex space-x-2 items-center max-w-4xl mx-auto px-4 md:px-0 py-2 cursor-pointer"
                onClick={() => router.push(`/user/${recipe.userId}`)}
            >
                <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-100">
                    {userPhoto ? <img src={userPhoto} alt="Creator" className="w-full h-full object-cover" /> : null}
                </div>
                <h1 className="text-xl font-medium text-slate-900">{userName}</h1>
            </div>

            {/* Like + Rating */}
            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between gap-8">
                <LikeButton
                    recipeId={recipe.id}
                    onRequireLogin={() => {
                        const next = window.location.pathname + window.location.search;
                        router.push(`/login?next=${encodeURIComponent(next)}`);
                    }}
                />

                <div className="mt-4 md:mt-0">
                    <RatingStars recipeId={recipe.id} />
                </div>
            </div>

            {/* Ingredients */}
            <div className="max-w-4xl mx-auto p-4 md:p-0 md:flex md:justify-between gap-8">
                <h2 className="text-2xl font-semibold">Ingredienser</h2>
            </div>

            <div className="max-w-4xl mx-auto p-4 md:px-0 md:flex md:justify-between gap-8">
                <div className="flex-1">
                    {ingredientsToRender.length > 0 && (
                        <ul className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            {ingredientsToRender.map((ing, idx) => (
                                <li
                                    key={`ing-${idx}`}
                                    className="flex items-start justify-between px-4 py-3 border-b border-slate-200 last:border-b-0"
                                >
                                    <div className="flex-1">
                                        <span className="font-semibold">{ing.name}</span>
                                    </div>
                                    {ing.amount ? <span className="shrink-0 text-neutral-600">{ing.amount}</span> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {(recipe.portions || recipe.temperature || recipe.cookingTime) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 self-start md:mt-0 mt-6 shadow-sm w-full md:w-48">
                        {recipe.portions && (
                            <p className="text-neutral-800">
                                <span className="font-semibold">Porsjoner:</span> {recipe.portions}
                            </p>
                        )}

                        {recipe.temperature && (
                            <p className={`text-neutral-800 ${recipe.portions ? 'mt-2' : ''}`}>
                                <span className="font-semibold">Temperatur:</span> {recipe.temperature}
                            </p>
                        )}

                        {recipe.cookingTime && (
                            <p className={`text-neutral-800 ${recipe.portions || recipe.temperature ? 'mt-2' : ''}`}>
                                <span className="font-semibold">Koketid:</span> {recipe.cookingTime}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Steps */}
            <div className="max-w-4xl mx-auto p-4 md:px-0 md:flex md:justify-between gap-8">
                <h2 className="text-2xl font-semibold">Fremgangsmåte</h2>
            </div>

            <div className="max-w-4xl mx-auto px-4 md:px-0 pb-6">
                <div className="space-y-4">
                    {recipe.cookingSteps.map((step, i) => (
                        <div key={`step-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <h3 className="md:text-xl text-base">
                                {i + 1}. {step.title}
                            </h3>
                            <p className="text-sm mt-2">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Comments */}
            <div className="max-w-4xl mx-auto p-4 md:px-0">
                {isLoggedIn ? (
                    <CommentSection recipeId={recipe.id} />
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-slate-700">Logg inn for å lese og skrive kommentarer.</p>
                        <button
                            type="button"
                            onClick={goLogin}
                            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 brown-button transition"
                        >
                            <span className="material-symbols-outlined">login</span>
                            Logg inn
                        </button>
                    </div>
                )}
            </div>

            {showAddModal && <AddToCollectionModal recipeId={recipe.id} onClose={() => setShowAddModal(false)} />}

            {showDeleteConfirm && (
                <AppModal onClose={() => setShowDeleteConfirm(false)}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-slate-900">Slette oppskriften?</h2>
                            <p className="text-slate-600 mt-2">Dette kan ikke angres.</p>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="px-4 py-2 rounded-full hover:bg-neutral-200 cursor-pointer"
                                    disabled={deleting || closing}
                                >
                                    Avbryt
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await handleDelete();
                                        closeWithAnim();
                                    }}
                                    className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 cursor-pointer"
                                    disabled={deleting || closing}
                                >
                                    {deleting ? 'Sletter…' : 'Slett'}
                                </button>
                            </div>
                        </div>
                    )}
                </AppModal>
            )}
        </div>
    );
};

export default RecipeDetailClient;