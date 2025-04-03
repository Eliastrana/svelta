"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/firebase";
import { useSwipeable } from "react-swipeable";
import LikeButton from "@/app/components/LikeButton";
import CommentSection from "@/app/components/CommentSection";

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
    ingredients?: string[]; // New
    temperature?: string;   // New
    cookingTime?: string;   // New
    userId: string; // Must exist in Firestore
}

const RecipeDetail = () => {
    const { id } = useParams();
    const router = useRouter();

    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);
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

    const userName = creatorDoc?.name || "Ukjent brukernavn";
    const userPhoto = creatorDoc?.photoURL || "";

    // Build slides array: page 0 for the "intro," then each cooking step
    const slides = [
        <div key="intro" className="w-full h-full px-4">
            <div
                className="w-64 h-64 md:w-64 md:h-64 overflow-hidden flex items-center justify-center"
                style={{ filter: "invert(1)" }}
                dangerouslySetInnerHTML={{
                    __html: recipe.image
                        .replace(/class="[^"]*bg-white[^"]*"/, 'class=""')
                        .replace(/fill="white"/, 'fill="none"')
                        .replace(/width="\+"/, "")
                        .replace(/height="\d+"/, "")
                        .replace(
                            /<svg([^>]*?)>/,
                            `<svg$1 viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
                        ),
                }}
            />
            <h1 className="md:text-8xl text-5xl font-bold mb-2 ">{recipe.title}</h1>
            <p className="mb-4 text-lg">{recipe.description}</p>
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
        <div>
            <div
                style={{backgroundColor: recipe.bgColor, fontFamily: recipe.fontStyle}}
                className="max-w-4xl md:mx-auto m-2 p-4 rounded-lg"
            >
                <button onClick={() => router.back()} className="mb-4">
                    <span className="material-symbols-outlined">close</span>
                </button>
                {/* Swipeable container */}
                <div
                    {...handlers}
                    className="overflow-hidden relative w-full h-[32rem] md:h-full"
                >
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

            <div className="flex justify-center space-x-2 mt-4">
                {slides.map((_, idx) => (
                    <div
                        key={idx}
                        onClick={() => setPageIndex(idx)}
                        className={`w-3 h-3 rounded-full cursor-pointer ${idx === pageIndex ? "dark-purple-bg" : "bg-gray-300"}`}
                    />
                ))}
            </div>


            <div className="flex space-x-2 items-center max-w-4xl mx-auto p-2">
                <div className="h-16 w-16 rounded-full overflow-hidden">
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

            {/* New Section: Ingredient List, Temperature, and Cooking Time */}
            <div className="max-w-4xl mx-auto p-4 md:flex md:justify-between">
                <div>
                    {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold">Ingredienser</h2>
                            <ul className="list-disc pl-5">
                                {recipe.ingredients.map((ing, idx) => (
                                    <li key={idx}>{ing}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <div>
                    {recipe.temperature && (
                        <p className="mt-2">
                            <strong>Temperatur:</strong> {recipe.temperature}
                        </p>
                    )}
                    {recipe.cookingTime && (
                        <p className="mt-2">
                            <strong>Koketid:</strong> {recipe.cookingTime}
                        </p>
                    )}
                </div>
            </div>

            {/* Like button and Comment section */}
            <div className="max-w-4xl mx-auto p-2">
                <LikeButton recipeId={recipe.id}/>
                <CommentSection recipeId={recipe.id}/>
            </div>
        </div>
    );
};

export default RecipeDetail;
