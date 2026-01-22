'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RecipeData } from '@/app/types/RecipeData';
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

type StepWithId = CookingStep & { id: string };

type IngredientItem = {
    id: string;
    name: string;
    amount: string;
};

type RecipeDoc = RecipeData & {
    // ny struktur (kan mangle i eldre docs)
    ingredientsDetailed?: IngredientItem[];
    portions?: string;
};

type DraftPayload = {
    recipeData?: RecipeData;
    // legacy (gammel)
    ingredients?: string[];
    // ny
    ingredientsDetailed?: IngredientItem[];

    portions?: string;
    temperature?: string;
    cookingTime?: string;

    cookingSteps?: StepWithId[];
    newIngredientName?: string;
    newIngredientAmount?: string;

    // NB: blob:-preview funker ikke etter reload, så vi ignorerer den ved hydration
    coverImagePreview?: string | null;
};

const makeId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function normalizeIngredientName(s: string): string {
    return s.trim();
}

function normalizeIngredientAmount(s: string): string {
    return s.trim();
}

function toIngredientItemsFromStrings(list: string[]): IngredientItem[] {
    return list
        .map((name) => normalizeIngredientName(name))
        .filter(Boolean)
        .map((name) => ({ id: makeId(), name, amount: '' }));
}

function isMeaningfulDraft(draft: DraftPayload): boolean {
    const title = draft.recipeData?.title?.trim() ?? '';
    const desc = draft.recipeData?.description?.trim() ?? '';

    const ingredientsDetailed =
        draft.ingredientsDetailed ??
        (draft.ingredients ? toIngredientItemsFromStrings(draft.ingredients) : []) ??
        [];

    const steps =
        draft.cookingSteps ??
        (draft.recipeData?.cookingSteps ?? []).map((s) => ({ ...s, id: makeId() }));

    const temperature = (draft.temperature ?? draft.recipeData?.temperature ?? '').trim();
    const cookingTime = (draft.cookingTime ?? draft.recipeData?.cookingTime ?? '').trim();
    const portions = (draft.portions ?? draft.recipeData?.portions ?? '').trim();


    const coverPreview = draft.coverImagePreview ?? null;
    const usablePreview = coverPreview && !coverPreview.startsWith('blob:');

    return Boolean(
        title ||
        desc ||
        ingredientsDetailed.length > 0 ||
        steps.length > 0 ||
        temperature ||
        cookingTime ||
        portions ||
        usablePreview,
    );
}

