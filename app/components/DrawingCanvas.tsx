'use client';
import { useState, useRef, useEffect } from 'react';

interface DrawingCanvasProps {
    onChange?: (svgString: string) => void;
}

const DrawingCanvas = ({ onChange }: DrawingCanvasProps) => {
    const [paths, setPaths] = useState<string[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const svgRef = useRef<SVGSVGElement>(null);

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        const point = getRelativePoint(e);
        const newPath = `M ${point.x} ${point.y}`;
        setCurrentPath(newPath);
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.buttons !== 1) return; // Only draw if pointer is pressed
        const point = getRelativePoint(e);
        setCurrentPath((prev) => prev + ` L ${point.x} ${point.y}`);
    };

    const handlePointerUp = () => {
        if (currentPath) {
            setPaths((prev) => [...prev, currentPath]);
            setCurrentPath('');
        }
    };

    const getRelativePoint = (e: React.PointerEvent<SVGSVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const rect = svg.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    useEffect(() => {
        if (svgRef.current) {
            const svgString = svgRef.current.outerHTML;
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            onChange && onChange(svgString);
        }
    }, [paths, currentPath, onChange]);

    return (
        <div
            className="w-full aspect-square border bg-white relative"
            style={{ touchAction: 'none' }}
        >
            <svg
                ref={svgRef}
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
