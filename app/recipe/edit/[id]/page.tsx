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
    const [newIngredient, setNewIngredient] = useState('');

    const hasFetched = React.useRef(false);

    useEffect(() => {
        if (!recipeId || hasFetched.current) return;
        const fetchRecipe = async () => {
            const recipeDocRef = doc(firestore, 'recipes', recipeId);
            const recipeSnap = await getDoc(recipeDocRef);
            if (recipeSnap.exists()) {
                const data = recipeSnap.data() as RecipeData;
                setRecipeData((prev) => {
                    // Only update if the title or description (or any field you care about) is different.
                    if (
                        prev.title !== data.title ||
                        prev.description !== data.description
                    ) {
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

    const handleChange = (field: keyof RecipeData, value: string) => {
        setRecipeData((prev) => ({ ...prev, [field]: value }));
    };

    // const handleAddStep = () => {
    //     setRecipeData((prev) => ({
    //         ...prev,
    //         cookingSteps: [...prev.cookingSteps, { title: '', description: '' }],
    //     }));
    // };
    //
    // const handleStepChange = (
    //     index: number,
    //     field: 'title' | 'description',
    //     value: string
    // ) => {
    //     setRecipeData((prev) => {
    //         const updatedSteps = prev.cookingSteps.map((step, idx) =>
    //             idx === index ? { ...step, [field]: value } : step
    //         );
    //         return { ...prev, cookingSteps: updatedSteps };
    //     });
    // };
    //
    // const handleRemoveStep = (index: number) => {
    //     setRecipeData((prev) => ({
    //         ...prev,
    //         cookingSteps: prev.cookingSteps.filter((_, idx) => idx !== index),
    //     }));
    // };

    const handleAddIngredient = () => {
        if (newIngredient.trim()) {
            setRecipeData((prev) => ({
                ...prev,
                ingredients: [
                    ...(prev.ingredients || []),
                    newIngredient.trim(),
                ],
            }));
            setNewIngredient('');
        }
    };

    const handleRemoveIngredient = (index: number) => {
        setRecipeData((prev) => ({
            ...prev,
            ingredients: (prev.ingredients || []).filter(
                (_, idx) => idx !== index
            ),
        }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImageFile(file);
        }
    };

    // const handleSvgChange = React.useCallback((svg: string) => {
    //     setRecipeData((prev) => {
    //         // Only update if the SVG has actually changed
    //         if (prev.image === svg) {
    //             return prev;
    //         }
    //         return { ...prev, image: svg };
    //     });
    // }, []);

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
            router.push(`/user/${user.uid}`);
        } catch (error) {
            console.error('Error updating recipe:', error);
        }
    };

    if (loading) return <div className="p-4">Laster inn oppskrift...</div>;

    return (
        <div className="max-w-lg mx-auto p-4">
            <h1 className="text-4xl font-bold mb-4">Rediger oppskrift</h1>
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
                    onChange={(e) =>
                        handleChange('description', e.target.value)
                    }
                    className="w-full border-2 p-2 rounded"
                    required
                />
                {/*<div>*/}
                {/*    <h1 className="block text-xl mb-1">Tegn maten 👨‍🎨</h1>*/}
                {/*    <DrawingCanvas onChange={handleSvgChange} />*/}
                {/*    <p className="mt-2 text-sm">Nåværende bilde (fra DB):</p>*/}
                {/*    <div*/}
                {/*        className="border"*/}
                {/*        dangerouslySetInnerHTML={{ __html: recipeData.image }}*/}
                {/*    />*/}
                {/*</div>*/}
                <div>
                    <label className="block mb-1 text-xl">Forsidebilde</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                    />
                    {recipeData.coverImage && !coverImageFile && (
                        <div className="mt-2">
                            <img
                                src={recipeData.coverImage}
                                alt="Cover"
                                className="w-full rounded"
                            />
                        </div>
                    )}
                </div>
                <div>
                    <h1 className="block mb-1 text-xl">Bakgrunnsfarge</h1>
                    <div className="flex flex-wrap gap-4">
                        {[
                            '#ffffff',
                            '#d5d0dc',
                            '#9d91ad',
                            '#d89cf6',
                            '#f6c3e5',
                        ].map((color) => (
                            <label key={color} className="cursor-pointer">
                                <input
                                    type="radio"
                                    name="bgColor"
                                    value={color}
                                    checked={recipeData.bgColor === color}
                                    onChange={() =>
                                        handleChange('bgColor', color)
                                    }
                                    className="sr-only"
                                />
                                <div
                                    className={`w-12 h-12 border-2 rounded-full transition ${
                                        recipeData.bgColor === color
                                            ? 'ring-2'
                                            : ''
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <h1 className="block mb-1 text-xl">Font</h1>
                    <select
                        value={recipeData.fontStyle}
                        onChange={(e) =>
                            handleChange('fontStyle', e.target.value)
                        }
                        className="w-full border-2 p-2 rounded"
                        style={{ fontFamily: recipeData.fontStyle }}
                    >
                        {[
                            { name: 'Raleway', value: "'Raleway', sans-serif" },
                            {
                                name: 'Righteous',
                                value: "'Righteous', cursive",
                            },
                            {
                                name: 'Playfair Display',
                                value: "'Playfair Display', serif",
                            },
                            {
                                name: 'Roboto Mono',
                                value: "'Roboto Mono', monospace",
                            },
                            { name: 'Lobster', value: "'Lobster', cursive" },
                        ].map((font) => (
                            <option
                                key={font.name}
                                value={font.value}
                                style={{ fontFamily: font.value }}
                            >
                                {font.name}
                            </option>
                        ))}
                    </select>
                </div>
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
                    {recipeData.ingredients &&
                        recipeData.ingredients.length > 0 && (
                            <ul className="list-disc pl-5 mb-4">
                                {recipeData.ingredients.map((ing, idx) => (
                                    <li
                                        key={idx}
                                        className="flex items-center space-x-2"
                                    >
                                        <span>{ing}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveIngredient(idx)
                                            }
                                        >
                                            <span className="material-symbols-outlined">
                                                delete
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    <div className="mb-4">
                        <label className="block mb-1 text-xl">Temperatur</label>
                        <input
                            type="text"
                            placeholder="f.eks. 200°C"
                            value={recipeData.temperature}
                            onChange={(e) =>
                                handleChange('temperature', e.target.value)
                            }
                            className="w-full border-2 p-2 rounded"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1 text-xl">Koketid</label>
                        <input
                            type="text"
                            placeholder="f.eks. 45 minutter"
                            value={recipeData.cookingTime}
                            onChange={(e) =>
                                handleChange('cookingTime', e.target.value)
                            }
                            className="w-full border-2 p-2 rounded"
                        />
                    </div>
                </div>
                <div className="flex items-center confirm-button rounded-lg w-fit p-1 mb-2 justify-end cursor-pointer">
                    <span className="material-symbols-outlined">upload</span>
                    <button
                        type="submit"
                        className="p-2 rounded cursor-pointer"
                    >
                        Oppdater
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditRecipePage;
