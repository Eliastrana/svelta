'use client';

import Link from 'next/link';
import React from 'react';

type CollectionCardProps = {
    href: string;
    name: string;
    description?: string;
    previewImage?: string;
    recipeCount?: number;
    visibilityLabel?: string;
};

export default function CollectionCard({
    href,
    name,
    description,
    previewImage,
    recipeCount = 0,
    visibilityLabel,
}: CollectionCardProps) {
    return (
        <Link
            href={href}
            className="block rounded-xl bg-[#f2f1e8] p-3 text-left text-[#12340d] transition-[transform,background-color] duration-300 ease-out hover:bg-[#ecebdd]"
        >
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#deded0]">
                {previewImage ? (
                    <img
                        src={previewImage}
                        alt={name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105 ease-out"
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center bg-[var(--accent)] text-[#12340d]">
                        <span className="material-symbols-outlined text-5xl">menu_book</span>
                    </div>
                )}

                <div className="absolute right-3 top-3 flex items-center gap-2">
                    {visibilityLabel ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-[#fbfaf4]/95 px-2.5 py-1 text-xs font-bold text-[#12340d] shadow-sm backdrop-blur">
                            <span className="material-symbols-outlined text-[16px]">
                                {visibilityLabel === 'Offentlig' ? 'public' : 'lock'}
                            </span>
                            {visibilityLabel}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="px-1 pt-4">
                <h2 className="line-clamp-2 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                    {name}
                </h2>

                {description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#496444] md:text-base">
                        {description}
                    </p>
                ) : null}
            </div>

            <div className="mt-4 flex items-end gap-3 px-1 justify-end">


                <div className="flex shrink-0 items-center gap-2 text-sm ">
                    <div className="inline-flex items-center gap-1 rounded-full bg-[#e5e5d7] px-2.5 py-1 font-medium text-[#12340d]">
                        <span className="material-symbols-outlined text-[17px]">menu_book</span>
                        {recipeCount}
                    </div>
                </div>
            </div>
        </Link>
    );
}
