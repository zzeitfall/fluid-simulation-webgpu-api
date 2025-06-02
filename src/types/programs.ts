export interface GPUProgramDescriptor {
  shader: string;
}

export interface GPUComputeProgramDescriptor extends GPUProgramDescriptor {
  uniforms: GPUBuffer[];
  textures: Pick<GPUBindGroupLayoutEntry, 'texture' | 'storageTexture' | 'externalTexture'>[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GPURenderProgramDescriptor extends GPUProgramDescriptor {}
