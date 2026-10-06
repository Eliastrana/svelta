'use client';

import Image from 'next/image';
import type { ChangeEvent } from 'react';

export const RECIPE_EDITOR_STEPS = [
    'Grunnleggende',
    'Litt praktisk',
    'Ingredienser',
    'Fremgangsmåte',
    'Tagger',
    'Detaljer',
    'Publiser',
] as const;

type NavigationProps = {
    step: number;
    mode: 'create' | 'edit';
    busy: boolean;
    error: string | null;
    onBack: () => void;
    onNext: () => void;
    onPublish: () => void;
    onReset?: () => void;
};

export function RecipeEditorHeader({
    step,
    mode,
    onReset,
}: Pick<NavigationProps, 'step' | 'mode' | 'onReset'>) {
    return (
        <header className="mb-7 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-[#6c7b65]">
                        {mode === 'edit' ? 'Rediger oppskrift' : 'Ny oppskrift'}
                    </p>
                    <h1 className="mt-1 text-3xl font-bold text-[#12340d]">
                        {RECIPE_EDITOR_STEPS[step]}
                    </h1>
                </div>
                {onReset ? (
                    <button
                        type="button"
                        onClick={onReset}
                        className="rounded-full px-3 py-2 text-sm font-semibold text-[#a33e32] hover:bg-[#f8e9e6]"
                    >
                        Nullstill
                    </button>
                ) : null}
            </div>
            <p className="text-sm text-[#6c7b65]">
                Steg {step + 1} av {RECIPE_EDITOR_STEPS.length}
            </p>
            <div
                className="flex gap-1.5"
                role="progressbar"
                aria-valuenow={step + 1}
                aria-valuemin={1}
                aria-valuemax={RECIPE_EDITOR_STEPS.length}
                aria-label="Fremdrift for oppskrift"
            >
                {RECIPE_EDITOR_STEPS.map((label, index) => (
                    <span
                        key={label}
                        className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-[#12340d]' : 'bg-[#dce5d8]'}`}
                    />
                ))}
            </div>
        </header>
    );
}

export function RecipeEditorNavigation({
    step,
    mode,
    busy,
    error,
    onBack,
    onNext,
    onPublish,
}: NavigationProps) {
    const lastStep = step === RECIPE_EDITOR_STEPS.length - 1;

    return (
        <footer className="mt-8 space-y-3 border-t border-[#e4e9df] pt-5">
            {error ? (
                <p role="alert" className="rounded-2xl bg-[#f8e9e6] p-3 text-sm text-[#a33e32]">
                    {error}
                </p>
            ) : null}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={step === 0 || busy}
                    className="min-h-12 flex-1 rounded-full border border-[#cdd9c9] px-5 font-semibold text-[#12340d] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Tilbake
                </button>
                <button
                    key={lastStep ? 'publish' : 'next'}
                    type="button"
                    onClick={lastStep ? onPublish : onNext}
                    disabled={busy}
                    className="brown-button min-h-12 flex-1 rounded-full px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {busy ? 'Lagrer…' : lastStep ? (mode === 'edit' ? 'Lagre' : 'Publiser') : 'Neste'}
                </button>
            </div>
        </footer>
    );
}

export function RecipeEditorReview({
    coverImage,
    title,
    description,
    ingredientCount,
    stepCount,
    visibility,
    mode = 'create',
}: {
    coverImage?: string | null;
    title: string;
    description: string;
    ingredientCount: number;
    stepCount: number;
    visibility: 'public' | 'private';
    mode?: 'create' | 'edit';
}) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-bold text-[#12340d]">Klar til å dele?</h2>
                <p className="mt-1 text-[#6c7b65]">Se over oppskriften før du {mode === 'edit' ? 'lagrer' : 'publiserer'}.</p>
            </div>
            {coverImage ? (
                <div className="relative h-56 overflow-hidden rounded-[28px] bg-[#e5e5d7]">
                    <Image src={coverImage} alt="Forsidebilde" fill sizes="(max-width: 640px) 100vw, 576px" className="object-cover" unoptimized />
                </div>
            ) : null}
            <div className="space-y-3 rounded-[28px] bg-[#f5f5ed] p-5">
                <h3 className="text-2xl font-bold text-[#12340d]">{title || 'Oppskrift uten navn'}</h3>
                {description ? <p className="text-[#496444]">{description}</p> : null}
                <p className="font-semibold text-[#12340d]">{ingredientCount} ingredienser · {stepCount} steg</p>
                <p className="text-[#6c7b65]">{visibility === 'public' ? 'Offentlig' : 'Privat'}</p>
            </div>
        </div>
    );
}

export function RecipeCoverPicker({
    image,
    onChange,
    onRemove,
}: {
    image?: string | null;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
}) {
    return (
        <div className="space-y-3">
            <p className="text-sm font-semibold text-[#12340d]">Forsidebilde</p>
            {image ? (
                <div className="relative h-72 overflow-hidden rounded-[28px] bg-[#e5e5d7]">
                    <Image src={image} alt="Forsidebilde" fill sizes="(max-width: 640px) 100vw, 576px" className="object-cover" unoptimized />
                    <div className="absolute right-3 top-3 flex gap-2">
                        <label className="cursor-pointer rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#12340d] shadow-sm">
                            Bytt bilde
                            <input type="file" accept="image/*" className="sr-only" onChange={onChange} />
                        </label>
                        <button type="button" onClick={onRemove} aria-label="Fjern forsidebilde" className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-xl text-[#a33e32] shadow-sm">×</button>
                    </div>
                </div>
            ) : (
                <label className="flex h-44 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[#cdd9c9] bg-[#f5f5ed] text-[#12340d] hover:bg-[#edf3e9]">
                    <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                    <span className="mt-2 font-semibold">Velg bilde</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={onChange} />
                </label>
            )}
        </div>
    );
}
