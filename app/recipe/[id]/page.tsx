"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
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
  ingredients?: string[];
  temperature?: string;
  cookingTime?: string;
  userId: string;
  coverImage?: string;
}

const RecipeDetail = () => {
  const { id } = useParams();
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [creatorDoc, setCreatorDoc] = useState<UserDoc | null>(null);
  const [followerCount, setFollowerCount] = useState<number>(0);

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

  useEffect(() => {
    if (!recipe) return;
    (async () => {
      const userDocRef = doc(firestore, "users", recipe.userId);
      const userSnap = await getDoc(userDocRef);
      const usersRef = collection(firestore, "users");
      const snapshot = await getDocs(usersRef);
      if (userSnap.exists()) {
        setCreatorDoc(userSnap.data() as UserDoc);
      }
      const followers = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.following &&
          Array.isArray(data.following) &&
          data.following.includes(recipe.userId)
        );
      });

      setFollowerCount(followers.length);
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

  const slides = [
    <div key="intro" className="relative w-full h-full px-4 overflow-hidden">
      {/* Cover image background */}
      {recipe.coverImage && (
        <>
          <img
            src={recipe.coverImage}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover rounded-lg"
          />
          {/* Overlay for darkening */}
          <div className="absolute inset-0 bg-black opacity-30 rounded-lg" />
        </>
      )}

      {/* Slide content */}
      <div
        style={{ fontFamily: recipe.fontStyle }}
        className="relative z-10 max-w-4xl md:mx-auto m-2 p-4 rounded-lg white-text"
      >
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
                `<svg$1 viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`,
              ),
          }}
        />

        <h2 className="md:text-8xl text-5xl font-bold mb-2">{recipe.title}</h2>
        <p className="mb-4 text-lg">{recipe.description}</p>
      </div>
    </div>,
    ...recipe.cookingSteps.map((step, i) => (
      <div key={`step-${i}`} className="w-full h-full rounded-lg md:p-12 p-6 ">
        <h2 className="md:text-6xl text-4xl font-bold mb-2">
          {i + 1}: {step.title}
        </h2>
        <p className="md:text-3xl text-xl mt-2">{step.description}</p>
      </div>
    )),
  ];

  const totalPages = slides.length;

  return (
    <div>
      <div
        style={{ fontFamily: recipe.fontStyle }}
        className="max-w-4xl md:mx-auto m-2 p-2 rounded-lg"
      >
        <button onClick={() => router.back()} className="mb-4">
          <span className="material-symbols-outlined">close</span>
        </button>
        {/* Swipeable container */}
        <div
          {...handlers}
          className="overflow-hidden relative w-full h-[32rem] md:h-full rounded-lg shadow-lg"
          style={{
            fontFamily: recipe.fontStyle,
            backgroundColor: recipe.bgColor,
          }}
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

      <div
        className="flex space-x-2 items-center max-w-4xl mx-auto p-2 cursor-pointer"
        onClick={() => {
          if (creatorDoc) {
            router.push(`/user/${recipe.userId}`);
          }
        }}
      >
        <div className="h-16 w-16 rounded-full overflow-hidden">
          {userPhoto && (
            <img
              src={userPhoto}
              alt="Creator Photo"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="text-2xl">{userName}</h1>
          <p className="text-sm ">
            {followerCount} følger{followerCount === 1 ? "" : "e"}
          </p>
        </div>
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
        <LikeButton recipeId={recipe.id} />
        <CommentSection recipeId={recipe.id} />
      </div>
    </div>
  );
};

export default RecipeDetail;
