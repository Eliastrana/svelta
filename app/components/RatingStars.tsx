'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { setRecipeRating } from '@/helpers/fetchRating';

type Props = {
    recipeId: string;
    className?: string;
};

function StarIcon({ filled }: { filled: boolean }) {
    // Material Symbols: grade
    return (
        <span
            className={[
                'material-symbols-outlined leading-none select-none',
                filled ? 'text-neutral-800' : 'text-slate-300',
            ].join(' ')}
        >
      grade
    </span>
    );
}

export default function RatingStars({ recipeId, className }: Props) {
    const router = useRouter();
    const user = useAuthUser();
    const uid = user?.uid;

    const { myRating, avg, ratingCount } = useRecipeRating(recipeId, uid);

    const [hover, setHover] = useState<number>(0);
    const [saving, setSaving] = useState(false);

    const display = hover || myRating;

    const avgText = useMemo(() => {
        const v = avg || 0;
        return v.toFixed(1).replace('.', ',');
    }, [avg]);

    const goLogin = () => {
        const next = window.location.pathname + window.location.search;
        router.push(`/login?next=${encodeURIComponent(next)}`);
    };

    const onPick = async (value: number) => {
        if (!uid) return goLogin();
        if (saving) return;

        try {
            setSaving(true);
            await setRecipeRating(recipeId, uid, value);
        } catch (e) {
            console.error(e);
            alert('Kunne ikke lagre rating.');
        } finally {
            setSaving(false);
            setHover(0);
        }
    };

    return (
        <div
            className={[
                'rounded-2xl border border-slate-200 bg-white shadow-sm',
                'px-4 py-3 flex items-center justify-between gap-3',
                className ?? '',
            ].join(' ')}
        >
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Rating</p>
                <p className="text-sm text-slate-600">
                    {ratingCount > 0 ? (
                        <>
                            {avgText} <span className="text-slate-400">·</span> {ratingCount} vurderinger
                        </>
                    ) : (
                        'Ingen vurderinger enda'
                    )}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {/* stars */}
                <div
                    className={[
                        'flex items-center gap-0.5 rounded-full px-2 py-1 ',
                        'bg-slate-50 border border-slate-200',
                        saving ? 'opacity-70' : '',
                    ].join(' ')}
                    onMouseLeave={() => setHover(0)}
                >
                    {[1, 2, 3, 4, 5].map((v) => (
                        <button
                            key={v}
                            type="button"
                            className="p-1 pt-2 rounded-full hover:bg-white transition active:scale-[0.98] "
                            onMouseEnter={() => setHover(v)}
                            onClick={() => onPick(v)}
                            disabled={saving}
                            aria-label={`Gi ${v} stjerner`}
                        >
                            <StarIcon filled={v <= display} />
                        </button>
                    ))}
                </div>

                {/* saving indicator */}
                {saving ? (
                    <div className="h-9 w-9 grid place-items-center rounded-full border border-slate-200 bg-white">
                        <span className="material-symbols-outlined animate-spin text-slate-700">progress_activity</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}