import { GPUCanvas } from '../core';

export function isGPUCanvas(value: unknown): value is GPUCanvas {
    return value && value instanceof GPUCanvas;
}
