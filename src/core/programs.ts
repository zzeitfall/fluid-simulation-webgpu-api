import { createVertexBuffer, createIndexBuffer } from './buffers';
import { createTexture } from './textures';

import type { GPUComputeProgramDescriptor, GPURenderProgramDescriptor } from '../types';

export function createComputeProgram(descriptor: GPUComputeProgramDescriptor) {
    const { canvas, device, workgroup } = gpu;
    const {
        shader: code,
        uniforms,
        textures,
    } = descriptor;

    const shaderModule = device.createShaderModule({ code });

    const uniformBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [];
    const textureBindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [];

    const uniformBindGroupEntries: GPUBindGroupEntry[] = [];

    uniforms.forEach((buffer, binding) => {
        uniformBindGroupLayoutEntries.push({
            binding,
            buffer: {
                type: 'uniform',
            },
            visibility: GPUShaderStage.COMPUTE,
        });

        uniformBindGroupEntries.push({
            binding,
            resource: {
                buffer,
            },
        });
    });

    textures.forEach((texture, binding) => {
        textureBindGroupLayoutEntries.push({
            binding,
            visibility: GPUShaderStage.COMPUTE,
            ...texture,
        });
    });

    const uniformsBindGroupLayout = device.createBindGroupLayout({ entries: uniformBindGroupLayoutEntries });
    const texturesBindGroupLayout = device.createBindGroupLayout({ entries: textureBindGroupLayoutEntries });

    const uniformsBindGroup = device.createBindGroup({
        layout: uniformsBindGroupLayout,
        entries: uniformBindGroupEntries,
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            uniformsBindGroupLayout,
            texturesBindGroupLayout,
        ],
    });

    const pipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
            module: shaderModule,
            entryPoint: 'main',
            constants: {
                0: workgroup.sizeX,
                1: workgroup.sizeY,
            },
        },
    });

    function dispatch(
        encoder: GPUCommandEncoder,
        textures: GPUBindingResource[],
        workSizeX = canvas.width,
        workSizeY = canvas.height
    ) {
        const workgroupCountX = Math.ceil(workSizeX / workgroup.sizeX);
        const workgroupCountY = Math.ceil(workSizeY / workgroup.sizeY);

        const textureBindGroupEntries = textures.map((resource, binding) => ({
            binding,
            resource,
        }));

        const externalsBindGroup = device.createBindGroup({
            layout: texturesBindGroupLayout,
            entries: textureBindGroupEntries,
        });

        const computePass = encoder.beginComputePass();

        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, uniformsBindGroup);
        computePass.setBindGroup(1, externalsBindGroup);
        computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
        computePass.end();
    }

    return {
        dispatch,
    };
}

export function createRenderProgram(descriptor: GPURenderProgramDescriptor) {
    const { canvas, device, preferredFormat } = gpu;
    const { shader: code } = descriptor;

    const shaderModule = device.createShaderModule({ code });

    const vertexData = new Float32Array([1, 1, -1, 1, -1, -1, 1, -1]);
    const indexData = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const vertexBuffer = createVertexBuffer(vertexData, 0, true);
    const indexBuffer = createIndexBuffer(indexData, 0, true);

    const textureSampler = device.createSampler();

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    viewDimension: '2d',
                    sampleType: 'unfilterable-float',
                },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: 'non-filtering',
                },
            },
        ],
    });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [
                {
                    arrayStride: 2 * vertexData.BYTES_PER_ELEMENT,
                    stepMode: 'vertex',
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x2',
                        },
                    ],
                },
            ],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [
                {
                    format: preferredFormat,
                },
            ],
        },
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: null,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: [0, 0, 0, 1],
            },
        ],
    };

    function dispatch(encoder: GPUCommandEncoder, texture: GPUTexture) {
        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: texture.createView(),
                },
                {
                    binding: 1,
                    resource: textureSampler,
                },
            ],
        });

        const canvasTextureView = canvas.context.getCurrentTexture().createView();

        // Element implicitly has an 'any' type because expression of type '0' can't be used to index type 'Iterable<GPURenderPassColorAttachment>'.
        // @ts-expect-error ^^^
        renderPassDescriptor.colorAttachments[0].view = canvasTextureView;

        const renderPass = encoder.beginRenderPass(renderPassDescriptor);

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint16');
        renderPass.drawIndexed(indexData.length);
        renderPass.end();
    }

    return {
        dispatch,
    };
}
