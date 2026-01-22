'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

import { firestore } from '@/firebase';
import { fetchManyUsers } from '@/helpers/fetchManyUsers';
import { UserDoc } from '@/hooks/useUserData';

type CreatorCount = {
    uid: string;
    recipeCount: number;
};

type RecipeMinimal = {
    userId: string;
    createdAt?: unknown;
};

async function fetchTopActiveCreators(opts?: {
    topN?: number;
    scanLimit?: number;
}): Promise<CreatorCount[]> {
    const topN = opts?.topN ?? 2;
    const scanLimit = opts?.scanLimit ?? 200;

    // Scan latest N recipes and count posts per userId
    const recipesRef = collection(firestore, 'recipes');
    const q = query(recipesRef, orderBy('createdAt', 'desc'), limit(scanLimit));
    const snap = await getDocs(q);

    const counts = new Map<string, number>();

    snap.forEach((d) => {
        const data = d.data() as RecipeMinimal;
        const uid = (data.userId || '').trim();
        if (!uid) return;
        counts.set(uid, (counts.get(uid) ?? 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([uid, recipeCount]) => ({ uid, recipeCount }))
        .sort((a, b) => b.recipeCount - a.recipeCount)
        .slice(0, topN);
}

const MostActiveCreators: React.FC = () => {
    const router = useRouter();

    const { data: topCreators = [], isLoading } = useQuery<CreatorCount[], Error>({
        queryKey: ['topActiveCreators'],
        queryFn: () => fetchTopActiveCreators({ topN: 2, scanLimit: 250 }),
        placeholderData: (prev) => prev ?? [],
    });

    const creatorIds = React.useMemo(() => topCreators.map((c) => c.uid), [topCreators]);

    const { data: usersMap = {} } = useQuery<Record<string, UserDoc>, Error>({
        queryKey: ['topCreatorsUsersMap', creatorIds],
        queryFn: () => fetchManyUsers(creatorIds),
        enabled: creatorIds.length > 0,
        placeholderData: (prev) => prev ?? {},
    });

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Aktive kokker</h3>
            </div>

            {isLoading ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                        <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-slate-100" />
                        <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
                    </div>
                </div>
            ) : topCreators.length === 0 ? (
                <p className="mt-3 text-slate-600"></p>
            ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                    {topCreators.map((c) => {
                        const u = usersMap[c.uid];
                        const name = u?.name ?? 'Ukjent';
                        const photoURL = u?.photoURL ?? '';

                        return (
                            <button
                                key={c.uid}
                                type="button"
                                onClick={() => router.push(`/user/${c.uid}`)}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 transition text-left hover:cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 shrink-0">
                                        {photoURL ? (
                                            <img src={photoURL} alt={name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full grid place-items-center text-slate-500">🧑‍🍳</div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{name}</p>
                                        <p className="text-sm text-slate-600">{c.recipeCount} oppskrifter</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MostActiveCreators;