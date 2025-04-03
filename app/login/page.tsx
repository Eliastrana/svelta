// pages/login.tsx
'use client';
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import {auth, provider} from "@/firebase";

const Login = () => {
    const router = useRouter();

    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("User info:", result.user);
            // Optionally, store user info in your Firestore "users" collection here.
            router.push("/");
        } catch (error) {
            console.error("Error during sign in", error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <button
                onClick={signIn}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
                Sign in with Google
            </button>
        </div>
    );
};

export default Login;
