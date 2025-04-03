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

    if (loading) return <div className="p-4">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold mb-4">Nyeste oppskrifter</h1>
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
                    <p>Ingen tilgjengelige oppskrifter. Prøv å følg noen for å se oppskrifter!</p>
                ) : (
                    <div className="snap-y snap-mandatory h-[40rem]">
                        <div className="grid grid-cols-1 gap-16">
                            {recipes.map((recipe) => {
                                // -----------
                                // THIS is the important part:
                                // We get the creator's doc from usersMap
                                const userDoc = usersMap[recipe.userId];

                                const userName = userDoc?.name || "Ukjent brukernavn";

                                const userPhoto = userDoc?.photoURL;


                                return (
                                    <div
                                        key={recipe.id}
                                        onClick={() => router.push(`/recipe/${recipe.id}`)}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center">
                                            {/* The recipe's SVG */}
                                            <div
                                                className="h-32 w-32 rounded-full overflow-hidden"
                                                style={{ filter: "invert(1)" }}
                                                dangerouslySetInnerHTML={{
                                                    __html: recipe.image
                                                        .replace(/class="[^"]*bg-white[^"]*"/g, 'class=""')
                                                        .replace(/fill="white"/g, 'fill="none"')
                                                        .replace(/width="\d+"/, "")
                                                        .replace(/height="\d+"/, "")
                                                        .replace(
                                                            /<svg([^>]*?)>/,
                                                            `<svg$1 viewBox="0 0 300 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
                                                        )
                                                }}
                                            />

                                            <div>

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


                                                    <p className="text-xl font-semibold">{userName}</p>
                                                </div>

                                                <h1 className="md:text-8xl text-5xl font-bold">
                                                    {recipe.title}
                                                </h1>
                                                <p className="text-lg">{recipe.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {showModal && <UserSearchModal onClose={() => setShowModal(false)} />}
        </div>
    );
};

export default Home;
