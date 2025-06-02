import { writeBuffer } from './buffers';

import type { TypedArrayConstructors } from '../types';

export function createDataLayout<
    A extends TypedArrayConstructors,
    O extends Record<string, number>
>(
    arrayConstructor: A,
    object: O
) {
    const values: number[] = [];
    const indices = new Map<keyof O, number>();

    Object.entries(object).forEach((entry, index) => {
        const [key, value] = entry;

        values.push(value);
        indices.set(key, index);
    });

    const array = new arrayConstructor(values) as InstanceType<A>;

    function set(key: keyof O, value: number) {
        const isPropertyExist = indices.has(key);

        if (isPropertyExist) {
            const propertyIndex = indices.get(key);

            array[propertyIndex] = value;
        }
    }

    function get(key: keyof O) {
        const isPropertyExist = indices.has(key);

        if (isPropertyExist) {
            const propertyIndex = indices.get(key);

            return array[propertyIndex];
        }
    }

    function writeTo(buffer: GPUBuffer, bufferOffset = 0, dataOffset = 0) {
        writeBuffer(buffer, bufferOffset, array, dataOffset);
    }

    return {
        array,
        set,
        get,
        writeTo,
    };
}

export function createUint32DataLayout<O extends Record<string, number>>(object: O) {
    return createDataLayout(Uint32Array, object);
}

export function createFloat32DataLayout<O extends Record<string, number>>(object: O) {
    return createDataLayout(Float32Array, object);
}
