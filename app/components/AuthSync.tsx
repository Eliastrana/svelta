'use client';

import { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/firebase';

function setCookie(token: string) {
    const isHttps =
        typeof window !== 'undefined' && window.location.protocol === 'https:';

    document.cookie = [
        `yourAuthToken=${token}`,
        `Path=/`,
        // Sett litt lenger enn 1 time så middleware ikke “flapper”.
        // NB: Dette er kun en presence-check hos deg (ikke verifisering),
        // så sikkerheten kommer egentlig fra Firebase-reglene dine.
        `Max-Age=${60 * 60 * 24 * 7}`, // 7 dager
        isHttps ? `SameSite=None` : `SameSite=Lax`,
        isHttps ? `Secure` : ``,
    ]
        .filter(Boolean)
        .join('; ');
}

function clearCookie() {
    const isHttps =
        typeof window !== 'undefined' && window.location.protocol === 'https:';

    document.cookie = [
        `yourAuthToken=`,
        `Path=/`,
        `Max-Age=0`,
        isHttps ? `SameSite=None` : `SameSite=Lax`,
        isHttps ? `Secure` : ``,
    ]
        .filter(Boolean)
        .join('; ');
}

export default function AuthSync() {
    useEffect(() => {
        const unsub = onIdTokenChanged(auth, async (user) => {
            if (user) {
                const token = await user.getIdToken(); // refresher automatisk via Firebase
                setCookie(token);
            } else {
                clearCookie();
            }
        });

        return () => unsub();
    }, []);

    return null;
}
