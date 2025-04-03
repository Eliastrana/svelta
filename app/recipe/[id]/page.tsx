"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/firebase";
import { useSwipeable } from "react-swipeable";

interface CookingStep {
    title: string;
    description: string;
}

interface UserDoc {
    name?: string;
    following?: string[];
    photoURL?: string;
}

interface Recipe {
    id: string;
    title: string;
    description: string;
    image: string;
    bgColor: string;
    fontStyle: string;
    cookingSteps: CookingStep[];
    userId: string; // Must exist in Firestore
}

const RecipeDetail = () => {
    const { id } = useParams();
    const router = useRouter();

    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);

    // We'll store the creator's user doc here
    const [creatorDoc, setCreatorDoc] = useState<UserDoc | null>(null);

    // Swipe handlers
    const handleNext = () => {
        if (!recipe) return;
        if (pageIndex < totalPages - 1) {
            setPageIndex((prev) => prev + 1);
        }
    };

    const handlePrev = () => {
        if (pageIndex > 0) {
            setPageIndex((prev) => prev - 1);
        }
    };

    const handlers = useSwipeable({
        onSwipedLeft: handleNext,
        onSwipedRight: handlePrev,
        trackMouse: true,
    });

    // 1. Fetch the recipe by ID
    useEffect(() => {
        if (!id) return;
        (async () => {
            if (!id || Array.isArray(id)) {
                return;
            }
            const recipeDocRef = doc(firestore, "recipes", id);
            const recipeSnap = await getDoc(recipeDocRef);
            if (recipeSnap.exists()) {
                const data = recipeSnap.data() as Omit<Recipe, "id">;
                setRecipe({ id: recipeSnap.id, ...data });
            }
            setLoading(false);
        })();
    }, [id]);

    // 2. Once we have the recipe, fetch the creator's user doc
    useEffect(() => {
        if (!recipe) return;
        (async () => {
            const userDocRef = doc(firestore, "users", recipe.userId);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                setCreatorDoc(userSnap.data() as UserDoc);
            }
        })();
    }, [recipe]);

    if (loading) {
        return <div className="p-4">Laster...</div>;
    }
    if (!recipe) {
        return <div className="p-4">Recipe not found.</div>;
    }

    // Grab creator's name/photo (if they exist)
    const userName = creatorDoc?.name || "Ukjent brukernavn";
    const userPhoto = creatorDoc?.photoURL || "";

    // Build slides array: page 0 for the "intro," then each step
    const slides = [
        <div key="intro" className="w-full h-full px-4">
            {/* The SVG "image" for the recipe */}
            <div
                className="h-64 w-64 md:h-96 md:w-96 rounded-full overflow-hidden"
                style={{ filter: "invert(1)" }}
                dangerouslySetInnerHTML={{
                    __html: recipe.image
                        .replace(/class="[^"]*bg-white[^"]*"/g, 'class=""')
                        .replace(/fill="white"/g, 'fill="none"')
                        .replace(/width="\d+"/, "")
                        .replace(/height="\d+"/, "")
                        .replace(
                            /<svg([^>]*?)>/,
                            `<svg$1 viewBox="0 0 300 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
                        ),
                }}
            />

            <h1 className="md:text-8xl text-5xl font-bold mb-2 ">{recipe.title}</h1>
            <p className="mb-4 text-2xl">{recipe.description}</p>

            {/* The creator info: photo + name */}
            <div className="flex space-x-2 items-center">
                <div className="h-10 w-10 rounded-full overflow-hidden">
                    {userPhoto && (
                        <img
                            src={userPhoto}
                            alt="Creator Photo"
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
                <p className="text-2xl">{userName}</p>
            </div>
        </div>,

        ...recipe.cookingSteps.map((step, i) => (
            <div key={`step-${i}`} className="w-full h-full px-4">
                <h1 className="md:text-6xl text-4xl font-bold mb-2">
                    {i + 1}: {step.title}
                </h1>
                <p className="text-3xl mt-2">{step.description}</p>
            </div>
        )),
    ];

    const totalPages = slides.length;

    return (
        <div
            style={{ backgroundColor: recipe.bgColor, fontFamily: recipe.fontStyle }}
            className="max-w-4xl md:mx-auto m-2 p-4 rounded-lg"
        >
            <button onClick={() => router.back()} className="mb-4">
                <span className="material-symbols-outlined">close</span>
            </button>

            {/* Swipeable container */}
            <div {...handlers} className="overflow-hidden relative w-full h-[32rem] md:h-full">
                <div
                    className="flex transition-transform duration-300 ease-in-out w-full h-full"
                    style={{
                        transform: `translateX(-${pageIndex * 100}%)`,
                    }}
                >
                    {slides.map((slide) => (
                        <div className="w-full flex-shrink-0 h-full" key={slide.key}>
                            {slide}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecipeDetail;
