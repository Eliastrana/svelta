// pages/login.tsx
'use client';
import { signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, provider } from '@/firebase';

const Login = () => {
    const router = useRouter();

    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, provider);

            const user = result.user;
            const token = await user.getIdToken(/* forceRefresh= */ true);

            document.cookie = `yourAuthToken=${token}; path=/;`;

            router.push('/');
        } catch (error) {
            console.error('Error during sign in', error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center md:p-40 p-4">
            <div>
                <h1 className="md:text-9xl text-5xl font-bold mb-8">
                    Vis resten hvor Cooked de er
                </h1>
                <button
                    onClick={signIn}
                    className="confirm-button text-black font-bold py-2 px-4 rounded cursor-pointer shadow-md transition duration-300 ease-in-out"
                >
                    Logg inn med Google
                </button>
            </div>
        </div>
    );
};

export default Login;
