import { createBuffer, createQueryResolveBuffer } from './buffers';

export function createTimestampQuery(count: number) {
    return gpu.device.createQuerySet({
        type: 'timestamp',
        count,
    });
}

export function createTimestampRecorder(count: number, stride: number) {
    const querySet = createTimestampQuery(count * stride);
    const queryResolveBuffer = createQueryResolveBuffer(BigInt64Array.BYTES_PER_ELEMENT * querySet.count, GPUBufferUsage.COPY_SRC);
    const queryFinishBuffer = createBuffer(queryResolveBuffer.size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);

    let queryOffset = 0;

    function capture() {
        const beginningOfPassWriteIndex = queryOffset;
        const endOfPassWriteIndex = beginningOfPassWriteIndex + 1;

        queryOffset += stride;

        return {
            querySet,
            beginningOfPassWriteIndex,
            endOfPassWriteIndex,
        };
    }

    function resolve(encoder: GPUCommandEncoder) {
        encoder.resolveQuerySet(querySet, 0, querySet.count, queryResolveBuffer, 0);

        if (queryFinishBuffer.mapState === 'unmapped') {
            encoder.copyBufferToBuffer(queryResolveBuffer, 0, queryFinishBuffer, 0, queryFinishBuffer.size);
        }
    }

    async function finish() {
        queryOffset = 0;

        if (queryFinishBuffer.mapState !== 'unmapped') {
            return;
        }

        await queryFinishBuffer.mapAsync(GPUMapMode.READ);

        const arrayBuffer = queryFinishBuffer.getMappedRange().slice();
        const timestamps = new BigInt64Array(arrayBuffer);

        queryFinishBuffer.unmap();

        return timestamps;
    }

    return {
        count,
        stride,
        capture,
        resolve,
        finish,
    };
}
