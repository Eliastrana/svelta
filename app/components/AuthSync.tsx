"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, firestore } from "@/firebase";

export default function AuthSync() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(firestore, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
          // Create the user doc
          await setDoc(userDocRef, {
            name: user.displayName || "Unnamed User",
            photoURL: user.photoURL || "",
            following: [],
          });
        } else {
          // Optionally merge a new photo if changed
          await setDoc(
            userDocRef,
            { photoURL: user.photoURL || "" },
            { merge: true },
          );
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return null;
}
