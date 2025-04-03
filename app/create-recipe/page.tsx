'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, firestore } from "@/firebase";
import DrawingCanvas from "@/app/components/DrawingCanvas";

interface CookingStep {
    title: string;
    description: string;
}

const CreateRecipe = () => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    // Instead of an image URL, we'll store the SVG drawing as a string
    const [svgData, setSvgData] = useState("");
    const [bgColor, setBgColor] = useState("#ffffff");
    const [fontStyle, setFontStyle] = useState("sans-serif");
    const [cookingSteps, setCookingSteps] = useState<CookingStep[]>([]);
    const router = useRouter();

    const fontOptions = [
        { name: "Raleway", value: "'Raleway', sans-serif" },
        { name: "Righteous", value: "'Righteous', cursive" },
        { name: "Playfair Display", value: "'Playfair Display', serif" },
        { name: "Roboto Mono", value: "'Roboto Mono', monospace" },
        { name: "Lobster", value: "'Lobster', cursive" },
    ];


    const colorOptions = ["#ffffff", "#d5d0dc", "#9d91ad", "#d89cf6", "#f6c3e5"];


    // Add a new empty cooking step
    const handleAddStep = () => {
        setCookingSteps([...cookingSteps, { title: "", description: "" }]);
    };

    // Update a specific step field
    const handleStepChange = (
        index: number,
        field: "title" | "description",
        value: string
    ) => {
        const updatedSteps = cookingSteps.map((step, idx) =>
            idx === index ? { ...step, [field]: value } : step
        );
        setCookingSteps(updatedSteps);
    };

    // Remove a step
    const handleRemoveStep = (index: number) => {
        setCookingSteps(cookingSteps.filter((_, idx) => idx !== index));
    };

    // Submit the recipe with the drawn SVG as the image field
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting SVG data:", svgData);

        const user = auth.currentUser;
        if (!user) return alert("Please sign in first.");

        try {
            await addDoc(collection(firestore, "recipes"), {
                title,
                description,
                image: svgData, // store SVG string here
                bgColor,
                fontStyle,
                cookingSteps, // array of cooking steps
                userId: user.uid,
                createdAt: serverTimestamp(),
            });
            router.push("/");
        } catch (error) {
            console.error("Error adding recipe:", error);
        }
    };

    return (
        <div className="max-w-lg mx-auto p-4">
            <h1 className="text-4xl font-bold mb-4">Lag oppskrift</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    placeholder="Tittel"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border-2 p-2 rounded"
                    required
                />
                <textarea
                    placeholder="Beskrivelse"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border-2 p-2 rounded"
                    required
                />

                {/* Drawing canvas for the image */}
                <div>
                    <h1 className="block text-xl mb-1">Tegn maten</h1>
                    <DrawingCanvas
                        onChange={(svg) => {
                            console.log("Received SVG in CreateRecipe:", svg);
                            setSvgData(svg);
                        }}
                    />
                </div>

                <div>
                    <h1 className="block mb-1 text-xl">Bakgrunnsfarge</h1>
                    <div className="flex flex-wrap gap-4">
                        {colorOptions.map((color) => (
                            <label
                                key={color}
                                className="cursor-pointer"
                            >
                                <input
                                    type="radio"
                                    name="bgColor"
                                    value={color}
                                    checked={bgColor === color}
                                    onChange={() => setBgColor(color)}
                                    className="sr-only"
                                />

                                <div
                                    className={`w-12 h-12 border-2 rounded-full transition ${
                                        bgColor === color ? 'ring-2' : ''
                                    }`}
                                    style={{backgroundColor: color}}
                                />
                            </label>
                        ))}
                    </div>

                </div>

                <div>
                    <h1 className="block mb-1 text-xl">Font</h1>
                    <select
                        value={fontStyle}
                        onChange={(e) => setFontStyle(e.target.value)}
                        className="w-full border-2 p-2 rounded"
                        style={{fontFamily: fontStyle}} // Preview selected font
                    >
                        {fontOptions.map((font) => (
                            <option
                                key={font.name}
                                value={font.value}
                                style={{fontFamily: font.value}}
                            >
                                {font.name}
                            </option>
                        ))}
                    </select>
                </div>


                <div>
                    <h2 className="text-xl font-bold mb-2">Steg</h2>
                    {cookingSteps.map((step, index) => (
                        <div key={index} className="border-2 p-2 mb-2 rounded">
                            <input
                                type="text"
                                placeholder="Stegtittel"
                                value={step.title}
                                onChange={(e) => handleStepChange(index, "title", e.target.value)}
                                className="w-full border-2 p-2 rounded mb-2"
                                required
                            />
                            <textarea
                                placeholder="Stegbeskrivelse"
                                value={step.description}
                                onChange={(e) => handleStepChange(index, "description", e.target.value)}
                                className="w-full border-2 p-2 rounded mb-2"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => handleRemoveStep(index)}
                                className=" py-1 px-2 rounded cursor-pointer"
                            >
                                <span className="material-symbols-outlined">
                                    delete
                                </span>
                            </button>
                        </div>
                    ))}

                    <div onClick={handleAddStep}
                         className="flex items-center mb-2 cursor-pointer">
                        <span className="material-symbols-outlined">
                            add
                        </span>
                        <button
                            type="button"
                            className="items-center justify-center p-2 rounded cursor-pointer"
                        >
                            Legg til steg

                        </button>
                    </div>
                </div>

                <div className="flex items-center confirm-button rounded-lg w-fit p-1 mb-2 justify-end cursor-pointer">

                    <span className="material-symbols-outlined">
                        upload
                    </span>

                    <button
                        type="submit"
                        className=" p-2 rounded cursor-pointer"
                    >
                        Last opp
                    </button>

                </div>
            </form>
        </div>
    );
};

export default CreateRecipe;
