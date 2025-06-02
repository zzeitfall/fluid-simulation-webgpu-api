import { TypedArray, BufferData } from '../types';

export function isTypedArray(value: unknown): value is TypedArray {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
    return value && value instanceof ArrayBuffer;
}

export function isBufferData(value: unknown): value is BufferData {
    return isTypedArray(value) || isArrayBuffer(value);
}
