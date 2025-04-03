// pages/index.tsx
"use client";
import { useEffect, useState } from "react";
import { firestore, auth } from "@/firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc
} from "firebase/firestore";
import UserSearchModal from "@/app/components/UserSearchModal";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";


interface CookingStep {
    title: string;
    description: string;
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
    createdAt: Date; // Added createdAt field
}

interface UserDoc {
    name?: string;
    following?: string[];
    photoURL?: string;
}

const Home = () => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [following, setFollowing] = useState<string[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [usersMap, setUsersMap] = useState<Record<string, UserDoc>>({});

    const router = useRouter();

    // 1. Auth state
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribeAuth();
    }, []);

    // 2. Fetch "following" for current user
    useEffect(() => {
        if (!user) {
            setFollowing([]);
            return;
        }
        const currentUserRef = doc(firestore, "users", user.uid);
        getDoc(currentUserRef).then((docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as { following: string[] };
                setFollowing(data.following || []);
            } else {
                setFollowing([]);
            }
        });
    }, [user]);

    // 3. Once we have recipes, gather userIds => fetch user docs
    useEffect(() => {
        const uniqueUserIds = Array.from(new Set(recipes.map((r) => r.userId)));
        if (uniqueUserIds.length === 0) return;

        const fetchUsers = async () => {
            const dataMap: Record<string, UserDoc> = {};
            await Promise.all(
                uniqueUserIds.map(async (uid) => {
                    const userDocRef = doc(firestore, "users", uid);
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        dataMap[uid] = docSnap.data() as UserDoc;
                    }
                })
            );
            setUsersMap(dataMap);
        };

        fetchUsers();
    }, [recipes]);

    // 4. Query recipes from followed users
    useEffect(() => {
        if (!user) {
            setRecipes([]);
            setLoading(false);
            return;
        }
        if (following.length === 0) {
            setRecipes([]);
            setLoading(false);
            return;
        }
        const recipesQuery = query(
            collection(firestore, "recipes"),
            where("userId", "in", following)
        );
        const unsubscribeRecipes = onSnapshot(recipesQuery, (snapshot) => {
            const recipesData: Recipe[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<Recipe, "id">)
            }));
            setRecipes(recipesData);
            setLoading(false);
        });
        return () => unsubscribeRecipes();
    }, [user, following]);

    if (loading) return <div className="p-4">Laster...</div>;

    return (
        <div className="max-w-4xl md:w-2/3 mx-auto md:mb-20 p-2 ">
            <div className="flex items-center justify-between mb-4">
                <h1 className="md:text-6xl text-4xl font-bold mb-4">Nyeste oppskrifter</h1>
                <div
                    onClick={() => {
                        if (user) {
                            router.push(`/user/${user.uid}`);
                        } else {
                            alert("No user logged in");
                        }
                    }}
                    className="flex items-center justify-between mb-4 cursor-pointer"
                >
                    {/* Possibly a user icon or "Search" button */}
                </div>
            </div>

            <div className="h-2">
                {recipes.length === 0 ? (

                    <div>
                    <p className="text-2xl">Ingen tilgjengelige oppskrifter. Prøv å følg noen for å se oppskrifter!</p>

                    <button
                        onClick={() => setShowModal(true)}
                        className="confirm-button mt-4 p-2 rounded-lg cursor-pointer hover:underline"
                        >
                        Søk etter kokker
                    </button>
                    </div>
                ) : (
                    <div className="snap-y snap-mandatory h-[40rem] md:mt-20  mt-8 white-text">
                        <div className="grid grid-cols-1 md:gap-24 gap-8">
                            {recipes.map((recipe) => {

                                const userDoc = usersMap[recipe.userId];
                                const userName = userDoc?.name || "Ukjent brukernavn";
                                const userPhoto = userDoc?.photoURL;



                                return (

                                        <div key={recipe.id} className="flex items-center ">

                                            <div
                                                onClick={() => router.push(`/recipe/${recipe.id}`)}
                                                className="bg-[#73628A] md:p-12 p-4 rounded-lg w-full cursor-pointer shadow-lg"
                                            >
                                                <div
                                                    className="w-64 h-64 md:w-64 md:h-64 overflow-hidden flex items-center justify-center"
                                                    style={{filter: "invert(1)"}}
                                                    dangerouslySetInnerHTML={{
                                                        __html: recipe.image
                                                            .replace(/class="[^"]*bg-white[^"]*"/, 'class=""')
                                                            .replace(/fill="white"/, 'fill="none"')
                                                            .replace(/width="\+"/, '')
                                                            .replace(/height="\d+"/, '')
                                                            .replace(
                                                                /<svg([^>]*?)>/,
                                                                `<svg$1 viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
                                                            ),
                                                    }}
                                                />


                                                <h1 className="md:text-8xl text-5xl font-bold">
                                                    {recipe.title}
                                                </h1>

                                                <p className="text-lg mt-2">{recipe.description}</p>


                                                <div className="flex space-x-2 items-center mt-4">

                                                    <div className="h-10 w-10 rounded-full overflow-hidden">
                                                        {userPhoto && (
                                                            <img
                                                                src={userPhoto}
                                                                alt="Creator Photo"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                    </div>


                                                    <div>
                                                        <p className="text-xl font-semibold">{userName}</p>

                                                        <p className="text-xs">
                                                            {
                                                                recipe.createdAt
                                                                    ? (recipe.createdAt as unknown as Timestamp).toDate().toLocaleString("nb-NO", {
                                                                        timeZone: "Europe/Oslo",
                                                                        day: "2-digit",
                                                                        month: "2-digit",
                                                                        year: "numeric",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })
                                                                    : "Ingen dato funnet"
                                                            }
                                                        </p>

                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {showModal && <UserSearchModal onClose={() => setShowModal(false)}/>}
        </div>
    );
};

export default Home;
