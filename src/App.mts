import {
    initGPU,
    createUniformBuffer,
    createUint32DataLayout,
    createFloat32DataLayout,
    createComputeProgram,
    createStorageTexture2D,
    createRenderProgram,
    // createTimestampRecorder,
} from './core';

import { createRAFLoop, createPointerController } from './dom';

import {
    ADVECTION_PROGRAM_SHADER,
    POINTER_PROGRAM_SHADER,
    CALCULATE_DIVERGENCE_PROGRAM_SHADER,
    CALCULATE_PRESSURE_PROGRAM_SHADER,
    SUBTRACT_PRESSURE_PROGRAM_SHADER,
    CALCULATE_VORTICES_PROGRAM_SHADER,
    CLEAR_PROGRAM_SHADER,
    RENDER_PROGRAM_SHADER,
    APPLY_VORTICITY_PROGRAM_SHADER,
} from './shaders';

import {
    READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,
    READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,
} from './constants';

await initGPU({
    adapter: {
        powerPreference: 'high-performance',
    },
    device: {
        requiredFeatures: ['timestamp-query'],
    },
    canvas: {
        selector: 'canvas',
        alphaMode: 'premultiplied',
        colorSpace: 'display-p3',
    },
    workgroup: {
        sizeX: 8,
        sizeY: 8,
    },
});

const pointerController = createPointerController(gpu.canvas);

const settingsData = createFloat32DataLayout({
    dt: .1,
    density: .0625,
    vorticity: .0625,
    _padding: 0,
});
const settingsUniformBuffer = createUniformBuffer(settingsData.array, GPUBufferUsage.COPY_DST);

const gridData = createUint32DataLayout({
    width: gpu.canvas.width,
    height: gpu.canvas.height,
    dx: 1,
});
const gridUniformBuffer = createUniformBuffer(gridData.array, GPUBufferUsage.COPY_DST);

const pointerData = createFloat32DataLayout({
    positionX: -1,
    positionY: -1,
    movementX: 0,
    movementY: 0,
    pressed: 0,
    _padding: 0,
});
const pointerUniformBuffer = createUniformBuffer(pointerData.array, GPUBufferUsage.COPY_DST);

const splatData = createFloat32DataLayout({
    radius: 32,
    intensity: .025,
    force: 2,
});
const splatUniformBuffer = createUniformBuffer(splatData.array, GPUBufferUsage.COPY_DST);

let u0 = createStorageTexture2D(gpu.canvas.width + 1, gpu.canvas.height);
let u1 = createStorageTexture2D(gpu.canvas.width + 1, gpu.canvas.height);
let v0 = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height + 1);
let v1 = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height + 1);
const div = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height);
let p0 = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height);
let p1 = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height);
const vor = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height);
let dye0 = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height);
let dye1 = createStorageTexture2D(gpu.canvas.width, gpu.canvas.height);

const pointerProgram = createComputeProgram({
    shader: POINTER_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
        pointerUniformBuffer,
        splatUniformBuffer,
    ],
    textures: [
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // u
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // v
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // dye
    ],
});

const advectionProgram = createComputeProgram({
    shader: ADVECTION_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
    ],
    textures: [
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // u
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // v
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // q0
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // q1
    ],
});

const calculateDivergenceProgram = createComputeProgram({
    shader: CALCULATE_DIVERGENCE_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
    ],
    textures: [
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // u
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // v
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // div
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // p
    ],
});

const calculatePressureProgram = createComputeProgram({
    shader: CALCULATE_PRESSURE_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
    ],
    textures: [
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // div
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // p0
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // p1
    ],
});

const subtractPressureProgram = createComputeProgram({
    shader: SUBTRACT_PRESSURE_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
    ],
    textures: [
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // p
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // u
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // v
    ],
});

const calculateVorticesProgram = createComputeProgram({
    shader: CALCULATE_VORTICES_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
    ],
    textures: [
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // u
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // v
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // vor
    ],
});

const applyVorticityProgram = createComputeProgram({
    shader: APPLY_VORTICITY_PROGRAM_SHADER,
    uniforms: [
        settingsUniformBuffer,
        gridUniformBuffer,
    ],
    textures: [
        READ_ONLY_STORAGE_TEXTURE_2D_LAYOUT_ENTRY,  // vor
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // u
        READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY, // v
    ],
});

