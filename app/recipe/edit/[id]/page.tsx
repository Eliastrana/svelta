'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RecipeData } from '@/app/types/RecipeData';
import { CookingStep } from '@/app/types/CookingStep';
import { normalizeIngredientAmountInput } from '@/helpers/ingredientAmountParser';
import { RecipeVisibility } from '@/helpers/recipeVisibility';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import RecipeReferencePickerModal from '@/app/components/RecipeReferencePickerModal';
import CoAuthorPickerModal, {
    CoAuthorInvitee,
} from '@/app/components/CoAuthorPickerModal';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { createCoAuthorInviteNotification } from '@/helpers/coAuthorInvites';

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

type StepWithId = CookingStep & {
    id: string;
    imageFile?: File | null;
    imagePreview?: string | null;
};

type IngredientItem = {
    id: string;
    name: string;
    amount: string;
};

type RecipeDoc = RecipeData & {
    // ny struktur (kan mangle i eldre docs)
    ingredientsDetailed?: IngredientItem[];
    portions?: string;
    coAuthors?: Array<{ uid: string; name?: string; photoURL?: string }>;
    coAuthorIds?: string[];
    pendingCoAuthorInviteIds?: string[];
};

type SelectedCoAuthor = CoAuthorInvitee & {
    status: 'accepted' | 'pending';
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
    selectedCoAuthor?: SelectedCoAuthor | null;
};

const sanitizeRecipeData = (
    value?: Partial<RecipeData> | null
): RecipeData => ({
    title: value?.title ?? '',
    description: value?.description ?? '',
    image: value?.image ?? '',
    bgColor: value?.bgColor ?? '#ffffff',
    fontStyle: value?.fontStyle ?? 'sans-serif',
    cookingSteps: Array.isArray(value?.cookingSteps) ? value.cookingSteps : [],
    ingredients: Array.isArray(value?.ingredients) ? value.ingredients : [],
    temperature: value?.temperature ?? '',
    cookingTime: value?.cookingTime ?? '',
    coverImage: value?.coverImage ?? '',
    portions: value?.portions ?? '',
    visibility: value?.visibility === 'private' ? 'private' : 'public',
});

const makeId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getStoredStepImage = (step: Partial<StepWithId>): string => {
    if (step.imagePreview && !step.imagePreview.startsWith('blob:'))
        return step.imagePreview;
    return step.imageUrl?.trim() || '';
};

const revokeBlobUrl = (url?: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
};

function normalizeIngredientName(s: string): string {
    return s.trim();
}

function normalizeIngredientAmount(s: string): string {
    return normalizeIngredientAmountInput(s).formatted;
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
        (draft.ingredients
            ? toIngredientItemsFromStrings(draft.ingredients)
            : []) ??
        [];

    const steps =
        draft.cookingSteps ??
        (draft.recipeData?.cookingSteps ?? []).map((s) => ({
            ...s,
            id: makeId(),
        }));

    const temperature = (
        draft.temperature ??
        draft.recipeData?.temperature ??
        ''
    ).trim();
    const cookingTime = (
        draft.cookingTime ??
        draft.recipeData?.cookingTime ??
        ''
    ).trim();
    const portions = (
        draft.portions ??
        draft.recipeData?.portions ??
        ''
    ).trim();

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
            usablePreview
    );
}

