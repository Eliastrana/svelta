'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CookingStep } from '@/app/types/CookingStep';

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

const makeId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function SortableStepCard(props: {
    step: StepWithId;
    index: number;
    onChange: (id: string, field: 'title' | 'description', value: string) => void;
    onRemove: (id: string) => void;
}) {
    const { step, index, onChange, onRemove } = props;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: step.id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-2xl border border-slate-200 p-3 bg-white ${
                isDragging ? 'shadow-lg ring-2 ring-slate-200' : ''
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        {/* Drag handle */}
                        <button
                            type="button"
                            className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
                            aria-label="Dra for å flytte steg"
                            {...attributes}
                            {...listeners}
                        >
                            <span className="material-symbols-outlined text-slate-600">drag_indicator</span>
                        </button>

                        <label className="block text-sm font-semibold text-slate-900">
                            Steg {index + 1} – tittel
                        </label>
                    </div>

                    <input
                        type="text"
                        placeholder="f.eks. Forvarm ovnen"
                        value={step.title}
                        onChange={(e) => onChange(step.id, 'title', e.target.value)}
                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        required
                    />

                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-2">
                        Beskrivelse
                    </label>
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

const CreateRecipe = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [svgData, setSvgData] = useState('');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [fontStyle, setFontStyle] = useState('sans-serif');

    const [cookingSteps, setCookingSteps] = useState<StepWithId[]>([]);

    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

    const [ingredients, setIngredients] = useState<string[]>([]);
    const [newIngredient, setNewIngredient] = useState('');
    const [temperature, setTemperature] = useState('');
    const [cookingTime, setCookingTime] = useState('');

    const router = useRouter();

    // Load draft from localStorage
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
            newIngredient?: string;
            temperature?: string;
            cookingTime?: string;
            coverImagePreview?: string | null;
        } = JSON.parse(savedData);

        setTitle(formData.title || '');
        setDescription(formData.description || '');
        setSvgData(formData.svgData || '');
        setBgColor(formData.bgColor || '#ffffff');
        setFontStyle(formData.fontStyle || 'sans-serif');
        setIngredients(formData.ingredients || []);
        setNewIngredient(formData.newIngredient || '');
        setTemperature(formData.temperature || '');
        setCookingTime(formData.cookingTime || '');
        setCoverImagePreview(formData.coverImagePreview || null);

        const loadedSteps = formData.cookingSteps || [];
        setCookingSteps(loadedSteps.map((s) => ('id' in s ? s : { ...s, id: makeId() })));
    }, []);

    // Persist draft to localStorage
    useEffect(() => {
        const formData = {
            title,
            description,
            svgData,
            bgColor,
            fontStyle,
            cookingSteps,
            ingredients,
            newIngredient,
            temperature,
            cookingTime,
            coverImagePreview,
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
        newIngredient,
        temperature,
        cookingTime,
        coverImagePreview,
    ]);

    // Steps handlers
    const handleAddStep = () => {
        setCookingSteps((prev) => [...prev, { id: makeId(), title: '', description: '' }]);
    };

    const handleStepChange = (id: string, field: 'title' | 'description', value: string) => {
        setCookingSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    };

    const handleRemoveStep = (id: string) => {
        setCookingSteps((prev) => prev.filter((s) => s.id !== id));
    };

    // Ingredients handlers
    const handleAddIngredient = () => {
        if (newIngredient.trim()) {
            setIngredients((prev) => [...prev, newIngredient.trim()]);
            setNewIngredient('');
        }
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredients((prev) => prev.filter((_, idx) => idx !== index));
    };

    // Cover image
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

    // DnD sensors + handler
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setCookingSteps((prev) => {
            const oldIndex = prev.findIndex((s) => s.id === active.id);
            const newIndex = prev.findIndex((s) => s.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    const trimmedTitle = useMemo(() => title.trim(), [title]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) return alert('Please sign in first.');
        if (!trimmedTitle) return;

        let coverImageUrl = '';
        if (coverImageFile) {
            const imageRef = ref(storage, `recipe-covers/${user.uid}-${Date.now()}-${coverImageFile.name}`);
            const snapshot = await uploadBytes(imageRef, coverImageFile);
            coverImageUrl = await getDownloadURL(snapshot.ref);
        }

        // store steps without ids
        const stepsForDb: CookingStep[] = cookingSteps.map((s) => ({
            title: s.title,
            description: s.description,
        }));

        try {
            await addDoc(collection(firestore, 'recipes'), {
                title,
                description,
                image: svgData,
                bgColor,
                fontStyle,
                cookingSteps: stepsForDb,
                ingredients,
                temperature,
                cookingTime,
                userId: user.uid,
                createdAt: serverTimestamp(),
                coverImage: coverImageUrl,
                likeCount: 0,
                commentCount: 0,
            });

            localStorage.removeItem(LOCAL_STORAGE_KEY);
            router.push('/');
        } catch (error) {
            console.error('Error adding recipe:', error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
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
                        className="h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition"
                    >
                        Publiser
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

                        <label className="block text-sm font-semibold text-slate-900 mt-4 mb-2">
                            Beskrivelse
                        </label>
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
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <h2 className="text-base font-semibold text-slate-900 mb-3">Ingredienser</h2>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Legg til ingrediens..."
                                value={newIngredient}
                                onChange={(e) => setNewIngredient(e.target.value)}
                                className="flex-1 p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddIngredient();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAddIngredient}
                                className="px-4 rounded-2xl bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition"
                            >
                                Legg til
                            </button>
                        </div>

                        {ingredients.length > 0 && (
                            <ul className="mt-4 space-y-2">
                                {ingredients.map((ing, idx) => (
                                    <li
                                        key={idx}
                                        className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2"
                                    >
                                        <span className="text-slate-800">{ing}</span>
                                        <button type="button" onClick={() => handleRemoveIngredient(idx)}>
                                            <span className="material-symbols-outlined text-slate-600">delete</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
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
                        </div>
                    </div>

                    {/* Steps with drag & drop */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold text-slate-900">Steg</h2>
                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition"
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                Legg til
                            </button>
                        </div>

                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                        </DndContext>
                    </div>

                    {/* Bottom publish (nice on mobile) */}
                    <div className="sm:hidden pt-2">
                        <button
                            type="submit"
                            className="w-full rounded-full py-3 font-semibold text-white shadow-lg bg-slate-900 hover:opacity-95 active:scale-[0.99] transition"
                        >
                            Publiser
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateRecipe;
