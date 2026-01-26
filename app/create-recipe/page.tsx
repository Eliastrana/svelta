'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CookingStep } from '@/app/types/CookingStep';

import RecipeCreatedModal from '@/app/components/RecipeCreatedModal';

import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const LOCAL_STORAGE_KEY = 'createRecipeForm';

type StepWithId = CookingStep & { id: string };

type Ingredient = { name: string; amount: string };
type IngredientWithId = Ingredient & { id: string };

const makeId = (prefix: 'step' | 'ing'): string => {
    const base =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${base}`;
};

function SortableStepCard(props: {
    step: StepWithId;
    index: number;
    onChange: (id: string, field: 'title' | 'description', value: string) => void;
    onRemove: (id: string) => void;
}) {
    const { step, index, onChange, onRemove } = props;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: step.id,
        data: { type: 'step' as const },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-2xl border border-slate-200 p-3 bg-white ${isDragging ? 'shadow-lg ring-2 ring-slate-200' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            type="button"
                            className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
                            aria-label="Dra for å flytte steg"
                            {...attributes}
                            {...listeners}
                        >
                            <span className="material-symbols-outlined text-slate-600">drag_indicator</span>
                        </button>

                        <label className="block text-sm font-semibold text-slate-900">Steg {index + 1} – tittel</label>
                    </div>

                    <input
                        type="text"
                        placeholder="f.eks. Forvarm ovnen"
                        value={step.title}
                        onChange={(e) => onChange(step.id, 'title', e.target.value)}
                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        required
                    />

                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-2">Beskrivelse</label>
                    <textarea
                        placeholder="Hva gjør man her?"
                        value={step.description}
                        onChange={(e) => onChange(step.id, 'description', e.target.value)}
                        className="w-full min-h-[90px] p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        required
                    />
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(step.id)}
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition"
                    aria-label="Slett steg"
                >
                    <span className="material-symbols-outlined text-slate-600">delete</span>
                </button>
            </div>
        </div>
    );
}

function SortableIngredientCard(props: {
    item: IngredientWithId;
    index: number;
    onChange: (id: string, field: 'name' | 'amount', value: string) => void;
    onRemove: (id: string) => void;
}) {
    const { item, index, onChange, onRemove } = props;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        data: { type: 'ingredient' as const },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-2xl border border-slate-200 bg-white px-3 py-2 ${isDragging ? 'shadow-lg ring-2 ring-slate-200' : ''}`}
        >
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
                    aria-label={`Dra for å flytte ingrediens ${index + 1}`}
                    {...attributes}
                    {...listeners}
                >
                    <span className="material-symbols-outlined text-slate-600">drag_indicator</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                    <input
                        type="text"
                        placeholder="Mengde (f.eks. 2 ss / 150 g)"
                        value={item.amount}
                        onChange={(e) => onChange(item.id, 'amount', e.target.value)}
                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:col-span-1"
                    />
                    <input
                        type="text"
                        placeholder="Ingrediens (f.eks. sukker)"
                        value={item.name}
                        onChange={(e) => onChange(item.id, 'name', e.target.value)}
                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:col-span-2"
                    />
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition"
                    aria-label="Slett ingrediens"
                >
                    <span className="material-symbols-outlined text-slate-600">delete</span>
                </button>
            </div>
        </div>
    );
}

