// pages/user/[id].tsx

'use client';
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    setDoc,
    collection,
    query,
    onSnapshot,
    where, deleteDoc
} from "firebase/firestore";
import { auth, firestore } from "@/firebase";
import { User, signOut } from "firebase/auth";



interface UserData {
    name?: string;
    following?: string[];
    photoURL?: string;
}

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
}


const createUserDocumentIfNotExists = async (user: User) => {
    const userDocRef = doc(firestore, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            name: user.displayName || "Unnamed User",
            following: [],
            photoURL: user.photoURL || "",
        });
    }
};

auth.onAuthStateChanged(async (user) => {
    if (user) {
        await createUserDocumentIfNotExists(user);
    }
});

const logout = async () => {
    try {
        await signOut(auth);
        window.location.href = "/login"; // or use router.push('/login') if using next/navigation
    } catch (error) {
        console.error("Error logging out:", error);
    }
};


const UserProfile = () => {
    const params = useParams();
    const { id } = params;


    const [userData, setUserData] = useState<UserData | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);

    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);


    useEffect(() => {
        if (!id) return;

        const fetchUser = async () => {
            if (!id || Array.isArray(id)) {
                // handle error or throw
                return;
            }
            const userDocRef = doc(firestore, "users", id);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                setUserData(userSnap.data() as UserData);
            } else {
                console.error("User not found in Firestore");
                setUserData(null);
            }
        };

        fetchUser();

        // Check if the current user is following this profile
        if (auth.currentUser) {
            const currentUserRef = doc(firestore, "users", auth.currentUser.uid);
            getDoc(currentUserRef).then((docSnap) => {
                if (docSnap.exists()) {
                    const currentData = docSnap.data() as UserData;
                    const following = currentData.following || [];
                    if (typeof id === "string") {
                        setIsFollowing(following.includes(id));
                    }
                }
            });
        }
    }, [id]);

    useEffect(() => {
        if (!id) return;
        const recipesQuery = query(
            collection(firestore, "recipes"),
            where("userId", "==", id)
        );

        const unsubscribe = onSnapshot(recipesQuery, (snapshot) => {
            const recipesData: Recipe[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<Recipe, "id">),
            }));
            setUserRecipes(recipesData);
        });

        return () => unsubscribe();
    }, [id]);

    const handleFollow = async () => {
        if (!auth.currentUser) return;
        const currentUserRef = doc(firestore, "users", auth.currentUser.uid);
        try {
            if (isFollowing) {
                await updateDoc(currentUserRef, {
                    following: arrayRemove(id),
                });
            } else {
                await updateDoc(currentUserRef, {
                    following: arrayUnion(id),
                });
            }
            setIsFollowing(!isFollowing);
        } catch (error) {
            console.error("Error updating following:", error);
        }
    };

    if (!id) return <div className="p-4">No user id provided.</div>;
    if (!userData) return <div className="p-4">Loading...</div>;

    const isOwner = auth.currentUser?.uid === id;

    return (
        <div className="md:w-1/2 w-full mx-auto p-4">

            <div className="md:flex justify-between items-center">
            <div className="flex items-center">
                {userData.photoURL && (
                    <img
                        src={userData.photoURL}
                        alt="User Avatar"
                        className="h-16 w-16 rounded-full mr-4"
                    />
                )}
                <h1 className="text-4xl font-bold">{userData.name || "User Profile"}</h1>
            </div>

                {isOwner && (
                    <button
                        className="confirm-button  mt-4 md:mt-0 p-2 rounded-lg cursor-pointer hover:underline md:ml-4"
                        onClick={logout}
                    >
                        Logg ut
                    </button>
                )}

            </div>


            {auth.currentUser && auth.currentUser.uid !== id && (
                <button
                    onClick={handleFollow}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                >
                    {isFollowing ? "Unfollow" : "Follow"}
                </button>
            )}

            <h1 className="text-xl font-bold mt-8">Mine oppskrifter</h1>

            <div className="grid grid-cols-1 gap-4 mt-4">
                {userRecipes.length === 0 &&

                    <div className=" ">
                        <p className="">Ingen oppskrifter funnet.</p>

                        {isOwner && (
                            <button
                                className="confirm-button py-2 px-4 rounded mt-4"
                                onClick={() => {
                                    window.location.href = "/create-recipe";
                                }}
                            >
                                Lag ny oppskrift
                            </button>
                        )}

                    </div>


                }
                {userRecipes.map((recipe) => (
                    <div
                        key={recipe.id}
                        className="p-4 rounded-lg dark-purple-bg white-text cursor-pointer"
                        onClick={() => {
                            window.location.href = `/recipe/${recipe.id}`;
                        }}
                    >
                        <div className="flex justify-between items-center">


                            <div className="rounded-lg overflow-hidden">

                                <div
                                    className="w-64 h-64 md:w-64 md:h-64 overflow-hidden flex items-center justify-center"
                                    style={{filter: "invert(1)"}}
                                    dangerouslySetInnerHTML={{
                                        __html: recipe.image
                                            .replace(/class="[^"]*bg-white[^"]*"/g, 'class=""')
                                            .replace(/fill="white"/g, 'fill="none"')
                                            .replace(/width="\+"/, '')
                                            .replace(/height="\d+"/, '')
                                            .replace(
                                                /<svg([^>]*?)>/,
                                                `<svg$1 viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`
                                            ),
                                    }}
                                />
                                <h1 className="text-2xl font-bold mt-2">{recipe.title}</h1>
                                <p>{recipe.description}</p>
                            </div>


                        </div>

                        <div className="flex justify-between">

                        {isOwner && (
                            <button
                                className="relative text-white cursor-pointer"
                                onClick={() => {
                                    window.location.href = `/recipe/edit/${recipe.id}`;
                                }}
                            >
                                <span className="material-symbols-outlined">
                                    edit
                                </span>
                            </button>
                        )}

                            {isOwner && (
                                <button
                                    className="relative text-white cursor-pointer"
                                    onClick={() => {
                                        setPendingDeleteId(recipe.id);
                                        setShowConfirm(true);
                                    }}
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            )}


                            {showConfirm && (
                                <div className="fixed inset-0 bg-opacity-50 flex justify-center items-center z-50">
                                    <div className="dark-purple-bg  p-6 rounded shadow-lg max-w-sm w-full">
                                        <h2 className="text-xl font-semibold mb-4">Vil du slette denne oppskriften?</h2>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
                                                onClick={() => setShowConfirm(false)}
                                            >
                                                Avbryt
                                            </button>
                                            <button
                                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                                                onClick={async () => {
                                                    if (!pendingDeleteId) return;
                                                    try {
                                                        await deleteDoc(doc(firestore, "recipes", pendingDeleteId));
                                                        setUserRecipes(prev => prev.filter(r => r.id !== pendingDeleteId));
                                                        setShowConfirm(false);
                                                        setPendingDeleteId(null);
                                                    } catch (err) {
                                                        console.error("Feil ved sletting:", err);
                                                        // Optional: show custom error message
                                                    }
                                                }}
                                            >
                                                Slett
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}


                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

export default UserProfile;