function SortableStepCard(props: {
    step: StepWithId;
    index: number;
    currentUserId: string;
    followingIds: string[];
    excludeRecipeId?: string;
    onChange: (
        stepId: string,
        field: 'title' | 'description',
        value: string
    ) => void;
    onLinkedRecipeChange: (
        stepId: string,
        linkedRecipe: StepWithId['linkedRecipe'] | null
    ) => void;
    onImageChange: (
        stepId: string,
        event: React.ChangeEvent<HTMLInputElement>
    ) => void;
    onRemoveImage: (stepId: string) => void;
    onRemove: (stepId: string) => void;
}) {
    const [showReferencePicker, setShowReferencePicker] = useState(false);
    const {
        step,
        index,
        currentUserId,
        followingIds,
        excludeRecipeId,
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
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6c7b65]">
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
                    excludeRecipeId={excludeRecipeId}
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
    item: IngredientItem;
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
                    <span className="material-symbols-outlined text-slate-600">
                        drag_indicator
                    </span>
                </button>

                <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Ingrediens {index + 1}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Mengde (f.eks. 2 ss / 200 g)"
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
                            placeholder="Ingrediens (f.eks. Hvetemel)"
                            value={item.name}
                            onChange={(e) =>
                                onChange(item.id, 'name', e.target.value)
                            }
                            className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
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

const EditRecipePage: React.FC = () => {
    const params = useParams();
    const recipeId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const currentUser = useAuthUser();
    const followingIds = useUserFollowing(currentUser?.uid ?? '');

    const LOCAL_STORAGE_KEY = recipeId
        ? `editRecipeForm_${recipeId}`
        : 'editRecipeForm';

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
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
        null
    );
    const coverImagePreviewRef = useRef<string | null>(null);
    const cookingStepsRef = useRef<StepWithId[]>([]);
    const newIngredientAmountRef = useRef<HTMLInputElement | null>(null);
    const newIngredientNameRef = useRef<HTMLInputElement | null>(null);
    const ingredientHintTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);

    // NY: detailed ingredients
    const [ingredientsDetailed, setIngredientsDetailed] = useState<
        IngredientItem[]
    >([]);
    const [newIngredientName, setNewIngredientName] = useState('');
    const [newIngredientAmount, setNewIngredientAmount] = useState('');
    const [showIngredientAmountIndicator, setShowIngredientAmountIndicator] =
        useState(false);

    const [temperature, setTemperature] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [portions, setPortions] = useState('');
    const [visibility, setVisibility] = useState<RecipeVisibility>('public');
    const [showCoAuthorPicker, setShowCoAuthorPicker] = useState(false);
    const [selectedCoAuthor, setSelectedCoAuthor] =
        useState<SelectedCoAuthor | null>(null);
    const [initialPendingCoAuthorUid, setInitialPendingCoAuthorUid] =
        useState('');

    const [cookingSteps, setCookingSteps] = useState<StepWithId[]>([]);

    const sensorsSteps = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const sensorsIngredients = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
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
                setRecipeData(sanitizeRecipeData(draft.recipeData));
            }

            // ingredients: prioriter detailed, ellers legacy
            if (
                draft.ingredientsDetailed &&
                draft.ingredientsDetailed.length > 0
            ) {
                setIngredientsDetailed(
                    draft.ingredientsDetailed.map((x) => ({
                        id: x.id || makeId(),
                        name: x.name ?? '',
                        amount: x.amount ?? '',
                    }))
                );
            } else if (draft.ingredients && draft.ingredients.length > 0) {
                setIngredientsDetailed(
                    toIngredientItemsFromStrings(draft.ingredients)
                );
            } else if (
                draft.recipeData?.ingredients &&
                draft.recipeData.ingredients.length > 0
            ) {
                setIngredientsDetailed(
                    toIngredientItemsFromStrings(draft.recipeData.ingredients)
                );
            }

            setTemperature(
                draft.temperature ?? draft.recipeData?.temperature ?? ''
            );
            setCookingTime(
                draft.cookingTime ?? draft.recipeData?.cookingTime ?? ''
            );
            setPortions(draft.portions ?? draft.recipeData?.portions ?? '');
            setVisibility(
                draft.recipeData?.visibility === 'private'
                    ? 'private'
                    : 'public'
            );

            const loadedSteps = draft.cookingSteps ?? [];
            setCookingSteps(
                loadedSteps.map((s) => {
                    const storedImage = getStoredStepImage(s);
                    return {
                        ...s,
                        id: s.id || makeId(),
                        imageUrl: s.imageUrl?.trim() || storedImage,
                        linkedRecipe: s.linkedRecipe,
                        imagePreview: storedImage || null,
                        imageFile: null,
                    };
                })
            );

            setNewIngredientName(draft.newIngredientName ?? '');
            setNewIngredientAmount(draft.newIngredientAmount ?? '');

            const prev = draft.coverImagePreview ?? null;
            setCoverImagePreview(
                prev && !prev.startsWith('blob:') ? prev : null
            );
            setSelectedCoAuthor(draft.selectedCoAuthor ?? null);
            setInitialPendingCoAuthorUid(
                draft.selectedCoAuthor?.status === 'pending'
                    ? draft.selectedCoAuthor.uid
                    : ''
            );

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
                const recipeSnap = await getDoc(
                    doc(firestore, 'recipes', recipeId)
                );
                if (!recipeSnap.exists()) return;

                const data = recipeSnap.data() as RecipeDoc;

                const alreadyHasTitle =
                    (recipeData.title ?? '').trim().length > 0;
                if (!alreadyHasTitle) {
                    const acceptedCoAuthor = Array.isArray(data.coAuthors)
                        ? data.coAuthors[0]
                        : undefined;
                    const pendingCoAuthorUid = Array.isArray(
                        data.pendingCoAuthorInviteIds
                    )
                        ? data.pendingCoAuthorInviteIds[0] ?? ''
                        : '';

                    let nextSelectedCoAuthor: SelectedCoAuthor | null = null;

                    if (acceptedCoAuthor?.uid) {
                        nextSelectedCoAuthor = {
                            uid: acceptedCoAuthor.uid,
                            name:
                                acceptedCoAuthor.name?.trim() ||
                                'Kokk uten navn',
                            photoURL: acceptedCoAuthor.photoURL?.trim() || '',
                            status: 'accepted',
                        };
                    } else if (pendingCoAuthorUid) {
                        const usersMap = await fetchManyUsers([
                            pendingCoAuthorUid,
                        ]);
                        const pendingUser = usersMap[pendingCoAuthorUid];
                        nextSelectedCoAuthor = {
                            uid: pendingCoAuthorUid,
                            name:
                                pendingUser?.name?.trim() ||
                                'Kokk uten navn',
                            photoURL: pendingUser?.photoURL?.trim() || '',
                            status: 'pending',
                        };
                    }

                    setRecipeData(sanitizeRecipeData(data));

                    // Ingredients: ny hvis finnes, ellers legacy
                    if (
                        Array.isArray(data.ingredientsDetailed) &&
                        data.ingredientsDetailed.length > 0
                    ) {
                        setIngredientsDetailed(
                            data.ingredientsDetailed.map((x) => ({
                                id: x.id || makeId(),
                                name: x.name ?? '',
                                amount: x.amount ?? '',
                            }))
                        );
                    } else {
                        const legacy = data.ingredients ?? [];
                        setIngredientsDetailed(
                            toIngredientItemsFromStrings(legacy)
                        );
                    }

                    setTemperature(data.temperature ?? '');
                    setCookingTime(data.cookingTime ?? '');
                    setPortions(data.portions ?? '');
                    setVisibility(
                        data.visibility === 'private' ? 'private' : 'public'
                    );

                    const steps = (data.cookingSteps ?? []).map((s) => ({
                        ...s,
                        id: makeId(),
                        imageUrl: s.imageUrl?.trim() || '',
                        linkedRecipe: s.linkedRecipe,
                        imagePreview: s.imageUrl?.trim() || null,
                        imageFile: null,
                    }));
                    setCookingSteps(steps);
                    setSelectedCoAuthor(nextSelectedCoAuthor);
                    setInitialPendingCoAuthorUid(pendingCoAuthorUid);

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

    // Persist draft (ikke lagre blob preview)
    useEffect(() => {
        if (!recipeId) return;
        if (!draftChecked) return;

        const payload: DraftPayload = {
            recipeData: {
                ...recipeData,
                ingredients: ingredientsDetailed
                    .map((x) => x.name)
                    .filter(Boolean),
                temperature,
                cookingTime,
                visibility,
                    cookingSteps: cookingSteps.map((s) => ({
                        title: s.title,
                        description: s.description,
                        imageUrl: getStoredStepImage(s),
                        linkedRecipe: s.linkedRecipe,
                    })),
            },
            ingredientsDetailed,
            ingredients: ingredientsDetailed.map((x) => x.name).filter(Boolean),

            portions,
            temperature,
            cookingTime,

            cookingSteps: cookingSteps.map((s) => ({
                id: s.id,
                title: s.title,
                description: s.description,
                imageUrl: getStoredStepImage(s),
                linkedRecipe: s.linkedRecipe,
                imagePreview: getStoredStepImage(s) || null,
            })),
            newIngredientName,
            newIngredientAmount,
            coverImagePreview: null,
            selectedCoAuthor,
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
        visibility,
        cookingSteps,
        portions,
        newIngredientName,
        newIngredientAmount,
        selectedCoAuthor,
    ]);

    const setTitle = (v: string) => setRecipeData((p) => ({ ...p, title: v }));
    const setDescription = (v: string) =>
        setRecipeData((p) => ({ ...p, description: v }));

    const handleAddIngredient = () => {
        const name = normalizeIngredientName(newIngredientName);
        const amount = normalizeIngredientAmount(newIngredientAmount);
        if (!name) return;

        setIngredientsDetailed((prev) => [
            ...prev,
            { id: makeId(), name, amount },
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
        setIngredientsDetailed((prev) =>
            prev.map((x) => (x.id === id ? { ...x, [field]: value } : x))
        );
    };

    const handleRemoveIngredient = (id: string) => {
        setIngredientsDetailed((prev) => prev.filter((x) => x.id !== id));
    };

    const handleAddStep = () => {
        setCookingSteps((prev) => [
            ...prev,
            {
                id: makeId(),
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
        stepId: string,
        field: 'title' | 'description',
        value: string
    ) => {
        setCookingSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s))
        );
    };

    const handleLinkedRecipeChange = (
        stepId: string,
        linkedRecipe: StepWithId['linkedRecipe'] | null
    ) => {
        setCookingSteps((prev) =>
            prev.map((step) => {
                return {
                    ...step,
                    ...(step.id === stepId
                        ? { linkedRecipe: linkedRecipe ?? undefined }
                        : {}),
                };
            })
        );
    };

    const handleRemoveStep = (stepId: string) => {
        setCookingSteps((prev) => {
            const step = prev.find((s) => s.id === stepId);
            revokeBlobUrl(step?.imagePreview);
            return prev.filter((s) => s.id !== stepId);
        });
    };

    const handleStepImageChange = (
        stepId: string,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setCookingSteps((prev) =>
            prev.map((step) => {
                if (step.id !== stepId) return step;
                revokeBlobUrl(step.imagePreview);
                return {
                    ...step,
                    imageFile: file,
                    imagePreview: URL.createObjectURL(file),
                };
            })
        );
    };

    const handleRemoveStepImage = (stepId: string) => {
        setCookingSteps((prev) =>
            prev.map((step) => {
                if (step.id !== stepId) return step;
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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        revokeBlobUrl(coverImagePreviewRef.current);
        setCoverImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setCoverImagePreview(previewUrl);
    };

    const trimmedTitle = useMemo(
        () => (recipeData.title ?? '').trim(),
        [recipeData.title]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) return alert('Please sign in first.');
        if (!recipeId) return;
        if (!trimmedTitle) return;

        let coverImageUrl = recipeData.coverImage || '';

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
                        `recipe-steps/${user.uid}/${recipeId}/${Date.now()}-${index}-${s.imageFile.name}`
                    );
                    const snapshot = await uploadBytes(imageRef, s.imageFile);
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
                                  coverImage: s.linkedRecipe.coverImage || '',
                              },
                          }
                        : {}),
                };
            })
        );

        const ingredientsForDb = ingredientsDetailed
            .map((x) => ({
                id: x.id,
                name: normalizeIngredientName(x.name),
                amount: normalizeIngredientAmount(x.amount),
            }))
            .filter((x) => x.name.length > 0);

        const nextCoAuthors =
            selectedCoAuthor?.status === 'accepted'
                ? [
                      {
                          uid: selectedCoAuthor.uid,
                          name: selectedCoAuthor.name,
                          photoURL: selectedCoAuthor.photoURL || '',
                      },
                  ]
                : [];
        const nextCoAuthorIds =
            selectedCoAuthor?.status === 'accepted'
                ? [selectedCoAuthor.uid]
                : [];
        const nextPendingCoAuthorInviteIds =
            selectedCoAuthor?.status === 'pending'
                ? [selectedCoAuthor.uid]
                : [];

        try {
            await updateDoc(doc(firestore, 'recipes', recipeId), {
                title: trimmedTitle,
                description: recipeData.description,
                image: recipeData.image,
                bgColor: recipeData.bgColor,
                fontStyle: recipeData.fontStyle,
                // legacy
                ingredients: ingredientsForDb.map((x) => x.name),
                // ny
                ingredientsDetailed: ingredientsForDb,

                temperature,
                cookingTime,
                portions,
                visibility,
                cookingSteps: stepsForDb,
                coverImage: coverImageUrl,
                coAuthors: nextCoAuthors,
                coAuthorIds: nextCoAuthorIds,
                pendingCoAuthorInviteIds: nextPendingCoAuthorInviteIds,
                updatedAt: serverTimestamp(),
            });

            if (
                selectedCoAuthor?.status === 'pending' &&
                selectedCoAuthor.uid !== initialPendingCoAuthorUid
            ) {
                await createCoAuthorInviteNotification({
                    actorId: user.uid,
                    actorName:
                        currentUser?.displayName?.trim() || 'En kokk',
                    actorPhotoURL: currentUser?.photoURL || '',
                    inviteeId: selectedCoAuthor.uid,
                    recipeId,
                    recipeTitle: trimmedTitle || 'en oppskrift',
                });
            }

            localStorage.removeItem(LOCAL_STORAGE_KEY);
            router.push(`/user/${user.uid}`);
        } catch (error) {
            console.error('Error updating recipe:', error);
        }
    };

    if (loading) return <div className="p-4">Laster inn oppskrift...</div>;

    return (
        <div className="min-h-screen">
            {showCoAuthorPicker ? (
                <CoAuthorPickerModal
                    followingIds={followingIds}
                    selectedUid={selectedCoAuthor?.uid}
                    onClose={() => setShowCoAuthorPicker(false)}
                    onSelect={(user) =>
                        setSelectedCoAuthor((prev) =>
                            prev?.uid === user.uid && prev.status === 'accepted'
                                ? prev
                                : {
                                      ...user,
                                      status: 'pending',
                                  }
                        )
                    }
                />
            ) : null}

            <div className="mx-auto max-w-xl px-4 py-6 pb-28">
                <div className="mb-4 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100"
                        aria-label="Tilbake"
                        type="button"
                    >
                        <span className="material-symbols-outlined">
                            arrow_back
                        </span>
                    </button>

                    <h1 className="text-lg font-semibold text-slate-900">
                        Rediger oppskrift
                    </h1>

                    <button
                        type="submit"
                        form="edit-recipe-form"
                        className="h-10 px-4 rounded-full brown-button text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition"
                    >
                        Lagre
                    </button>
                </div>
                <form
                    id="edit-recipe-form"
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Basic info */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                            Tittel
                        </label>
                        <input
                            type="text"
                            placeholder="f.eks. Verdens beste lasagne"
                            value={recipeData.title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            required
                        />

                        <label className="block text-sm font-semibold text-slate-900 mt-4 mb-2">
                            Beskrivelse
                        </label>
                        <textarea
                            placeholder="Kort og fristende…"
                            value={recipeData.description}
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
                                        Inviter eller bytt ut medforfatter fra
                                        kokkene du følger.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowCoAuthorPicker(true)}
                                    className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                                >
                                    {selectedCoAuthor ? 'Bytt' : 'Velg kokk'}
                                </button>
                            </div>

                            {selectedCoAuthor ? (
                                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#fbfaf4] p-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e5d7]">
                                        {selectedCoAuthor.photoURL ? (
                                            <img
                                                src={selectedCoAuthor.photoURL}
                                                alt={selectedCoAuthor.name}
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
                                            {selectedCoAuthor.name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">
                                            {selectedCoAuthor.status ===
                                            'accepted'
                                                ? 'Er allerede medforfatter.'
                                                : 'Venter på svar på invitasjonen.'}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedCoAuthor(null)}
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

                    {/* Cover */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-base font-semibold text-slate-900">
                                Forsidebilde
                            </h2>
                            {(coverImagePreview || recipeData.coverImage) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        revokeBlobUrl(
                                            coverImagePreviewRef.current
                                        );
                                        setCoverImageFile(null);
                                        setCoverImagePreview(null);
                                        setRecipeData((p) => ({
                                            ...p,
                                            coverImage: '',
                                        }));
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

                        {coverImagePreview ? (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                <img
                                    src={coverImagePreview}
                                    alt="Cover Preview"
                                    className="w-full max-h-72 object-cover"
                                />
                            </div>
                        ) : recipeData.coverImage ? (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                <img
                                    src={recipeData.coverImage}
                                    alt="Cover"
                                    className="w-full max-h-72 object-cover"
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* Ingredients + meta */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <h2 className="text-base font-semibold text-slate-900 mb-3">
                            Ingredienser
                        </h2>

                        {/* sortable list */}
                        <div className="mt-4">
                            <DndContext
                                sensors={sensorsIngredients}
                                collisionDetection={closestCenter}
                                onDragEnd={onDragEndIngredients}
                            >
                                <SortableContext
                                    items={ingredientsDetailed.map((x) => x.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-3">
                                        {ingredientsDetailed.map(
                                            (item, index) => (
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
                                            )
                                        )}

                                        {ingredientsDetailed.length === 0 && (
                                            <p className="text-slate-600">
                                                Ingrediensene dukker opp her.
                                                Legg dem til én etter én, og dra
                                                for å sortere.
                                            </p>
                                        )}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>

                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-700">
                                    playlist_add
                                </span>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Legg til neste ingrediens
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="relative">
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
                                    placeholder="Ingrediens (f.eks. Hvetemel)"
                                    value={newIngredientName}
                                    onChange={(e) =>
                                        setNewIngredientName(e.target.value)
                                    }
                                    className="w-full rounded-2xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-200 disabled:opacity-50"
                                disabled={!newIngredientName.trim()}
                            >
                                <span className="material-symbols-outlined text-base">
                                    add
                                </span>
                                Legg til ingrediens
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 ">
                            {' '}
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
                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition"
                            >
                                <span className="material-symbols-outlined text-base">
                                    add
                                </span>
                                Legg til
                            </button>
                        </div>

                        <DndContext
                            sensors={sensorsSteps}
                            collisionDetection={closestCenter}
                            onDragEnd={onDragEndSteps}
                        >
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
                                            excludeRecipeId={recipeId}
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
