'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type RenderArgs = {
    closeWithAnim: () => void;
    closing: boolean;
    open: boolean;
};

type AppModalProps = {
    onClose: () => void;
    children: React.ReactNode | ((args: RenderArgs) => React.ReactNode);
    animMs?: number;
    closeOnEscape?: boolean;
    closeOnOverlayClick?: boolean;
    overlayClassName?: string;
    panelClassName?: string;
    panelOpenClassName?: string;
    panelClosedClassName?: string;
    useDefaultPanelStyle?: boolean;
};

const DEFAULT_OVERLAY =
    'fixed inset-0 z-[100000] bg-black/30 backdrop-blur-sm transition-opacity duration-200';

const DEFAULT_PANEL =
    'fixed z-[100001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur transition-all duration-200 ease-out';

export default function AppModal({
    onClose,
    children,
    animMs = 180,
    closeOnEscape = true,
    closeOnOverlayClick = true,
    overlayClassName = '',
    panelClassName = '',
    panelOpenClassName = 'opacity-100 scale-100',
    panelClosedClassName = 'opacity-0 scale-[0.98]',
    useDefaultPanelStyle = true,
}: AppModalProps) {
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [mounted, setMounted] = useState(false);
    const closeTimerRef = useRef<number | null>(null);

    useEffect(() => {
        setMounted(true);
        const t = window.setTimeout(() => setOpen(true), 10);
        return () => {
            window.clearTimeout(t);
            if (closeTimerRef.current)
                window.clearTimeout(closeTimerRef.current);
        };
    }, []);

    const closeWithAnim = useCallback(() => {
        if (closing) return;
        setClosing(true);
        setOpen(false);
        closeTimerRef.current = window.setTimeout(() => {
            onClose();
        }, animMs);
    }, [animMs, closing, onClose]);

    useEffect(() => {
        if (!closeOnEscape) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeWithAnim();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [closeOnEscape, closeWithAnim]);

    const panelBase = useDefaultPanelStyle
        ? DEFAULT_PANEL
        : 'transition-all duration-200 ease-out';
    const panelState = open ? panelOpenClassName : panelClosedClassName;

    if (!mounted) return null;

    return createPortal(
        <div
            className={[
                DEFAULT_OVERLAY,
                open ? 'opacity-100' : 'opacity-0',
                overlayClassName,
            ].join(' ')}
            onClick={closeOnOverlayClick ? closeWithAnim : undefined}
            aria-hidden="true"
        >
            <div
                className={[panelBase, panelState, panelClassName].join(' ')}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {typeof children === 'function'
                    ? children({ closeWithAnim, closing, open })
                    : children}
            </div>
        </div>,
        document.body
    );
}
