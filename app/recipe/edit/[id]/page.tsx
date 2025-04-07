'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RecipeData } from '@/app/types/RecipeData';

const EditRecipePage: React.FC = () => {
    const params = useParams();
    const recipeId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();

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
    const [loading, setLoading] = useState(true);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
    const [newIngredient, setNewIngredient] = useState('');

    // Use a key specific to this recipe's edit form.
    const LOCAL_STORAGE_KEY = recipeId ? `editRecipeForm_${recipeId}` : 'editRecipeForm';

    const hasFetched = React.useRef(false);

    // Fetch recipe data from Firestore if not already fetched.
    useEffect(() => {
        if (!recipeId || hasFetched.current) return;
        const fetchRecipe = async () => {
            const recipeDocRef = doc(firestore, 'recipes', recipeId);
            const recipeSnap = await getDoc(recipeDocRef);
            if (recipeSnap.exists()) {
                const data = recipeSnap.data() as RecipeData;
                setRecipeData((prev) => {
                    // Only update if there is a meaningful difference.
                    if (prev.title !== data.title || prev.description !== data.description) {
                        return data;
                    }
                    return prev;
                });
            }
            setLoading(false);
            hasFetched.current = true;
        };
        fetchRecipe();
    }, [recipeId]);

    // Load persisted form state from localStorage on mount.
    useEffect(() => {
        if (!recipeId) return;
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            const formData = JSON.parse(savedData);
            if (formData.recipeData) {
                setRecipeData(formData.recipeData);
            }
            if (formData.newIngredient !== undefined) {
                setNewIngredient(formData.newIngredient);
            }
            if (formData.coverImagePreview) {
                setCoverImagePreview(formData.coverImagePreview);
            }
        }
    }, [recipeId, LOCAL_STORAGE_KEY]);

    // Persist form state (excluding Timestamp fields) to localStorage whenever a dependency changes.
    useEffect(() => {
        if (!recipeId) return;
        const formData = {
            recipeData,
            newIngredient,
            coverImagePreview,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
    }, [recipeId, recipeData, newIngredient, coverImagePreview, LOCAL_STORAGE_KEY]);

    const handleChange = (field: keyof RecipeData, value: string) => {
        setRecipeData((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddIngredient = () => {
        if (newIngredient.trim()) {
            setRecipeData((prev) => ({
                ...prev,
                ingredients: [...(prev.ingredients || []), newIngredient.trim()],
            }));
            setNewIngredient('');
        }
    };

    const handleRemoveIngredient = (index: number) => {
        setRecipeData((prev) => ({
            ...prev,
            ingredients: (prev.ingredients || []).filter((_, idx) => idx !== index),
        }));
    };

    // --- Cooking Steps Handlers ---
    const handleAddCookingStep = () => {
        setRecipeData((prev) => ({
            ...prev,
            cookingSteps: [...prev.cookingSteps, { title: '', description: '' }],
        }));
    };

    const handleCookingStepChange = (
        index: number,
        field: 'title' | 'description',
        value: string
    ) => {
        setRecipeData((prev) => {
            const updatedSteps = prev.cookingSteps.map((step, idx) =>
                idx === index ? { ...step, [field]: value } : step
            );
            return { ...prev, cookingSteps: updatedSteps };
        });
    };

    const handleRemoveCookingStep = (index: number) => {
        setRecipeData((prev) => ({
            ...prev,
            cookingSteps: prev.cookingSteps.filter((_, idx) => idx !== index),
        }));
    };
    // -------------------------------

    // Drag & drop style image uploader.
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImageFile(file);
            const previewUrl = URL.createObjectURL(file);
            setCoverImagePreview(previewUrl);
        }
    };

    // Clean up the object URL when the preview changes or component unmounts.
    useEffect(() => {
        return () => {
            if (coverImagePreview) {
                URL.revokeObjectURL(coverImagePreview);
            }
        };
    }, [coverImagePreview]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert('Please sign in first.');

        let coverImageUrl = recipeData.coverImage || '';
        if (coverImageFile) {
            const imageRef = ref(
                storage,
                `recipe-covers/${user.uid}-${Date.now()}-${coverImageFile.name}`
            );
            const snapshot = await uploadBytes(imageRef, coverImageFile);
            coverImageUrl = await getDownloadURL(snapshot.ref);
        }

        try {
            const recipeDocRef = doc(firestore, 'recipes', recipeId!);
            await updateDoc(recipeDocRef, {
                ...recipeData,
                coverImage: coverImageUrl,
                updatedAt: serverTimestamp(),
            });
            // Clear persisted state after successful update.
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            router.push(`/user/${user.uid}`);
        } catch (error) {
            console.error('Error updating recipe:', error);
        }
    };

    if (loading) return <div className="p-4">Laster inn oppskrift...</div>;

    return (
        <div className="max-w-lg mx-auto p-4">
            <h2 className="text-4xl font-bold mb-4">Rediger oppskrift</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    placeholder="Tittel"
                    value={recipeData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full border-2 p-2 rounded"
                    required
                />
                <textarea
                    placeholder="Beskrivelse"
                    value={recipeData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full border-2 p-2 rounded"
                    required
                />
                {/* Uncomment if needed for SVG editing.
        <div>
          <h1 className="block text-xl mb-1">Tegn maten 👨‍🎨</h1>
          <DrawingCanvas onChange={(svg) => handleChange('image', svg)} />
          <p className="mt-2 text-sm">Nåværende bilde (fra DB):</p>
          <div className="border" dangerouslySetInnerHTML={{ __html: recipeData.image }} />
        </div>
        */}
                <div>
                    <label className="block mb-2 text-xl font-bold">Forsidebilde</label>
                    <div className="flex items-center justify-center w-full">
                        <label
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#73628A] transition-all duration-200"
                        >
                            <span className="material-symbols-outlined">upload</span>
                            <p className="mt-2 text-sm text-gray-600">
                                Klikk eller dra og slipp bildet ditt her
                            </p>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageChange}
                            />
                        </label>
                    </div>
                    {coverImagePreview ? (
                        <div className="mt-4">
                            <img
                                src={coverImagePreview}
                                alt="Cover Preview"
                                className="w-full max-h-60 object-contain rounded"
                            />
                        </div>
                    ) : recipeData.coverImage ? (
                        <div className="mt-2">
                            <img
                                src={recipeData.coverImage}
                                alt="Cover"
                                className="w-full rounded"
                            />
                        </div>
                    ) : null}
                </div>
                <div>
                    <h2 className="block font-bold mb-1 text-xl">Bakgrunnsfarge</h2>
                    <div className="flex flex-wrap gap-4">
                        {['#ffffff', '#d5d0dc', '#9d91ad', '#d89cf6', '#f6c3e5'].map(
                            (color) => (
                                <label key={color} className="cursor-pointer">
                                    <input
                                        type="radio"
                                        name="bgColor"
                                        value={color}
                                        checked={recipeData.bgColor === color}
                                        onChange={() => handleChange('bgColor', color)}
                                        className="sr-only"
                                    />
                                    <div
                                        className={`w-12 h-12 border-2 rounded-full transition ${
                                            recipeData.bgColor === color ? 'ring-2' : ''
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                </label>
                            )
                        )}
                    </div>
                </div>
                <div>
                    <h1 className="block mb-1 text-xl">Font</h1>
                    <select
                        value={recipeData.fontStyle}
                        onChange={(e) => handleChange('fontStyle', e.target.value)}
                        className="w-full border-2 p-2 rounded"
                        style={{ fontFamily: recipeData.fontStyle }}
                    >
                        {[
                            { name: 'Raleway', value: "'Raleway', sans-serif" },
                            { name: 'Righteous', value: "'Righteous', cursive" },
                            { name: 'Playfair Display', value: "'Playfair Display', serif" },
                            { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
                            { name: 'Lobster', value: "'Lobster', cursive" },
                        ].map((font) => (
                            <option key={font.name} value={font.value} style={{ fontFamily: font.value }}>
                                {font.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Ingredients Section */}
                <div>
                    <h2 className="text-xl font-bold mb-2">Ingredienser</h2>
                    <div className="flex space-x-2 mb-2">
                        <input
                            type="text"
                            placeholder="Legg til ingrediens..."
                            value={newIngredient}
                            onChange={(e) => setNewIngredient(e.target.value)}
                            className="flex-grow border p-2 rounded"
                        />
                        <button
                            type="button"
                            onClick={handleAddIngredient}
                            className="px-4 py-2 confirm-button rounded"
                        >
                            Legg til
                        </button>
                    </div>
                    {recipeData.ingredients && recipeData.ingredients.length > 0 && (
                        <ul className="list-disc pl-5 mb-4">
                            {recipeData.ingredients.map((ing, idx) => (
                                <li key={idx} className="flex items-center space-x-2">
                                    <span>{ing}</span>
                                    <button type="button" onClick={() => handleRemoveIngredient(idx)}>
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="mb-4">
                        <label className="block mb-1 font-bold text-xl">Temperatur</label>
                        <input
                            type="text"
                            placeholder="f.eks. 200°C"
                            value={recipeData.temperature}
                            onChange={(e) => handleChange('temperature', e.target.value)}
                            className="w-full border-2 p-2 rounded"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block font-bold mb-1 text-xl">Koketid</label>
                        <input
                            type="text"
                            placeholder="f.eks. 45 minutter"
                            value={recipeData.cookingTime}
                            onChange={(e) => handleChange('cookingTime', e.target.value)}
                            className="w-full border-2 p-2 rounded"
                        />
                    </div>
                </div>

                <div>
                    <h2 className="text-xl mb-2">Steg</h2>
                    {recipeData.cookingSteps.length > 0 &&
                        recipeData.cookingSteps.map((step, index) => (
                            <div key={index} className="border-2 p-2 mb-2 rounded">
                                <input
                                    type="text"
                                    placeholder="Stegtittel"
                                    value={step.title}
                                    onChange={(e) =>
                                        handleCookingStepChange(index, 'title', e.target.value)
                                    }
                                    className="w-full border p-2 rounded mb-2"
                                    required
                                />
                                <textarea
                                    placeholder="Stegbeskrivelse"
                                    value={step.description}
                                    onChange={(e) =>
                                        handleCookingStepChange(index, 'description', e.target.value)
                                    }
                                    className="w-full border p-2 rounded mb-2"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCookingStep(index)}
                                    className="py-1 px-2 rounded cursor-pointer"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        ))}
                    <button
                        type="button"
                        onClick={handleAddCookingStep}
                        className="flex items-center px-4 py-2 confirm-button rounded"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span className="ml-2">Legg til steg</span>
                    </button>
                </div>

                <div className="flex items-center confirm-button rounded-lg w-fit p-1 mb-2 justify-end cursor-pointer">
                    <span className="material-symbols-outlined">upload</span>
                    <button type="submit" className="p-2 rounded cursor-pointer">
                        Oppdater
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditRecipePage;
