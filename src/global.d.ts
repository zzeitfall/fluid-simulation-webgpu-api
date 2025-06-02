import type { GPUCanvas } from './core';
import type { GPUWorkgroupDescriptor } from './types';

declare global {
  const gpu: {
    canvas: GPUCanvas;
    instance: GPU;
    adapter: GPUAdapter;
    device: GPUDevice;
    preferredFormat: GPUTextureFormat;
    workgroup: GPUWorkgroupDescriptor;
  };
}

export {};
