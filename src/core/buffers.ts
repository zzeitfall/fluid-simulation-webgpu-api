import { isTypedArray, isArrayBuffer, isBufferData } from '../assertions';

import type { BufferData } from '../types';

export function createBuffer(data: BufferData | number, usage: number, mappedAtCreation = false) {
    const isBufferSource = isBufferData(data);

    const size = isBufferSource ? data.byteLength : data;

    const instance = gpu.device.createBuffer({
        size,
        usage,
        mappedAtCreation,
    });

    if (isBufferSource && mappedAtCreation) {
        const arrayBuffer = instance.getMappedRange();
        const arrayBufferView = new Uint8Array(arrayBuffer);
        const arrayBufferData = isArrayBuffer(data)
            ? new Uint8Array(data)
            : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

        arrayBufferView.set(arrayBufferData);

        instance.unmap();
    }
    else if (isBufferSource) {
        writeBuffer(instance, 0, data, 0);
    }

    return instance;
}

export function createUniformBuffer(data: BufferData | number, usage = 0, mappedAtCreation = false) {
    return createBuffer(data, GPUBufferUsage.UNIFORM | usage, mappedAtCreation);
}

export function createStorageBuffer(data: BufferData | number, usage = 0, mappedAtCreation = false) {
    return createBuffer(data, GPUBufferUsage.STORAGE | usage, mappedAtCreation);
}

export function createVertexBuffer(data: BufferData | number, usage = 0, mappedAtCreation = false) {
    return createBuffer(data, GPUBufferUsage.VERTEX | usage, mappedAtCreation);
}

export function createIndexBuffer(data: BufferData | number, usage = 0, mappedAtCreation = false) {
    return createBuffer(data, GPUBufferUsage.INDEX | usage, mappedAtCreation);
}

export function writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferData, dataOffset: number) {
    const contentSize = isTypedArray(data) ? data.length : data.byteLength;

    gpu.device.queue.writeBuffer(buffer, bufferOffset, data, dataOffset, contentSize);
}