const clearProgram = createComputeProgram({
    shader: CLEAR_PROGRAM_SHADER,
    uniforms: [gridUniformBuffer],
    textures: [READ_WRITE_STORAGE_TEXTURE_2D_LAYOUT_ENTRY], // q
});

const renderProgram = createRenderProgram({ shader: RENDER_PROGRAM_SHADER });

// `110` represents number of compute programs per simulation cycle
// const timestampRecorder = createTimestampRecorder(110, 2);
// const gpuTimes: number[] = [];

pointerController.on('pointermove', (event) => {
    const {
        offsetX,
        offsetY,
        movementX,
        movementY,
        pressure,
    } = event;

    pointerData.set('positionX', offsetX);
    pointerData.set('positionY', offsetY);
    pointerData.set('movementX', movementX);
    pointerData.set('movementY', movementY);
    pointerData.set('pressed', pressure);
});

createRAFLoop(() => {
    let temp = null;

    pointerData.writeTo(pointerUniformBuffer);
    pointerData.set('movementX', 0);
    pointerData.set('movementY', 0);

    const commandEncoder = gpu.device.createCommandEncoder();

    pointerProgram.dispatch(commandEncoder, [
        u0.createView(),
        v0.createView(),
        dye0.createView(),
    ] /*, timestampRecorder.capture() */);

    // Advect U
    advectionProgram.dispatch(commandEncoder, [
        u0.createView(),
        v0.createView(),
        u0.createView(),
        u1.createView(),
    ] /*, timestampRecorder.capture() */);

    // Advect V
    advectionProgram.dispatch(commandEncoder, [
        u0.createView(),
        v0.createView(),
        v0.createView(),
        v1.createView(),
    ] /*, timestampRecorder.capture() */);

    temp = u0;
    u0 = u1;
    u1 = temp;

    temp = v0;
    v0 = v1;
    v1 = temp;

    // Calculate Divergence
    calculateDivergenceProgram.dispatch(commandEncoder, [
        u0.createView(),
        v0.createView(),
        div.createView(),
        p0.createView(), // Clear pressure for the Jacobi iteration method
    ] /*, timestampRecorder.capture() */);

    // Calculare Pressure
    for (let i = 0; i < 100; i++) {
        calculatePressureProgram.dispatch(commandEncoder, [
            div.createView(),
            p0.createView(),
            p1.createView(),
        ] /*, timestampRecorder.capture() */);

        temp = p0;
        p0 = p1;
        p1 = temp;
    }

    // Subtract Pressure
    subtractPressureProgram.dispatch(commandEncoder, [
        p0.createView(),
        u0.createView(),
        v0.createView(),
    ] /*, timestampRecorder.capture() */);

    // Calculate Vortices
    calculateVorticesProgram.dispatch(commandEncoder, [
        u0.createView(),
        v0.createView(),
        vor.createView(),
    ] /*, timestampRecorder.capture() */);

    // Apply Vorticity
    applyVorticityProgram.dispatch(commandEncoder, [
        vor.createView(),
        u0.createView(),
        v0.createView(),
    ] /*, timestampRecorder.capture() */);

    // Advect Dye
    advectionProgram.dispatch(commandEncoder, [
        u0.createView(),
        v0.createView(),
        dye0.createView(),
        dye1.createView(),
    ] /*, timestampRecorder.capture() */);

    temp = dye0;
    dye0 = dye1;
    dye1 = temp;

    // Clear Dye
    clearProgram.dispatch(commandEncoder, [dye0.createView()] /*, timestampRecorder.capture() */);

    // Render Dye
    renderProgram.dispatch(commandEncoder, dye0 /*, timestampRecorder.capture() */);

    // timestampRecorder.resolve(commandEncoder);

    const commandBuffer = commandEncoder.finish();

    gpu.device.queue.submit([commandBuffer]);

    // timestampRecorder.finish().then((timestamps) => {
    //     if (!timestamps) {
    //         return;
    //     }

    //     let gpuTime = 0;

    //     for (let i = 0; i < timestamps.length; i += timestampRecorder.stride) {
    //         const start = timestamps[i];
    //         const end = timestamps[i + 1];

    //         gpuTime += Number(end - start);
    //     }

    //     gpuTimes.unshift(gpuTime / 1000);
    // });
});
