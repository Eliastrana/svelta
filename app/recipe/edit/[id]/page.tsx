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

type DraftPayload = {
    recipeData?: RecipeData;
    ingredients?: string[];
    temperature?: string;
    cookingTime?: string;
    cookingSteps?: StepWithId[];
    newIngredient?: string;
    // NB: blob:-preview funker ikke etter reload, så vi ignorerer den ved hydration
    coverImagePreview?: string | null;
};

const makeId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function isMeaningfulDraft(draft: DraftPayload): boolean {
    const title = draft.recipeData?.title?.trim() ?? '';
    const desc = draft.recipeData?.description?.trim() ?? '';

    const ingredients =
        draft.ingredients ??
        draft.recipeData?.ingredients ??
        [];

    const steps =
        draft.cookingSteps ??
        (draft.recipeData?.cookingSteps ?? []).map((s) => ({ ...s, id: makeId() }));

    const temperature =
        (draft.temperature ?? draft.recipeData?.temperature ?? '').trim();

    const cookingTime =
        (draft.cookingTime ?? draft.recipeData?.cookingTime ?? '').trim();

    const coverPreview = draft.coverImagePreview ?? null;
    const usablePreview = coverPreview && !coverPreview.startsWith('blob:'); // blob er ubrukelig etter reload

    return Boolean(
        title ||
        desc ||
        ingredients.length > 0 ||
        steps.length > 0 ||
        temperature ||
        cookingTime ||
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
        ingredients: [],
        temperature: '',
        cookingTime: '',
        coverImage: '',
    });

    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

    const [newIngredient, setNewIngredient] = useState('');
    const [ingredients, setIngredients] = useState<string[]>([]);
    const [temperature, setTemperature] = useState('');
    const [cookingTime, setCookingTime] = useState('');

    const [cookingSteps, setCookingSteps] = useState<StepWithId[]>([]);

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

    // 1) Sjekk localStorage først. Hvis draft er tom → slett den.
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

            // Hydrate fra draft (bruker ønsker “fortsett der jeg slapp”)
            if (draft.recipeData) {
                setRecipeData(draft.recipeData);
            }

            const ing = draft.ingredients ?? draft.recipeData?.ingredients ?? [];
            setIngredients(ing);

            setTemperature(draft.temperature ?? draft.recipeData?.temperature ?? '');
            setCookingTime(draft.cookingTime ?? draft.recipeData?.cookingTime ?? '');

            const loadedSteps = draft.cookingSteps ?? [];
            setCookingSteps(
                loadedSteps.map((s) => ({ ...s, id: s.id || makeId() })),
            );

            setNewIngredient(draft.newIngredient ?? '');

            // blob preview er ubrukelig etter reload — ignorer den
            const prev = draft.coverImagePreview ?? null;
            setCoverImagePreview(prev && !prev.startsWith('blob:') ? prev : null);

            setDraftChecked(true);
            setLoading(false);
        } catch {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setDraftChecked(true);
        }
    }, [recipeId, LOCAL_STORAGE_KEY]);

    // 2) Når draft er sjekket: hent fra Firestore hvis vi ikke allerede har et gyldig draft som fyller ting.
    useEffect(() => {
        if (!recipeId) return;
        if (!draftChecked) return;
        if (hasFetched.current) return;

        const fetchRecipe = async () => {
            try {
                const recipeSnap = await getDoc(doc(firestore, 'recipes', recipeId));
                if (!recipeSnap.exists()) return;

                const data = recipeSnap.data() as RecipeData;

                // Hvis vi fortsatt er tomme (ingen draft / slettet draft), hydrate fra DB
                const alreadyHasTitle = (recipeData.title ?? '').trim().length > 0;
                if (!alreadyHasTitle) {
                    setRecipeData(data);
                    setIngredients(data.ingredients ?? []);
                    setTemperature(data.temperature ?? '');
                    setCookingTime(data.cookingTime ?? '');

                    const steps = (data.cookingSteps ?? []).map((s) => ({ ...s, id: makeId() }));
                    setCookingSteps(steps);

                    // hvis vi ikke har preview valgt lokalt, vis coverImage fra db
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

    // Rydd opp object URL preview når du velger nytt bilde i samme session
    useEffect(() => {
        return () => {
            if (coverImagePreview && coverImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(coverImagePreview);
            }
        };
    }, [coverImagePreview]);

    // Persist draft (MEN: ikke lagre blob preview i localStorage)
    useEffect(() => {
        if (!recipeId) return;
        if (!draftChecked) return;

        const payload: DraftPayload = {
            recipeData: {
                ...recipeData,
                ingredients,
                temperature,
                cookingTime,
                cookingSteps: cookingSteps.map((s) => ({
                    title: s.title,
                    description: s.description,
                })),
            },
            ingredients,
            temperature,
            cookingTime,
            cookingSteps,
            newIngredient,
            coverImagePreview: null, // blob preview kan ikke gjenbrukes etter reload
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    }, [
        recipeId,
        LOCAL_STORAGE_KEY,
        draftChecked,
        recipeData,
        ingredients,
        temperature,
        cookingTime,
        cookingSteps,
        newIngredient,
    ]);

    const setTitle = (v: string) => setRecipeData((p) => ({ ...p, title: v }));
    const setDescription = (v: string) => setRecipeData((p) => ({ ...p, description: v }));

    const handleAddIngredient = () => {
        const trimmed = newIngredient.trim();
        if (!trimmed) return;
        setIngredients((prev) => [...prev, trimmed]);
        setNewIngredient('');
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredients((prev) => prev.filter((_, idx) => idx !== index));
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

        // preview for denne session
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

        try {
            await updateDoc(doc(firestore, 'recipes', recipeId), {
                ...recipeData,
                ingredients,
                temperature,
                cookingTime,
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
        <div className="min-h-screen bg-slate-50">
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
                        className="h-10 px-4 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition"
                    >
                        Lagre
                    </button>
                </div>
            </div>

            <div className="mx-auto max-w-xl px-4 py-6 pb-28">
                <form id="edit-recipe-form" onSubmit={handleSubmit} className="space-y-4">
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
                                className="px-4 rounded-2xl bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                                disabled={!newIngredient.trim()}
                            >
                                Legg til
                            </button>
                        </div>

                        {ingredients.length > 0 && (
                            <ul className="mt-4 space-y-2">
                                {ingredients.map((ing, idx) => (
                                    <li
                                        key={`${ing}-${idx}`}
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

                    <div className="sm:hidden pt-2">
                        <button
                            type="submit"
                            className="w-full rounded-full py-3 font-semibold text-white shadow-lg bg-slate-900 hover:opacity-95 active:scale-[0.99] transition"
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
