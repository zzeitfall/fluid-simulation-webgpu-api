import { GPUCanvas } from '../dom';

import { isGPUCanvas } from '../assertions';
import { defineGlobalProperty } from '../utils';

import type { GPUConfiguration } from '../types';

async function handleDeviceLost(device: GPUDevice) {
    const lostInfo = await device.lost;

    window.alert(JSON.stringify(lostInfo, null, 4));
    window.location.reload();
}

export async function initGPU(configuration: GPUConfiguration) {
    try {
        customElements.define('gpu-canvas', GPUCanvas, { extends: 'canvas' });

        const instance = navigator.gpu;
        const adapter = await instance.requestAdapter(configuration.adapter);
        const device = await adapter.requestDevice(configuration.device);
        const preferredFormat = instance.getPreferredCanvasFormat();
        const canvas = document.querySelector(configuration.canvas.selector);

        if (!isGPUCanvas(canvas)) {
            throw new Error('Provided element is either null, undefined, or not an instance of GPUCanvas.');
        }

        const canvasConfiguration = {
            device,
            format: preferredFormat,
            ...configuration.canvas,
        };

        const workgroupDescriptor = {
            sizeX: 8,
            sizeY: 8,
            ...configuration.workgroup,
        };

        canvas.configure(canvasConfiguration);

        defineGlobalProperty('gpu', {
            canvas,
            instance,
            adapter,
            device,
            preferredFormat,
            workgroup: workgroupDescriptor,
        });

        handleDeviceLost(device);
    }
    catch (error) {
        window.alert(error);
    }
}
