'use client';
import { useState } from 'react';

interface DrawingCanvasProps {
    onChange?: (svgString: string) => void;
}

const DrawingCanvas = ({ onChange }: DrawingCanvasProps) => {
    const [paths, setPaths] = useState<string[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');

    const emitSvgChange = (nextPaths: string[], nextCurrentPath = '') => {
        if (!onChange) return;

        const pathMarkup = [...nextPaths, nextCurrentPath]
            .filter(Boolean)
            .map(
                (d) =>
                    `<path d="${d}" stroke="black" fill="none" stroke-width="10"></path>`,
            )
            .join('');

        onChange(
            `<svg class="w-full h-full absolute top-0 left-0" xmlns="http://www.w3.org/2000/svg">${pathMarkup}</svg>`,
        );
    };

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        const point = getRelativePoint(e);
        const newPath = `M ${point.x} ${point.y}`;
        setCurrentPath(newPath);
        emitSvgChange(paths, newPath);
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.buttons !== 1) return; // Only draw if pointer is pressed
        const point = getRelativePoint(e);
        setCurrentPath((prev) => {
            const nextPath = prev + ` L ${point.x} ${point.y}`;
            emitSvgChange(paths, nextPath);
            return nextPath;
        });
    };

    const handlePointerUp = () => {
        if (currentPath) {
            const nextPaths = [...paths, currentPath];
            setPaths(nextPaths);
            setCurrentPath('');
            emitSvgChange(nextPaths);
        }
    };

    const getRelativePoint = (e: React.PointerEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    return (
        <div
            className="w-full aspect-square border bg-white relative"
            style={{ touchAction: 'none' }}
        >
            <svg
                className="w-full h-full absolute top-0 left-0"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {paths.map((d, index) => (
                    <path
                        key={index}
                        d={d}
                        stroke="black"
                        fill="none"
                        strokeWidth="10"
                    />
                ))}
                {currentPath && (
                    <path
                        d={currentPath}
                        stroke="black"
                        fill="none"
                        strokeWidth="10"
                    />
                )}
            </svg>
        </div>
    );
};

export default DrawingCanvas;