function SortableStepCard(props: {
    step: StepWithId;
    index: number;
    onChange: (stepId: string, field: 'title' | 'description', value: string) => void;
    onRemove: (stepId: string) => void;
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
    item: IngredientItem;
    index: number;
    onChange: (id: string, field: 'name' | 'amount', value: string) => void;
    onRemove: (id: string) => void;
}) {
    const { item, index, onChange, onRemove } = props;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-2xl border border-slate-200 bg-white p-3 ${
                isDragging ? 'shadow-lg ring-2 ring-slate-200' : ''
            }`}
        >
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
                    aria-label="Dra for å flytte ingrediens"
                    {...attributes}
                    {...listeners}
                >
                    <span className="material-symbols-outlined text-slate-600">drag_indicator</span>
                </button>

                <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Ingrediens {index + 1}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            type="text"
                            placeholder="f.eks. Hvetemel"
                            value={item.name}
                            onChange={(e) => onChange(item.id, 'name', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Mengde (f.eks. 200 g)"
                            value={item.amount}
                            onChange={(e) => onChange(item.id, 'amount', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                    </div>
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

const EditRecipePage: React.FC = () => {
    const params = useParams();
    const recipeId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();

    const LOCAL_STORAGE_KEY = recipeId ? `editRecipeForm_${recipeId}` : 'editRecipeForm';

    const [loading, setLoading] = useState(true);
    const [draftChecked, setDraftChecked] = useState(false);
    const hasFetched = useRef(false);

    const [recipeData, setRecipeData] = useState<RecipeData>({
        title: '',
        description: '',
        image: '',
        bgColor: '#ffffff',
        fontStyle: 'sans-serif',
        cookingSteps: [],
        ingredients: [], // legacy
        temperature: '',
        cookingTime: '',
        coverImage: '',
    });

    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

    // NY: detailed ingredients
    const [ingredientsDetailed, setIngredientsDetailed] = useState<IngredientItem[]>([]);
    const [newIngredientName, setNewIngredientName] = useState('');
    const [newIngredientAmount, setNewIngredientAmount] = useState('');

    const [temperature, setTemperature] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [portions, setPortions] = useState('');

    const [cookingSteps, setCookingSteps] = useState<StepWithId[]>([]);

    const sensorsSteps = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const sensorsIngredients = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const onDragEndSteps = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setCookingSteps((prev) => {
            const oldIndex = prev.findIndex((s) => s.id === active.id);
            const newIndex = prev.findIndex((s) => s.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    const onDragEndIngredients = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setIngredientsDetailed((prev) => {
            const oldIndex = prev.findIndex((s) => s.id === active.id);
            const newIndex = prev.findIndex((s) => s.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    // 1) Sjekk localStorage først
    useEffect(() => {
        if (!recipeId) return;

        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) {
            setDraftChecked(true);
            return;
        }

        try {
            const draft = JSON.parse(raw) as DraftPayload;

            if (!isMeaningfulDraft(draft)) {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                setDraftChecked(true);
                return;
            }

            if (draft.recipeData) {
                setRecipeData(draft.recipeData);
            }

            // ingredients: prioriter detailed, ellers legacy
            if (draft.ingredientsDetailed && draft.ingredientsDetailed.length > 0) {
                setIngredientsDetailed(
                    draft.ingredientsDetailed.map((x) => ({
                        id: x.id || makeId(),
                        name: x.name ?? '',
                        amount: x.amount ?? '',
                    })),
                );
            } else if (draft.ingredients && draft.ingredients.length > 0) {
                setIngredientsDetailed(toIngredientItemsFromStrings(draft.ingredients));
            } else if (draft.recipeData?.ingredients && draft.recipeData.ingredients.length > 0) {
                setIngredientsDetailed(toIngredientItemsFromStrings(draft.recipeData.ingredients));
            }

            setTemperature(draft.temperature ?? draft.recipeData?.temperature ?? '');
            setCookingTime(draft.cookingTime ?? draft.recipeData?.cookingTime ?? '');
            setPortions(draft.portions ?? draft.recipeData?.portions ?? '');

            const loadedSteps = draft.cookingSteps ?? [];
            setCookingSteps(loadedSteps.map((s) => ({ ...s, id: s.id || makeId() })));

            setNewIngredientName(draft.newIngredientName ?? '');
            setNewIngredientAmount(draft.newIngredientAmount ?? '');

            const prev = draft.coverImagePreview ?? null;
            setCoverImagePreview(prev && !prev.startsWith('blob:') ? prev : null);

            setDraftChecked(true);
            setLoading(false);
        } catch {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setDraftChecked(true);
        }
    }, [recipeId, LOCAL_STORAGE_KEY]);

    // 2) Hent fra Firestore hvis vi ikke allerede har draft
    useEffect(() => {
        if (!recipeId) return;
        if (!draftChecked) return;
        if (hasFetched.current) return;

        const fetchRecipe = async () => {
            try {
                const recipeSnap = await getDoc(doc(firestore, 'recipes', recipeId));
                if (!recipeSnap.exists()) return;

                const data = recipeSnap.data() as RecipeDoc;

                const alreadyHasTitle = (recipeData.title ?? '').trim().length > 0;
                if (!alreadyHasTitle) {
                    setRecipeData(data);

                    // Ingredients: ny hvis finnes, ellers legacy
                    if (Array.isArray(data.ingredientsDetailed) && data.ingredientsDetailed.length > 0) {
                        setIngredientsDetailed(
                            data.ingredientsDetailed.map((x) => ({
                                id: x.id || makeId(),
                                name: x.name ?? '',
                                amount: x.amount ?? '',
                            })),
                        );
                    } else {
                        const legacy = data.ingredients ?? [];
                        setIngredientsDetailed(toIngredientItemsFromStrings(legacy));
                    }

                    setTemperature(data.temperature ?? '');
                    setCookingTime(data.cookingTime ?? '');
                    setPortions(data.portions ?? '');

                    const steps = (data.cookingSteps ?? []).map((s) => ({ ...s, id: makeId() }));
                    setCookingSteps(steps);

                    setCoverImagePreview(null);
                }
            } finally {
                setLoading(false);
                hasFetched.current = true;
            }
        };

        void fetchRecipe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipeId, draftChecked]);

    // cleanup blob preview
    useEffect(() => {
        return () => {
            if (coverImagePreview && coverImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(coverImagePreview);
            }
        };
    }, [coverImagePreview]);

    // Persist draft (ikke lagre blob preview)
    useEffect(() => {
        if (!recipeId) return;
        if (!draftChecked) return;

        const payload: DraftPayload = {
            recipeData: {
                ...recipeData,
                ingredients: ingredientsDetailed.map((x) => x.name).filter(Boolean),
                temperature,
                cookingTime,
                cookingSteps: cookingSteps.map((s) => ({
                    title: s.title,
                    description: s.description,
                })),
            },
            ingredientsDetailed,
            ingredients: ingredientsDetailed.map((x) => x.name).filter(Boolean),

            portions,
            temperature,
            cookingTime,

            cookingSteps,
            newIngredientName,
            newIngredientAmount,
            coverImagePreview: null,
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    }, [
        recipeId,
        LOCAL_STORAGE_KEY,
        draftChecked,
        recipeData,
        ingredientsDetailed,
        temperature,
        cookingTime,
        cookingSteps,
        portions,
        newIngredientName,
        newIngredientAmount,
    ]);

    const setTitle = (v: string) => setRecipeData((p) => ({ ...p, title: v }));
    const setDescription = (v: string) => setRecipeData((p) => ({ ...p, description: v }));

    const handleAddIngredient = () => {
        const name = normalizeIngredientName(newIngredientName);
        const amount = normalizeIngredientAmount(newIngredientAmount);
        if (!name) return;

        setIngredientsDetailed((prev) => [...prev, { id: makeId(), name, amount }]);
        setNewIngredientName('');
        setNewIngredientAmount('');
    };

    const handleIngredientChange = (id: string, field: 'name' | 'amount', value: string) => {
        setIngredientsDetailed((prev) =>
            prev.map((x) => (x.id === id ? { ...x, [field]: value } : x)),
        );
    };

    const handleRemoveIngredient = (id: string) => {
        setIngredientsDetailed((prev) => prev.filter((x) => x.id !== id));
    };

    const handleAddStep = () => {
        setCookingSteps((prev) => [...prev, { id: makeId(), title: '', description: '' }]);
    };

    const handleStepChange = (stepId: string, field: 'title' | 'description', value: string) => {
        setCookingSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)));
    };

    const handleRemoveStep = (stepId: string) => {
        setCookingSteps((prev) => prev.filter((s) => s.id !== stepId));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCoverImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setCoverImagePreview(previewUrl);
    };

    const trimmedTitle = useMemo(() => (recipeData.title ?? '').trim(), [recipeData.title]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) return alert('Please sign in first.');
        if (!recipeId) return;
        if (!trimmedTitle) return;

        let coverImageUrl = recipeData.coverImage || '';

        if (coverImageFile) {
            const imageRef = ref(storage, `recipe-covers/${user.uid}-${Date.now()}-${coverImageFile.name}`);
            const snapshot = await uploadBytes(imageRef, coverImageFile);
            coverImageUrl = await getDownloadURL(snapshot.ref);
        }

        const stepsForDb: CookingStep[] = cookingSteps.map((s) => ({
            title: s.title,
            description: s.description,
        }));

        const ingredientsForDb = ingredientsDetailed
            .map((x) => ({
                id: x.id,
                name: normalizeIngredientName(x.name),
                amount: normalizeIngredientAmount(x.amount),
            }))
            .filter((x) => x.name.length > 0);

        try {
            await updateDoc(doc(firestore, 'recipes', recipeId), {
                ...recipeData,
                // legacy
                ingredients: ingredientsForDb.map((x) => x.name),
                // ny
                ingredientsDetailed: ingredientsForDb,

                temperature,
                cookingTime,
                portions,
                cookingSteps: stepsForDb,
                coverImage: coverImageUrl,
                updatedAt: serverTimestamp(),
            });

            localStorage.removeItem(LOCAL_STORAGE_KEY);
            router.push(`/user/${user.uid}`);
        } catch (error) {
            console.error('Error updating recipe:', error);
        }
    };

    if (loading) return <div className="p-4">Laster inn oppskrift...</div>;

    return (
        <div className="min-h-screen">
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

                    <h1 className="text-lg font-semibold text-slate-900">Rediger oppskrift</h1>

                    <button
                        type="submit"
                        form="edit-recipe-form"
                        className="h-10 px-4 rounded-full bg-cyan-100 text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition"
                    >
                        Lagre
                    </button>
                </div>
            </div>

            <div className="mx-auto max-w-xl px-4 py-6 pb-28">
                <form id="edit-recipe-form" onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic info */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Tittel</label>
                        <input
                            type="text"
                            placeholder="f.eks. Verdens beste lasagne"
                            value={recipeData.title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
                        />

                        <label className="block text-sm font-semibold text-slate-900 mt-4 mb-2">Beskrivelse</label>
                        <textarea
                            placeholder="Kort og fristende…"
                            value={recipeData.description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full min-h-[120px] p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
                        />
                    </div>

                    {/* Cover */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-base font-semibold text-slate-900">Forsidebilde</h2>
                            {(coverImagePreview || recipeData.coverImage) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCoverImageFile(null);
                                        setCoverImagePreview(null);
                                        setRecipeData((p) => ({ ...p, coverImage: '' }));
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

                        {coverImagePreview ? (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                <img src={coverImagePreview} alt="Cover Preview" className="w-full max-h-72 object-cover" />
                            </div>
                        ) : recipeData.coverImage ? (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                <img src={recipeData.coverImage} alt="Cover" className="w-full max-h-72 object-cover" />
                            </div>
                        ) : null}
                    </div>

                    {/* Ingredients + meta */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <h2 className="text-base font-semibold text-slate-900 mb-3">Ingredienser</h2>

                        {/* add row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                type="text"
                                placeholder="Ingrediens (f.eks. Hvetemel)"
                                value={newIngredientName}
                                onChange={(e) => setNewIngredientName(e.target.value)}
                                className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                            <input
                                type="text"
                                placeholder="Mengde (f.eks. 200 g)"
                                value={newIngredientAmount}
                                onChange={(e) => setNewIngredientAmount(e.target.value)}
                                className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddIngredient();
                                    }
                                }}
                            />
                        </div>

                        <div className="mt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddIngredient}
                                className="px-4 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                                disabled={!newIngredientName.trim()}
                            >
                                Legg til
                            </button>
                        </div>

                        {/* sortable list */}
                        <div className="mt-4">
                            <DndContext sensors={sensorsIngredients} collisionDetection={closestCenter} onDragEnd={onDragEndIngredients}>
                                <SortableContext items={ingredientsDetailed.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-3">
                                        {ingredientsDetailed.map((item, index) => (
                                            <SortableIngredientCard
                                                key={item.id}
                                                item={item}
                                                index={index}
                                                onChange={handleIngredientChange}
                                                onRemove={handleRemoveIngredient}
                                            />
                                        ))}

                                        {ingredientsDetailed.length === 0 && (
                                            <p className="text-slate-600">
                                                Ingen ingredienser ennå — legg til over.
                                            </p>
                                        )}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 ">                            <div>
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
                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition"
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                Legg til
                            </button>
                        </div>

                        <DndContext sensors={sensorsSteps} collisionDetection={closestCenter} onDragEnd={onDragEndSteps}>
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

                    {/* bottom save */}
                    <div className="sm:hidden pt-2">
                        <button
                            type="submit"
                            className="w-full rounded-full py-3 font-semibold  shadow-lg bg-cyan-100 hover:opacity-95 active:scale-[0.99] transition"
                        >
                            Lagre
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditRecipePage;