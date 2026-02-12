'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppModal from '@/app/components/AppModal';

type ConfettiParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
    rot: number;
    vr: number;
    life: number;
    maxLife: number;
    opacity: number;
    shape: 'rect' | 'circle';
    color: string;
};

function rand(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function ConfettiBurstFromBottom({
                                     run,
                                     durationMs = 2200,
                                 }: {
    run: boolean;
    durationMs?: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!run) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particles: ConfettiParticle[] = [];
        const palette = ['#E6D5B8', '#D9C4A0', '#CBB38D', '#BFA67C', '#A98F66', '#8C6B3E'];

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const spawn = (count: number) => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            for (let i = 0; i < count; i++) {
                const x = rand(0, width);
                const y = height + rand(10, 40);

                const speed = rand(4, 9);
                const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                particles.push({
                    x,
                    y,
                    vx,
                    vy,
                    w: rand(6, 12),
                    h: rand(6, 14),
                    rot: rand(0, Math.PI * 2),
                    vr: rand(-0.15, 0.15),
                    life: 0,
                    maxLife: rand(60, 120),
                    opacity: 1,
                    shape: Math.random() > 0.15 ? 'rect' : 'circle',
                    color: palette[(Math.random() * palette.length) | 0],
                });
            }
        };

        const start = performance.now();
        const step = (t: number) => {
            const elapsed = t - start;
            const width = window.innerWidth;
            const height = window.innerHeight;

            if (elapsed < 500) spawn(18);
            if (elapsed > 120 && elapsed < 850) spawn(10);

            ctx.clearRect(0, 0, width, height);

            const g = 0.12;

            particles = particles
                .map((p) => {
                    const next = { ...p };
                    next.vy += g;
                    next.x += next.vx;
                    next.y += next.vy;
                    next.rot += next.vr;
                    next.life += 1;

                    const lifeRatio = next.life / next.maxLife;
                    next.opacity = Math.max(0, 1 - lifeRatio);

                    return next;
                })
                .filter((p) => p.opacity > 0 && p.y < height + 60);

            for (const p of particles) {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;

                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, Math.min(p.w, p.h) / 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }

            if (elapsed < durationMs) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                ctx.clearRect(0, 0, width, height);
            }
        };

        resize();
        window.addEventListener('resize', resize);
        rafRef.current = requestAnimationFrame(step);

        return () => {
            window.removeEventListener('resize', resize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [run, durationMs]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[60] pointer-events-none"
            aria-hidden="true"
        />
    );
}

export type RecipeCreatedModalProps = {
    recipeId: string;
    onClose: () => void;
    /** optional: if you want to do something after "Open" button */
    onOpenRecipe?: () => void;
};

const RecipeCreatedModal: React.FC<RecipeCreatedModalProps> = ({ recipeId, onClose }) => {
    const [copied, setCopied] = useState(false);
    const [confettiRun, setConfettiRun] = useState(true);

    const recipeUrl = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.svelta.no';
        return `${origin}/recipe/${recipeId}`;
    }, [recipeId]);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(recipeUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = recipeUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        }
    };



    return (
        <>
            <ConfettiBurstFromBottom run={confettiRun} durationMs={2200} />

            <AppModal onClose={onClose} overlayClassName="z-[70]">
                {({ closeWithAnim, closing }) => (
                <div>
                    <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900">
                                    Gratulerer med din nye oppskrift 🎉
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Dette så vanvittig godt ut – del den med en venn!
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setConfettiRun(false);
                                    closeWithAnim();
                                }}
                                disabled={closing}
                                className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition active:scale-95"
                                aria-label="Lukk"
                            >
                                <span className="material-symbols-outlined text-slate-700">close</span>
                            </button>
                        </div>



                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => void copyLink()}
                                className="flex-1 rounded-full py-2 font-semibold shadow-sm brown-button hover:opacity-95 active:scale-[0.99] transition"
                            >
                                {copied ? 'Kopiert!' : 'Del'}
                            </button>


                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setConfettiRun(false);
                                closeWithAnim();
                            }}
                            className="mt-3 w-full rounded-full py-2 font-semibold bg-white border border-slate-200 hover:bg-slate-50 transition"
                        >
                            Se oppskriften
                        </button>
                    </div>
                </div>
                )}
            </AppModal>
        </>
    );
};

export default RecipeCreatedModal;
