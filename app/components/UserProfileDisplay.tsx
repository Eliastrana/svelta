'use client';
import { useEffect, useState } from "react";
import { auth } from "@/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

const UserProfileDisplay = () => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    if (!user) {
        return <div className="p-4 items-center">
            <a href="/login" className="hover:underline">
                Logg inn
            </a>

        </div>;
    }

    return (
        <div className="flex items-center space-x-4 p-4">
            {user.photoURL && (
                <img
                    src={user.photoURL}
                    alt={user.displayName || "Profile"}
                    className="w-12 h-12 rounded-full"
                />
            )}
      {/*      <span className="text-lg ">*/}
      {/*  {user.displayName || "Anonymous"}*/}
      {/*</span>*/}
        </div>
    );
};

export default UserProfileDisplay;
