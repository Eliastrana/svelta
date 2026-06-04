'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { setRecipeRating } from '@/helpers/fetchRating';

type Props = {
    recipeId: string;
    className?: string;
    variant?: 'default' | 'compact';
};

function StarIcon({ filled }: { filled: boolean }) {
    return (
        <img
            src={filled ? '/icons/star-filled.svg' : '/icons/star.svg'}
            alt=""
            className="h-4 w-4 select-none"
            draggable={false}
        />
    );
}

export default function RatingStars({
    recipeId,
    className,
    variant = 'default',
}: Props) {
    const router = useRouter();
    const user = useAuthUser();
    const uid = user?.uid;

    const { myRating, avg, ratingCount } = useRecipeRating(recipeId, uid);

    const [hover, setHover] = useState<number>(0);
    const [saving, setSaving] = useState(false);

    const display = hover || myRating || Math.round(avg || 0);

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

    if (variant === 'compact') {
        return (
            <div
                className={[
                    'inline-flex items-center gap-2 rounded-full bg-[#e5e5d7] px-3 py-1.5 text-[#12340d]',
                    saving ? 'opacity-70' : '',
                    className ?? '',
                ].join(' ')}
            >
                <div
                    className="flex items-center gap-0.5"
                    onMouseLeave={() => setHover(0)}
                >
                    {[1, 2, 3, 4, 5].map((v) => (
                        <button
                            key={v}
                            type="button"
                            className="rounded-full p-0.5 transition hover:scale-110 disabled:cursor-not-allowed"
                            onMouseEnter={() => setHover(v)}
                            onClick={() => onPick(v)}
                            disabled={saving}
                            aria-label={`Gi ${v} stjerner`}
                        >
                            <StarIcon filled={v <= display} />
                        </button>
                    ))}
                </div>

                <span className="text-sm font-medium leading-none">
                    {ratingCount > 0 ? avgText : 'Ingen vurderinger'}
                </span>

                {ratingCount > 0 && (
                    <span className="rounded-full bg-[#d8d8c9] px-2 py-0.5 text-xs leading-none">
                        {ratingCount}
                    </span>
                )}

                {saving ? (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                        progress_activity
                    </span>
                ) : null}
            </div>
        );
    }

    return (
        <div
            className={[
                'rounded-2xl border border-[#d8d7cb] bg-[#f2f1e8]',
                'px-4 py-3 flex items-center justify-between gap-3',
                className ?? '',
            ].join(' ')}
        >
            <div className="min-w-0">
                <p className="text-sm font-semibold text-[#12340d]">Rating</p>
                <p className="text-sm text-[#496444]">
                    {ratingCount > 0 ? (
                        <>
                            {avgText} <span className="text-[#8b9a80]">·</span>{' '}
                            {ratingCount} vurderinger
                        </>
                    ) : (
                        'Ingen vurderinger enda'
                    )}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div
                    className={[
                        'flex items-center gap-0.5 rounded-full px-2 py-1',
                        'bg-[#e5e5d7] border border-[#d8d7cb]',
                        saving ? 'opacity-70' : '',
                    ].join(' ')}
                    onMouseLeave={() => setHover(0)}
                >
                    {[1, 2, 3, 4, 5].map((v) => (
                        <button
                            key={v}
                            type="button"
                            className="rounded-full p-1 transition hover:bg-[#fbfaf4] active:scale-[0.98]"
                            onMouseEnter={() => setHover(v)}
                            onClick={() => onPick(v)}
                            disabled={saving}
                            aria-label={`Gi ${v} stjerner`}
                        >
                            <StarIcon filled={v <= display} />
                        </button>
                    ))}
                </div>

                {saving ? (
                    <div className="grid h-9 w-9 place-items-center rounded-full border border-[#d8d7cb] bg-[#fbfaf4]">
                        <span className="material-symbols-outlined animate-spin text-[#12340d]">
                            progress_activity
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
