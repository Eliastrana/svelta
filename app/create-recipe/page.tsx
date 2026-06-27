'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CookingStep } from '@/app/types/CookingStep';
import { normalizeIngredientAmountInput } from '@/helpers/ingredientAmountParser';
import { RecipeVisibility } from '@/helpers/recipeVisibility';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { createCoAuthorInviteNotification } from '@/helpers/coAuthorInvites';

import RecipeCreatedModal from '@/app/components/RecipeCreatedModal';
import RecipeReferencePickerModal from '@/app/components/RecipeReferencePickerModal';
import CoAuthorPickerModal, {
    CoAuthorInvitee,
} from '@/app/components/CoAuthorPickerModal';

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

type StepWithId = CookingStep & {
    id: string;
    imageFile?: File | null;
    imagePreview?: string | null;
};

type Ingredient = { name: string; amount: string };
type IngredientWithId = Ingredient & { id: string };

const makeId = (prefix: 'step' | 'ing'): string => {
    const base =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${base}`;
};

const getStoredStepImage = (step: Partial<StepWithId>): string => {
    if (step.imagePreview && !step.imagePreview.startsWith('blob:'))
        return step.imagePreview;
    return step.imageUrl?.trim() || '';
};

const revokeBlobUrl = (url?: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
};

function SortableStepCard(props: {
    step: StepWithId;
    index: number;
    currentUserId: string;
    followingIds: string[];
    onChange: (
        id: string,
        field: 'title' | 'description',
        value: string
    ) => void;
    onLinkedRecipeChange: (id: string, linkedRecipe: StepWithId['linkedRecipe'] | null) => void;
    onImageChange: (
        id: string,
        event: React.ChangeEvent<HTMLInputElement>
    ) => void;
    onRemoveImage: (id: string) => void;
    onRemove: (id: string) => void;
}) {
    const [showReferencePicker, setShowReferencePicker] = useState(false);
    const {
        step,
        index,
        currentUserId,
        followingIds,
        onChange,
        onLinkedRecipeChange,
        onImageChange,
        onRemoveImage,
        onRemove,
    } = props;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
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
                            <span className="material-symbols-outlined text-slate-600">
                                drag_indicator
                            </span>
                        </button>

                        <label className="block text-sm font-semibold text-slate-900">
                            Steg {index + 1} – tittel
                        </label>
                    </div>

                    <input
                        type="text"
                        placeholder="f.eks. Forvarm ovnen"
                        value={step.title}
                        onChange={(e) =>
                            onChange(step.id, 'title', e.target.value)
                        }
                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        required
                    />

                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-2">
                        Beskrivelse
                    </label>
                    <textarea
                        placeholder="Hva gjør man her?"
                        value={step.description}
                        onChange={(e) =>
                            onChange(step.id, 'description', e.target.value)
                        }
                        className="w-full min-h-[90px] p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        required
                    />

                    <div className="mt-3">
                        <label className="mb-2 block text-sm font-semibold text-slate-900">
                            Referer til oppskrift
                        </label>
                        {step.linkedRecipe ? (
                            <div className="rounded-2xl border border-slate-200 bg-[#fbfaf4] p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#ece7d9]">
                                        {step.linkedRecipe.coverImage ? (
                                            <img
                                                src={step.linkedRecipe.coverImage}
                                                alt={step.linkedRecipe.title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="material-symbols-outlined text-[#496444]">
                                                menu_book
                                            </span>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-[#6c7b65]">
                                            Valgt referanse
                                        </p>
                                        <p className="truncate font-semibold text-[#12340d]">
                                            {step.linkedRecipe.title}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowReferencePicker(true)
                                        }
                                        className="rounded-full bg-[#efe9db] px-3 py-2 text-sm font-semibold text-[#12340d] transition hover:bg-[#e4ddce]"
                                    >
                                        Bytt oppskrift
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onLinkedRecipeChange(step.id, null)
                                        }
                                        className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                                    >
                                        Fjern
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowReferencePicker(true)}
                                className="flex w-full items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                            >
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        Velg referert oppskrift
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Velg blant oppskriftene til folk du
                                        følger.
                                    </p>
                                </div>
                                <span className="material-symbols-outlined text-slate-600">
                                    arrow_forward
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="mt-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="block text-sm font-semibold text-slate-900">
                                Stegbilde
                            </label>
                            {step.imagePreview || step.imageUrl ? (
                                <button
                                    type="button"
                                    onClick={() => onRemoveImage(step.id)}
                                    className="text-sm text-slate-600 hover:underline"
                                >
                                    Fjern
                                </button>
                            ) : null}
                        </div>

                        <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 transition hover:bg-slate-50">
                            <span className="material-symbols-outlined text-slate-700">
                                photo_camera
                            </span>
                            <p className="mt-2 text-sm text-slate-600">
                                Legg til bilde for dette steget
                            </p>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) =>
                                    onImageChange(step.id, event)
                                }
                            />
                        </label>

                        {step.imagePreview || step.imageUrl ? (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                                <img
                                    src={step.imagePreview || step.imageUrl}
                                    alt={`Stegbilde ${index + 1}`}
                                    className="h-44 w-full object-cover"
                                />
                            </div>
                        ) : null}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(step.id)}
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition"
                    aria-label="Slett steg"
                >
                    <span className="material-symbols-outlined text-slate-600">
                        delete
                    </span>
                </button>
            </div>

            {showReferencePicker ? (
                <RecipeReferencePickerModal
                    currentUserId={currentUserId}
                    followingIds={followingIds}
                    onClose={() => setShowReferencePicker(false)}
                    onSelect={(linkedRecipe) =>
                        onLinkedRecipeChange(step.id, linkedRecipe)
                    }
                />
            ) : null}
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
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const [showAutoIndicator, setShowAutoIndicator] = useState(false);
    const indicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );

    useEffect(() => {
        return () => {
            if (indicatorTimeoutRef.current)
                clearTimeout(indicatorTimeoutRef.current);
        };
    }, []);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
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
            className={`rounded-2xl border border-slate-200 bg-white p-3 ${isDragging ? 'shadow-lg ring-2 ring-slate-200' : ''}`}
        >
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition cursor-grab active:cursor-grabbing"
                    aria-label={`Dra for å flytte ingrediens ${index + 1}`}
                    {...attributes}
                    {...listeners}
                >
                    <span className="material-symbols-outlined text-slate-600">
                        drag_indicator
                    </span>
                </button>

                <div className="flex-1">
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Ingrediens {index + 1}
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="relative sm:col-span-1">
                            <input
                                type="text"
                                placeholder="Mengde (f.eks. 2 ss / 150 g)"
                                value={item.amount}
                                onChange={(e) => {
                                    const parsed =
                                        normalizeIngredientAmountInput(
                                            e.target.value
                                        );
                                    onChange(
                                        item.id,
                                        'amount',
                                        parsed.formatted
                                    );
                                    if (parsed.isCompleteAmount) {
                                        if (indicatorTimeoutRef.current)
                                            clearTimeout(
                                                indicatorTimeoutRef.current
                                            );
                                        setShowAutoIndicator(true);
                                        indicatorTimeoutRef.current =
                                            setTimeout(() => {
                                                setShowAutoIndicator(false);
                                                indicatorTimeoutRef.current =
                                                    null;
                                            }, 1800);
                                        requestAnimationFrame(() =>
                                            nameInputRef.current?.focus()
                                        );
                                    }
                                }}
                                className="w-full rounded-2xl border border-slate-200 p-3 pr-20 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                            {showAutoIndicator ? (
                                <span className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#eaf6e5] px-2 py-1 text-[11px] font-semibold text-[#365d2c]">
                                    <span className="material-symbols-outlined text-[14px]">
                                        check
                                    </span>
                                    Auto
                                </span>
                            ) : null}
                        </div>
                        <input
                            ref={nameInputRef}
                            type="text"
                            placeholder="Ingrediens (f.eks. sukker)"
                            value={item.name}
                            onChange={(e) =>
                                onChange(item.id, 'name', e.target.value)
                            }
                            className="w-full rounded-2xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:col-span-2"
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition"
                    aria-label="Slett ingrediens"
                >
                    <span className="material-symbols-outlined text-slate-600">
                        delete
                    </span>
                </button>
            </div>
        </div>
    );
}

const CreateRecipe = () => {
    const currentUser = useAuthUser();
    const followingIds = useUserFollowing(currentUser?.uid ?? '');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [svgData, setSvgData] = useState('');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [fontStyle, setFontStyle] = useState('sans-serif');

    const [cookingSteps, setCookingSteps] = useState<StepWithId[]>([]);

    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
        null
    );

    const [ingredients, setIngredients] = useState<IngredientWithId[]>([]);
    const [newIngredientName, setNewIngredientName] = useState('');
    const [newIngredientAmount, setNewIngredientAmount] = useState('');
    const [showIngredientAmountIndicator, setShowIngredientAmountIndicator] =
        useState(false);

    const [temperature, setTemperature] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [portions, setPortions] = useState('');

    const [publishing, setPublishing] = useState(false);
    const [visibility, setVisibility] = useState<RecipeVisibility>('public');
    const [showCoAuthorPicker, setShowCoAuthorPicker] = useState(false);
    const [invitedCoAuthor, setInvitedCoAuthor] =
        useState<CoAuthorInvitee | null>(null);
    const coverImagePreviewRef = useRef<string | null>(null);
    const cookingStepsRef = useRef<StepWithId[]>([]);
    const newIngredientAmountRef = useRef<HTMLInputElement | null>(null);
    const newIngredientNameRef = useRef<HTMLInputElement | null>(null);
    const ingredientHintTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);

    const router = useRouter();

    type ImportRecipeResponse = {
        title?: string;
        description?: string;
        ingredientsDetailed?: Array<{ name: string; amount?: string }>;
        cookingSteps?: CookingStep[];
        temperature?: string;
        cookingTime?: string;
        portions?: string;
        coverImageUrl?: string; // valgfritt
    };

    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    const importFromUrl = async () => {
        const url = importUrl.trim();
        if (!url || importing) return;

        try {
            setImporting(true);
            setImportError(null);

            const res = await fetch('/api/import-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const data = (await res.json()) as ImportRecipeResponse & {
                error?: string;
            };

            if (!res.ok)
                throw new Error(
                    data.error || 'Kunne ikke importere oppskrift.'
                );

            // Prefyll felter (jeg overskriver her – enklest og mest forutsigbart)
            if (data.title) setTitle(data.title);
            if (data.description) setDescription(data.description);

            if (data.temperature) setTemperature(data.temperature);
            if (data.cookingTime) setCookingTime(data.cookingTime);
            if (data.portions) setPortions(data.portions);

            if (Array.isArray(data.ingredientsDetailed)) {
                setIngredients(
                    data.ingredientsDetailed
                        .map((i) => ({
                            id: makeId('ing'),
                            name: (i.name ?? '').trim(),
                            amount: (i.amount ?? '').trim(),
                        }))
                        .filter((i) => i.name.length > 0)
                );
            }

            if (Array.isArray(data.cookingSteps)) {
                setCookingSteps(
                    data.cookingSteps
                        .map((s) => ({
                            id: makeId('step'),
                            title: (s.title ?? '').trim() || 'Steg',
                            description: (s.description ?? '').trim(),
                            imageUrl: s.imageUrl?.trim() || '',
                            linkedRecipe: s.linkedRecipe,
                            imagePreview: s.imageUrl?.trim() || '',
                            imageFile: null,
                        }))
                        .filter((s) => s.description.length > 0)
                );
            }

            // Valgfritt: bruke coverImage fra import som preview (ekstern URL)
            if (data.coverImageUrl) {
                setCoverImageFile(null);
                setCoverImagePreview(data.coverImageUrl);
            }
        } catch (e) {
            console.error(e);
            setImportError(
                e instanceof Error
                    ? e.message
                    : 'Kunne ikke importere oppskrift.'
            );
        } finally {
            setImporting(false);
        }
    };

    // ✅ success modal state
    const [createdRecipeId, setCreatedRecipeId] = useState<string>('');

    const showIngredientHint = (visible: boolean) => {
        if (ingredientHintTimeoutRef.current)
            clearTimeout(ingredientHintTimeoutRef.current);
        setShowIngredientAmountIndicator(visible);
        if (!visible) return;
        ingredientHintTimeoutRef.current = setTimeout(() => {
            setShowIngredientAmountIndicator(false);
            ingredientHintTimeoutRef.current = null;
        }, 1800);
    };

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
            visibility?: RecipeVisibility;
            invitedCoAuthor?: CoAuthorInvitee | null;
        } = JSON.parse(savedData);

        setTitle(formData.title || '');
        setDescription(formData.description || '');
        setSvgData(formData.svgData || '');
        setBgColor(formData.bgColor || '#ffffff');
        setFontStyle(formData.fontStyle || 'sans-serif');
        setTemperature(formData.temperature || '');
        setCookingTime(formData.cookingTime || '');
        setPortions(formData.portions || '');
        setVisibility(formData.visibility === 'private' ? 'private' : 'public');
        setCoverImagePreview(formData.coverImagePreview || null);
        setInvitedCoAuthor(formData.invitedCoAuthor ?? null);

        const loadedSteps = formData.cookingSteps || [];
        setCookingSteps(
            loadedSteps.map((s) => {
                const step =
                    'id' in s
                        ? (s as StepWithId)
                        : { ...(s as CookingStep), id: makeId('step') };
                const storedImage = getStoredStepImage(step);
                return {
                    ...step,
                    imageUrl: step.imageUrl?.trim() || storedImage,
                    linkedRecipe: step.linkedRecipe,
                    imagePreview: storedImage || null,
                    imageFile: null,
                };
            })
        );

        const detailed = formData.ingredientsDetailed || [];
        if (detailed.length > 0) {
            setIngredients(
                detailed.map((i) =>
                    'id' in i
                        ? (i as IngredientWithId)
                        : { ...(i as Ingredient), id: makeId('ing') }
                )
            );
        } else {
            const old = formData.ingredients || [];
            setIngredients(
                old.map((name) => ({ id: makeId('ing'), name, amount: '' }))
            );
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
            cookingSteps: cookingSteps.map((step) => ({
                id: step.id,
                title: step.title,
                description: step.description,
                imageUrl: getStoredStepImage(step),
                linkedRecipe: step.linkedRecipe,
                imagePreview: getStoredStepImage(step) || null,
            })),
            ingredients: ingredients
                .map((i) =>
                    `${(i.amount || '').trim()} ${(i.name || '').trim()}`.trim()
                )
                .filter(Boolean),
            ingredientsDetailed: ingredients,
            newIngredientName,
            newIngredientAmount,
            temperature,
            cookingTime,
            portions,
            coverImagePreview,
            tags,
            visibility,
            invitedCoAuthor,
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
        visibility,
        invitedCoAuthor,
    ]);

    const handleAddStep = () => {
        setCookingSteps((prev) => [
            ...prev,
            {
                id: makeId('step'),
                title: '',
                description: '',
                imageUrl: '',
                linkedRecipe: undefined,
                imagePreview: null,
                imageFile: null,
            },
        ]);
    };

    const handleStepChange = (
        id: string,
        field: 'title' | 'description',
        value: string
    ) => {
        setCookingSteps((prev) =>
            prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        );
    };

    const handleLinkedRecipeChange = (
        id: string,
        linkedRecipe: StepWithId['linkedRecipe'] | null
    ) => {
        setCookingSteps((prev) =>
            prev.map((step) => {
                return {
                    ...step,
                    ...(step.id === id
                        ? { linkedRecipe: linkedRecipe ?? undefined }
                        : {}),
                };
            })
        );
    };

    const handleRemoveStep = (id: string) => {
        setCookingSteps((prev) => {
            const step = prev.find((s) => s.id === id);
            revokeBlobUrl(step?.imagePreview);
            return prev.filter((s) => s.id !== id);
        });
    };

    const handleStepImageChange = (
        id: string,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setCookingSteps((prev) =>
            prev.map((step) => {
                if (step.id !== id) return step;
                revokeBlobUrl(step.imagePreview);
                return {
                    ...step,
                    imageFile: file,
                    imagePreview: URL.createObjectURL(file),
                };
            })
        );
    };

    const handleRemoveStepImage = (id: string) => {
        setCookingSteps((prev) =>
            prev.map((step) => {
                if (step.id !== id) return step;
                revokeBlobUrl(step.imagePreview);
                return {
                    ...step,
                    imageFile: null,
                    imagePreview: null,
                    imageUrl: '',
                };
            })
        );
    };

    const handleAddIngredient = () => {
        const name = newIngredientName.trim();
        const amount =
            normalizeIngredientAmountInput(newIngredientAmount).formatted;
        if (!name) return;

        setIngredients((prev) => [
            ...prev,
            { id: makeId('ing'), name, amount },
        ]);
        setNewIngredientName('');
        setNewIngredientAmount('');
        showIngredientHint(false);
        requestAnimationFrame(() => newIngredientAmountRef.current?.focus());
    };

    const handleIngredientChange = (
        id: string,
        field: 'name' | 'amount',
        value: string
    ) => {
        setIngredients((prev) =>
            prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
        );
    };

    const handleRemoveIngredient = (id: string) => {
        setIngredients((prev) => prev.filter((i) => i.id !== id));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        revokeBlobUrl(coverImagePreviewRef.current);
        setCoverImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setCoverImagePreview(previewUrl);
    };

    useEffect(() => {
        coverImagePreviewRef.current = coverImagePreview;
    }, [coverImagePreview]);

    useEffect(() => {
        cookingStepsRef.current = cookingSteps;
    }, [cookingSteps]);

    useEffect(() => {
        return () => {
            if (ingredientHintTimeoutRef.current)
                clearTimeout(ingredientHintTimeoutRef.current);
            revokeBlobUrl(coverImagePreviewRef.current);
            cookingStepsRef.current.forEach((step) =>
                revokeBlobUrl(step.imagePreview)
            );
        };
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeType = active.data.current?.type as
            | 'step'
            | 'ingredient'
            | undefined;
        const overType = over.data.current?.type as
            | 'step'
            | 'ingredient'
            | undefined;
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
            const exists = prev.some(
                (x) => x.toLowerCase() === t.toLowerCase()
            );
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

            const data = (await res.json()) as {
                tags?: string[];
                error?: string;
            };

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
                const imageRef = ref(
                    storage,
                    `recipe-covers/${user.uid}-${Date.now()}-${coverImageFile.name}`
                );
                const snapshot = await uploadBytes(imageRef, coverImageFile);
                coverImageUrl = await getDownloadURL(snapshot.ref);
            }

            const stepsForDb: CookingStep[] = await Promise.all(
                cookingSteps.map(async (s, index) => {
                    let imageUrl = s.imageUrl?.trim() || getStoredStepImage(s);

                    if (s.imageFile) {
                        const imageRef = ref(
                            storage,
                            `recipe-steps/${user.uid}/${Date.now()}-${index}-${s.imageFile.name}`
                        );
                        const snapshot = await uploadBytes(
                            imageRef,
                            s.imageFile
                        );
                        imageUrl = await getDownloadURL(snapshot.ref);
                    }

                    return {
                        title: s.title,
                        description: s.description,
                        imageUrl: imageUrl || '',
                        ...(s.linkedRecipe?.id
                            ? {
                                  linkedRecipe: {
                                      id: s.linkedRecipe.id,
                                      title: s.linkedRecipe.title,
                                      coverImage:
                                          s.linkedRecipe.coverImage || '',
                                  },
                              }
                            : {}),
                    };
                })
            );

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
                visibility,
                userId: user.uid,
                createdAt: serverTimestamp(),
                coverImage: coverImageUrl,
                likeCount: 0,
                commentCount: 0,
                tags,
                coAuthors: [],
                coAuthorIds: [],
                pendingCoAuthorInviteIds: invitedCoAuthor
                    ? [invitedCoAuthor.uid]
                    : [],
            });

            if (invitedCoAuthor) {
                await createCoAuthorInviteNotification({
                    actorId: user.uid,
                    actorName:
                        currentUser?.displayName?.trim() || 'En kokk',
                    actorPhotoURL: currentUser?.photoURL || '',
                    inviteeId: invitedCoAuthor.uid,
                    recipeId: docRef.id,
                    recipeTitle: title.trim() || 'en oppskrift',
                });
            }

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

            {showCoAuthorPicker ? (
                <CoAuthorPickerModal
                    followingIds={followingIds}
                    selectedUid={invitedCoAuthor?.uid}
                    onClose={() => setShowCoAuthorPicker(false)}
                    onSelect={(user) => setInvitedCoAuthor(user)}
                />
            ) : null}

            {/* Content */}
            <div className="mx-auto max-w-xl px-4 py-6 pb-28">
                <div className="mb-4 flex items-center justify-end">
                    {/*<button*/}
                    {/*    onClick={() => router.back()}*/}
                    {/*    className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100"*/}
                    {/*    aria-label="Tilbake"*/}
                    {/*    type="button"*/}
                    {/*>*/}
                    {/*    <span className="material-symbols-outlined">arrow_back</span>*/}
                    {/*</button>*/}

                    <button
                        type="submit"
                        form="create-recipe-form"
                        disabled={publishing}
                        className={[
                            'h-10 px-4 rounded-full brown-button text-sm font-semibold shadow-sm transition',
                            publishing
                                ? 'opacity-70 cursor-not-allowed'
                                : 'hover:opacity-95 active:scale-[0.99]',
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

                <form
                    id="create-recipe-form"
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Import from URL */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-base font-semibold text-slate-900">
                                Importer fra URL
                            </h2>
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={importUrl}
                                onChange={(e) => setImportUrl(e.target.value)}
                                placeholder="Lim inn lenke til oppskrift…"
                                className="flex-1 p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                            <button
                                type="button"
                                onClick={importFromUrl}
                                disabled={importing || !importUrl.trim()}
                                className={[
                                    'px-4 rounded-full font-semibold transition brown-button',
                                    importing || !importUrl.trim()
                                        ? 'opacity-70 cursor-not-allowed'
                                        : 'hover:opacity-95 active:scale-[0.99]',
                                ].join(' ')}
                            >
                                <span className="inline-flex items-center gap-2">
                                    {importing ? (
                                        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                                    ) : null}
                                    {importing ? 'Importerer…' : 'Importer'}
                                </span>
                            </button>
                        </div>

                        {importError ? (
                            <p className="mt-2 text-sm text-red-600">
                                {importError}
                            </p>
                        ) : null}
                    </div>

                    {/* Basic info */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Tittel
                        </label>
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

                        <label className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                            <div>
                                <p className="font-semibold text-slate-900">
                                    Privat oppskrift
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                    Bare folk som følger deg kan se den.
                                    Offentlige oppskrifter vises til alle.
                                </p>
                            </div>
                            <span className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={visibility === 'private'}
                                    onChange={(e) =>
                                        setVisibility(
                                            e.target.checked
                                                ? 'private'
                                                : 'public'
                                        )
                                    }
                                    className="peer sr-only"
                                />
                                <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[var(--accent)]" />
                                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                            </span>
                        </label>

                        <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        Medforfatter
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">
                                        Inviter en kokk du følger til å stå som
                                        medforfatter på oppskriften.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowCoAuthorPicker(true)}
                                    className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                                >
                                    {invitedCoAuthor ? 'Bytt' : 'Velg kokk'}
                                </button>
                            </div>

                            {invitedCoAuthor ? (
                                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#fbfaf4] p-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e5d7]">
                                        {invitedCoAuthor.photoURL ? (
                                            <img
                                                src={invitedCoAuthor.photoURL}
                                                alt={invitedCoAuthor.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-lg">
                                                👩‍🍳
                                            </span>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-[#12340d]">
                                            {invitedCoAuthor.name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">
                                            Får en invitasjon når oppskriften
                                            publiseres.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setInvitedCoAuthor(null)}
                                        className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                                    >
                                        Fjern
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-4 text-sm text-slate-500">
                                    Ingen medforfatter valgt.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Cover image */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-base font-semibold text-slate-900">
                                Forsidebilde
                            </h2>
                            {coverImagePreview && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        revokeBlobUrl(
                                            coverImagePreviewRef.current
                                        );
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
                            <span className="material-symbols-outlined text-slate-700">
                                upload
                            </span>
                            <p className="mt-2 text-sm text-slate-600">
                                Klikk eller dra og slipp bildet ditt her
                            </p>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageChange}
                            />
                        </label>

                        {coverImagePreview && (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                <img
                                    src={coverImagePreview}
                                    alt="Image Preview"
                                    className="w-full max-h-72 object-cover"
                                />
                            </div>
                        )}
                    </div>

                    {/* Ingredients + meta */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onDragEnd}
                    >
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold text-slate-900">
                                    Ingredienser
                                </h2>
                            </div>

                            {ingredients.length > 0 ? (
                                <SortableContext
                                    items={ingredients.map((i) => i.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="mt-4 space-y-2">
                                        {ingredients.map((item, index) => (
                                            <SortableIngredientCard
                                                key={item.id}
                                                item={item}
                                                index={index}
                                                onChange={
                                                    handleIngredientChange
                                                }
                                                onRemove={
                                                    handleRemoveIngredient
                                                }
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            ) : (
                                <p className="mt-4 text-slate-600">
                                    Ingrediensene dukker opp her. Legg dem til
                                    én etter én, og dra for å sortere.
                                </p>
                            )}

                            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-700">
                                        playlist_add
                                    </span>
                                    <h3 className="text-sm font-semibold text-slate-900">
                                        Legg til neste ingrediens
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <div className="relative sm:col-span-1">
                                        <input
                                            ref={newIngredientAmountRef}
                                            type="text"
                                            placeholder="Mengde (f.eks. 2ss, 1dl, 200g)"
                                            value={newIngredientAmount}
                                            onChange={(e) => {
                                                const parsed =
                                                    normalizeIngredientAmountInput(
                                                        e.target.value
                                                    );
                                                setNewIngredientAmount(
                                                    parsed.formatted
                                                );
                                                if (parsed.isCompleteAmount) {
                                                    showIngredientHint(true);
                                                    requestAnimationFrame(() =>
                                                        newIngredientNameRef.current?.focus()
                                                    );
                                                }
                                            }}
                                            className="w-full rounded-2xl border border-slate-200 p-3 pr-20 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    newIngredientNameRef.current?.focus();
                                                }
                                            }}
                                        />
                                        {showIngredientAmountIndicator ? (
                                            <span className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#eaf6e5] px-2 py-1 text-[11px] font-semibold text-[#365d2c]">
                                                <span className="material-symbols-outlined text-[14px]">
                                                    check
                                                </span>
                                                Auto
                                            </span>
                                        ) : null}
                                    </div>
                                    <input
                                        ref={newIngredientNameRef}
                                        type="text"
                                        placeholder="Ingrediens (f.eks. sukker)"
                                        value={newIngredientName}
                                        onChange={(e) =>
                                            setNewIngredientName(e.target.value)
                                        }
                                        className="w-full rounded-2xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:col-span-2"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddIngredient();
                                            }
                                        }}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddIngredient}
                                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-50"
                                    disabled={!newIngredientName.trim()}
                                >
                                    <span className="material-symbols-outlined text-base">
                                        add
                                    </span>
                                    Legg til ingrediens
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                                        Temperatur
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="f.eks. 200°C"
                                        value={temperature}
                                        onChange={(e) =>
                                            setTemperature(e.target.value)
                                        }
                                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                                        Koketid
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="f.eks. 45 minutter"
                                        value={cookingTime}
                                        onChange={(e) =>
                                            setCookingTime(e.target.value)
                                        }
                                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                                        Porsjoner
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="f.eks. 4"
                                        value={portions}
                                        onChange={(e) =>
                                            setPortions(e.target.value)
                                        }
                                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-semibold text-slate-900">
                                    Steg
                                </h2>
                            </div>

                            <SortableContext
                                items={cookingSteps.map((s) => s.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {cookingSteps.map((step, index) => (
                                        <SortableStepCard
                                            key={step.id}
                                            step={step}
                                            index={index}
                                            currentUserId={
                                                currentUser?.uid ?? ''
                                            }
                                            followingIds={followingIds}
                                            onChange={handleStepChange}
                                            onLinkedRecipeChange={
                                                handleLinkedRecipeChange
                                            }
                                            onImageChange={
                                                handleStepImageChange
                                            }
                                            onRemoveImage={
                                                handleRemoveStepImage
                                            }
                                            onRemove={handleRemoveStep}
                                        />
                                    ))}

                                    {cookingSteps.length === 0 && (
                                        <p className="text-slate-600">
                                            Ingen steg ennå — trykk{' '}
                                            <span className="font-semibold">
                                                Legg til
                                            </span>
                                            .
                                        </p>
                                    )}
                                </div>
                            </SortableContext>

                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition mt-2"
                            >
                                <span className="material-symbols-outlined text-base">
                                    add
                                </span>
                                Legg til
                            </button>
                        </div>
                    </DndContext>

                    {/* Tags */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h2 className="text-base font-semibold text-slate-900">
                                Tags
                            </h2>

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
                                        <span className="material-symbols-outlined text-[18px]">
                                            close
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-slate-600">
                                Ingen tags ennå.
                            </p>
                        )}
                    </div>

                    <div className="justify-end flex">
                        <button
                            type="submit"
                            form="create-recipe-form"
                            disabled={publishing}
                            className={[
                                'h-10 px-4 rounded-full brown-button text-sm font-semibold shadow-sm transition',
                                publishing
                                    ? 'opacity-70 cursor-not-allowed'
                                    : 'hover:opacity-95 active:scale-[0.99]',
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

                    {/* Bottom publish */}
                    {/*                <div className="sm:hidden pt-2">*/}
                    {/*                    <button*/}
                    {/*                        type="submit"*/}
                    {/*                        disabled={publishing}*/}
                    {/*                        className={[*/}
                    {/*                            'w-full rounded-full py-3 font-semibold shadow-lg brown-button transition',*/}
                    {/*                            publishing ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95 active:scale-[0.99]',*/}
                    {/*                        ].join(' ')}*/}
                    {/*                    >*/}
                    {/*<span className="inline-flex items-center justify-center gap-2">*/}
                    {/*    {publishing ? (*/}
                    {/*        <span*/}
                    {/*            className="inline-block h-5 w-5 rounded-full border-2 border-white/60 border-t-white animate-spin"*/}
                    {/*            aria-hidden="true"*/}
                    {/*        />*/}
                    {/*    ) : null}*/}
                    {/*    {publishing ? 'Publiserer…' : 'Publiser'}*/}
                    {/*</span>*/}
                    {/*                    </button>*/}
                    {/*                </div>*/}
                </form>
            </div>
        </div>
    );
};

export default CreateRecipe;
