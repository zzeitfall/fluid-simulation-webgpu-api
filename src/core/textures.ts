export function createTexture(descriptor: GPUTextureDescriptor) {
    return gpu.device.createTexture(descriptor);
}

export function createStorageTexture2D(width: number, height: number, usage = 0) {
    return createTexture({
        dimension: '2d',
        format: 'r32float',
        size: [width, height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | usage,
    });
}
