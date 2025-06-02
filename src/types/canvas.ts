export interface GPUCanvasDescriptor extends Omit<GPUCanvasConfiguration, 'device' | 'format'> {
    selector: string;
    format?: GPUTextureFormat;
}
