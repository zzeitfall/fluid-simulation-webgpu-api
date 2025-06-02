import type { GPUCanvasDescriptor } from './canvas';

export interface GPUWorkgroupDescriptor {
  sizeX: number;
  sizeY: number;
}

export interface GPUConfiguration {
  canvas: GPUCanvasDescriptor;
  adapter?: GPURequestAdapterOptions;
  device?: GPUDeviceDescriptor;
  workgroup?: GPUWorkgroupDescriptor;
}