const CreateRecipe = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [svgData, setSvgData] = useState('');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [fontStyle, setFontStyle] = useState('sans-serif');

    const [cookingSteps, setCookingSteps] = useState<StepWithId[]>([]);

    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

    const [ingredients, setIngredients] = useState<IngredientWithId[]>([]);
    const [newIngredientName, setNewIngredientName] = useState('');
    const [newIngredientAmount, setNewIngredientAmount] = useState('');

    const [temperature, setTemperature] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [portions, setPortions] = useState('');

    const [publishing, setPublishing] = useState(false);

    const router = useRouter();

    // ✅ success modal state
    const [createdRecipeId, setCreatedRecipeId] = useState<string>('');

    // Load draft
    useEffect(() => {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!savedData) return;

        const formData: {
            title?: string;
            description?: string;
            svgData?: string;
            bgColor?: string;
            fontStyle?: string;
            cookingSteps?: Array<CookingStep | StepWithId>;
            ingredients?: string[];
            ingredientsDetailed?: Array<Ingredient | IngredientWithId>;
            newIngredientName?: string;
            newIngredientAmount?: string;
            temperature?: string;
            cookingTime?: string;
            portions?: string;
            coverImagePreview?: string | null;
            tags?: string[];
        } = JSON.parse(savedData);

        setTitle(formData.title || '');
        setDescription(formData.description || '');
        setSvgData(formData.svgData || '');
        setBgColor(formData.bgColor || '#ffffff');
        setFontStyle(formData.fontStyle || 'sans-serif');
        setTemperature(formData.temperature || '');
        setCookingTime(formData.cookingTime || '');
        setPortions(formData.portions || '');
        setCoverImagePreview(formData.coverImagePreview || null);

        const loadedSteps = formData.cookingSteps || [];
        setCookingSteps(
            loadedSteps.map((s) => ('id' in s ? (s as StepWithId) : { ...(s as CookingStep), id: makeId('step') })),
        );

        const detailed = formData.ingredientsDetailed || [];
        if (detailed.length > 0) {
            setIngredients(detailed.map((i) => ('id' in i ? (i as IngredientWithId) : { ...(i as Ingredient), id: makeId('ing') })));
        } else {
            const old = formData.ingredients || [];
            setIngredients(old.map((name) => ({ id: makeId('ing'), name, amount: '' })));
        }

        setNewIngredientName(formData.newIngredientName || '');
        setNewIngredientAmount(formData.newIngredientAmount || '');
        setTags(Array.isArray(formData.tags) ? formData.tags : []);
    }, []);

    // Persist draft
    useEffect(() => {
        const formData = {
            title,
            description,
            svgData,
            bgColor,
            fontStyle,
            cookingSteps,
            ingredients: ingredients
                .map((i) => `${(i.amount || '').trim()} ${(i.name || '').trim()}`.trim())
                .filter(Boolean),
            ingredientsDetailed: ingredients,
            newIngredientName,
            newIngredientAmount,
            temperature,
            cookingTime,
            portions,
            coverImagePreview,
            tags,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
    }, [
        title,
        description,
        svgData,
        bgColor,
        fontStyle,
        cookingSteps,
        ingredients,
        newIngredientName,
        newIngredientAmount,
        temperature,
        cookingTime,
        portions,
        coverImagePreview,
    ]);

    const handleAddStep = () => {
        setCookingSteps((prev) => [...prev, { id: makeId('step'), title: '', description: '' }]);
    };

    const handleStepChange = (id: string, field: 'title' | 'description', value: string) => {
        setCookingSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    };

    const handleRemoveStep = (id: string) => {
        setCookingSteps((prev) => prev.filter((s) => s.id !== id));
    };

    const handleAddIngredient = () => {
        const name = newIngredientName.trim();
        const amount = newIngredientAmount.trim();
        if (!name) return;

        setIngredients((prev) => [...prev, { id: makeId('ing'), name, amount }]);
        setNewIngredientName('');
        setNewIngredientAmount('');
    };

    const handleIngredientChange = (id: string, field: 'name' | 'amount', value: string) => {
        setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    };

    const handleRemoveIngredient = (id: string) => {
        setIngredients((prev) => prev.filter((i) => i.id !== id));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCoverImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setCoverImagePreview(previewUrl);
    };

    useEffect(() => {
        return () => {
            if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
        };
    }, [coverImagePreview]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeType = active.data.current?.type as 'step' | 'ingredient' | undefined;
        const overType = over.data.current?.type as 'step' | 'ingredient' | undefined;
        if (!activeType || !overType || activeType !== overType) return;

        if (activeType === 'step') {
            setCookingSteps((prev) => {
                const oldIndex = prev.findIndex((s) => s.id === active.id);
                const newIndex = prev.findIndex((s) => s.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return arrayMove(prev, oldIndex, newIndex);
            });
            return;
        }

        if (activeType === 'ingredient') {
            setIngredients((prev) => {
                const oldIndex = prev.findIndex((i) => i.id === active.id);
                const newIndex = prev.findIndex((i) => i.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    };

    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [generatingTags, setGeneratingTags] = useState(false);

    const addTag = (value: string) => {
        const t = value.trim();
        if (!t) return;
        setTags((prev) => {
            const exists = prev.some((x) => x.toLowerCase() === t.toLowerCase());
            if (exists) return prev;
            return [...prev, t].slice(0, 12);
        });
        setNewTag('');
    };

    const removeTag = (t: string) => {
        setTags((prev) => prev.filter((x) => x !== t));
    };

    const generateTags = async () => {
        if (generatingTags) return;

        try {
            setGeneratingTags(true);

            const payload = {
                title,
                description,
                ingredientsDetailed: ingredients.map((i) => ({
                    name: i.name.trim(),
                    amount: i.amount.trim(),
                })),
                cookingSteps: cookingSteps.map((s) => ({
                    title: s.title.trim(),
                    description: s.description.trim(),
                })),
            };

            const res = await fetch('/api/generate-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = (await res.json()) as { tags?: string[]; error?: string };

            if (!res.ok) {
                throw new Error(data.error || 'Kunne ikke generere tags.');
            }

            if (Array.isArray(data.tags)) {
                setTags(data.tags);
            }
        } catch (e) {
            console.error(e);
            alert('Kunne ikke generere tags.');
        } finally {
            setGeneratingTags(false);
        }
    };


    const trimmedTitle = useMemo(() => title.trim(), [title]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (publishing) return; // ✅ blokker dobbeltklikk / dobbel submit

        const user = auth.currentUser;
        if (!user) return alert('Please sign in first.');
        if (!trimmedTitle) return;

        setPublishing(true);

        try {
            let coverImageUrl = '';
            if (coverImageFile) {
                const imageRef = ref(storage, `recipe-covers/${user.uid}-${Date.now()}-${coverImageFile.name}`);
                const snapshot = await uploadBytes(imageRef, coverImageFile);
                coverImageUrl = await getDownloadURL(snapshot.ref);
            }

            const stepsForDb: CookingStep[] = cookingSteps.map((s) => ({
                title: s.title,
                description: s.description,
            }));

            const ingredientsDetailedForDb: Ingredient[] = ingredients
                .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() }))
                .filter((i) => i.name.length > 0);

            const ingredientsStringsForDb: string[] = ingredientsDetailedForDb
                .map((i) => `${i.amount} ${i.name}`.trim())
                .filter(Boolean);

            const docRef = await addDoc(collection(firestore, 'recipes'), {
                title,
                description,
                image: svgData,
                bgColor,
                fontStyle,
                cookingSteps: stepsForDb,
                ingredients: ingredientsStringsForDb,
                ingredientsDetailed: ingredientsDetailedForDb,
                temperature,
                cookingTime,
                portions,
                userId: user.uid,
                createdAt: serverTimestamp(),
                coverImage: coverImageUrl,
                likeCount: 0,
                commentCount: 0,
                tags,
            });

            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setCreatedRecipeId(docRef.id);
        } catch (error) {
            console.error('Error adding recipe:', error);
            setPublishing(false); // ✅ bare re-enable hvis det feiler
        }
    };

    return (
        <div className="min-h-screen ">
            {/* ✅ Success modal */}
            {createdRecipeId ? (
                <RecipeCreatedModal
                    recipeId={createdRecipeId}
                    onClose={() => {
                        // after closing, go to the recipe page
                        router.push(`/recipe/${createdRecipeId}`);
                    }}
                />
            ) : null}

            {/* Top bar */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
                <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100"
                        aria-label="Tilbake"
                        type="button"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>

                    <h1 className="text-lg font-semibold text-slate-900">Lag oppskrift</h1>

                    <button
                        type="submit"
                        form="create-recipe-form"
                        disabled={publishing}
                        className={[
                            'h-10 px-4 rounded-full brown-button text-sm font-semibold shadow-sm transition',
                            publishing ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95 active:scale-[0.99]',
                        ].join(' ')}
                    >
    <span className="inline-flex items-center gap-2">
        {publishing ? (
            <span
                className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin"
                aria-hidden="true"
            />
        ) : null}
        {publishing ? 'Publiserer…' : 'Publiser'}
    </span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-xl px-4 py-6 pb-28">
                <form id="create-recipe-form" onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic info */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Tittel</label>
                        <input
                            type="text"
                            placeholder="f.eks. Verdens beste lasagne"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
                        />

                        <label className="block text-sm font-semibold text-slate-900 mt-4 mb-2">Beskrivelse</label>
                        <textarea
                            placeholder="Kort og fristende…"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full min-h-[120px] p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
                        />
                    </div>

                    {/* Cover image */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-base font-semibold text-slate-900">Forsidebilde</h2>
                            {coverImagePreview && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCoverImageFile(null);
                                        setCoverImagePreview(null);
                                    }}
                                    className="text-sm text-slate-600 hover:underline"
                                >
                                    Fjern
                                </button>
                            )}
                        </div>

                        <label className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
                            <span className="material-symbols-outlined text-slate-700">upload</span>
                            <p className="mt-2 text-sm text-slate-600">Klikk eller dra og slipp bildet ditt her</p>
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>

                        {coverImagePreview && (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                <img src={coverImagePreview} alt="Image Preview" className="w-full max-h-72 object-cover" />
                            </div>
                        )}
                    </div>

                    {/* Ingredients + meta */}
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold text-slate-900">Ingredienser</h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    placeholder="Mengde (f.eks. 2 ss)"
                                    value={newIngredientAmount}
                                    onChange={(e) => setNewIngredientAmount(e.target.value)}
                                    className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.preventDefault();
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Ingrediens (f.eks. sukker)"
                                    value={newIngredientName}
                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                    className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:col-span-2"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddIngredient();
                                        }
                                    }}
                                />
                            </div>

                            {ingredients.length > 0 ? (
                                <SortableContext items={ingredients.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                    <div className="mt-4 space-y-2">
                                        {ingredients.map((item, index) => (
                                            <SortableIngredientCard
                                                key={item.id}
                                                item={item}
                                                index={index}
                                                onChange={handleIngredientChange}
                                                onRemove={handleRemoveIngredient}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            ) : (
                                <p className="text-slate-600 mt-4">Ingen ingredienser ennå — legg til over, og dra for å sortere.</p>
                            )}

                            <button
                                type="button"
                                onClick={handleAddIngredient}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition disabled:opacity-50 mt-2"
                                disabled={!newIngredientName.trim()}
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                Legg til
                            </button>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">Temperatur</label>
                                    <input
                                        type="text"
                                        placeholder="f.eks. 200°C"
                                        value={temperature}
                                        onChange={(e) => setTemperature(e.target.value)}
                                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">Koketid</label>
                                    <input
                                        type="text"
                                        placeholder="f.eks. 45 minutter"
                                        value={cookingTime}
                                        onChange={(e) => setCookingTime(e.target.value)}
                                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">Porsjoner</label>
                                    <input
                                        type="text"
                                        placeholder="f.eks. 4"
                                        value={portions}
                                        onChange={(e) => setPortions(e.target.value)}
                                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold text-slate-900">Steg</h2>
                            </div>

                            <SortableContext items={cookingSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-3">
                                    {cookingSteps.map((step, index) => (
                                        <SortableStepCard
                                            key={step.id}
                                            step={step}
                                            index={index}
                                            onChange={handleStepChange}
                                            onRemove={handleRemoveStep}
                                        />
                                    ))}

                                    {cookingSteps.length === 0 && (
                                        <p className="text-slate-600">
                                            Ingen steg ennå — trykk <span className="font-semibold">Legg til</span>.
                                        </p>
                                    )}
                                </div>
                            </SortableContext>

                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition mt-2"
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                Legg til
                            </button>
                        </div>
                    </DndContext>

                    {/* Tags */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h2 className="text-base font-semibold text-slate-900">Tags</h2>

                            <button
                                type="button"
                                onClick={generateTags}
                                disabled={generatingTags}
                                className={[
                                    'inline-flex items-center gap-2 px-3 py-2 rounded-full font-semibold transition',
                                    generatingTags
                                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                        : 'brown-button hover:opacity-95 active:scale-[0.99]',
                                ].join(' ')}
                            >
                                {generatingTags ? (
                                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-base"></span>
                                )}
                                {generatingTags ? 'Genererer…' : 'Generer tags'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                placeholder="Legg til tag (f.eks. middag)"
                                className="flex-1 p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(newTag);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => addTag(newTag)}
                                disabled={!newTag.trim()}
                                className="px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                            >
                                Legg til
                            </button>
                        </div>

                        {tags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {tags.map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => removeTag(t)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold transition"
                                        aria-label={`Fjern tag ${t}`}
                                        title="Klikk for å fjerne"
                                    >
                                        #{t}
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-slate-600">Ingen tags ennå.</p>
                        )}
                    </div>


                    {/* Bottom publish */}
                    <div className="sm:hidden pt-2">
                        <button
                            type="submit"
                            disabled={publishing}
                            className={[
                                'w-full rounded-full py-3 font-semibold shadow-lg brown-button transition',
                                publishing ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95 active:scale-[0.99]',
                            ].join(' ')}
                        >
    <span className="inline-flex items-center justify-center gap-2">
        {publishing ? (
            <span
                className="inline-block h-5 w-5 rounded-full border-2 border-white/60 border-t-white animate-spin"
                aria-hidden="true"
            />
        ) : null}
        {publishing ? 'Publiserer…' : 'Publiser'}
    </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRecipe;