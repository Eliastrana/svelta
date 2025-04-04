'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from '@/firebase';
import DrawingCanvas from '@/app/components/DrawingCanvas';

interface CookingStep {
    title: string;
    description: string;
}

interface Recipe {
    title: string;
    description: string;
    image: string; // stored SVG string
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
}

const EditRecipePage = () => {
    const { id } = useParams();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [svgData, setSvgData] = useState('');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [fontStyle, setFontStyle] = useState('sans-serif');
    const [cookingSteps, setCookingSteps] = useState<CookingStep[]>([]);
    const [loading, setLoading] = useState(true);

    const colorOptions = [
        '#ffffff',
        '#ffcccc',
        '#ccffcc',
        '#ccccff',
        '#ffffcc',
    ];

    useEffect(() => {
        if (!id) return;
        const fetchRecipe = async () => {
            const docRef = doc(firestore, 'recipes', id as string);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Recipe;
                setTitle(data.title || '');
                setDescription(data.description || '');
                setSvgData(data.image || '');
                setBgColor(data.bgColor || '#ffffff');
                setFontStyle(data.fontStyle || 'sans-serif');
                setCookingSteps(data.cookingSteps || []);
            }
            setLoading(false);
        };
        fetchRecipe();
    }, [id]);

    const handleAddStep = () => {
        setCookingSteps([...cookingSteps, { title: '', description: '' }]);
    };

    const handleStepChange = (
        index: number,
        field: 'title' | 'description',
        value: string
    ) => {
        const updatedSteps = cookingSteps.map((step, idx) =>
            idx === index ? { ...step, [field]: value } : step
        );
        setCookingSteps(updatedSteps);
    };

    const handleRemoveStep = (index: number) => {
        setCookingSteps(cookingSteps.filter((_, idx) => idx !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert('Please sign in first.');
        try {
            const docRef = doc(firestore, 'recipes', id as string);
            await updateDoc(docRef, {
                title,
                description,
                image: svgData,
                bgColor,
                fontStyle,
                cookingSteps,
            });
            router.push(`/user/${user.uid}`);
        } catch (error) {
            console.error('Error updating recipe:', error);
        }
    };

    if (loading) {
        return <div className="p-4">Laster inn oppskrift...</div>;
    }

    return (
        <div className="max-w-lg mx-auto p-4">
            <h1 className="text-4xl font-bold mb-4">Rediger oppskrift</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    placeholder="Tittel"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border p-2 rounded"
                    required
                />
                <textarea
                    placeholder="Beskrivelse"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border p-2 rounded"
                    required
                />
                <div>
                    <label className="block mb-1">Tegn maten</label>
                    <DrawingCanvas
                        onChange={(svg) => {
                            setSvgData(svg);
                        }}
                    />
                    <p className="mt-2 text-sm">Nåværende bilde (fra DB):</p>
                    <div
                        className="border"
                        dangerouslySetInnerHTML={{ __html: svgData }}
                    />
                </div>
                <div>
                    <label className="block mb-1">Bakgrunnsfarge</label>
                    <div className="flex flex-wrap gap-4">
                        {colorOptions.map((color) => (
                            <label
                                key={color}
                                className="flex items-center space-x-2"
                            >
                                <input
                                    type="radio"
                                    name="bgColor"
                                    value={color}
                                    checked={bgColor === color}
                                    onChange={() => setBgColor(color)}
                                />
                                <div
                                    className="w-6 h-6 border rounded"
                                    style={{ backgroundColor: color }}
                                />
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block mb-1">Font</label>
                    <select
                        value={fontStyle}
                        onChange={(e) => setFontStyle(e.target.value)}
                        className="w-full border p-2 rounded"
                    >
                        <option value="sans-serif">Sans-serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                    </select>
                </div>
                <div>
                    <h2 className="text-xl font-bold mb-2">Steg</h2>
                    {cookingSteps.map((step, index) => (
                        <div key={index} className="border p-2 mb-2 rounded">
                            <input
                                type="text"
                                placeholder="Stegtittel"
                                value={step.title}
                                onChange={(e) =>
                                    handleStepChange(
                                        index,
                                        'title',
                                        e.target.value
                                    )
                                }
                                className="w-full border p-2 rounded mb-2"
                                required
                            />
                            <textarea
                                placeholder="Stegbeskrivelse"
                                value={step.description}
                                onChange={(e) =>
                                    handleStepChange(
                                        index,
                                        'description',
                                        e.target.value
                                    )
                                }
                                className="w-full border p-2 rounded mb-2"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => handleRemoveStep(index)}
                                className="py-1 px-2 rounded cursor-pointer"
                            >
                                <span className="material-symbols-outlined">
                                    delete
                                </span>
                            </button>
                        </div>
                    ))}
                    <div
                        onClick={handleAddStep}
                        className="flex items-center mb-2 cursor-pointer"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <button
                            type="button"
                            className="items-center justify-center text-white p-2 rounded"
                        >
                            Legg til steg
                        </button>
                    </div>
                </div>
                <div className="flex items-center mb-2 justify-end cursor-pointer">
                    <span className="material-symbols-outlined">upload</span>
                    <button type="submit" className="text-white p-2 rounded">
                        Oppdater
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditRecipePage;
