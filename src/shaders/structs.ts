export const VERTEX_INPUT_STRUCT_SHADER = `
    struct VSInput {
        @location(0) position : vec2f,
    }
`;

export const VERTEX_OUTPUT_STRUCT_SHADER = `
    struct VSOutput {
        @builtin(position) position : vec4f,
        @location(0) texel_position : vec2f,
    }
`;

export const COMPUTE_INPUT_STRUCT_SHADER = `
    struct CSInput {
        @builtin(global_invocation_id) global_id : vec3u,
    }
`;

export const SETTINGS_UNIFORMS_STRUCT_SHADER = `
    struct SettingsUniforms {
        dt        : f32,
        density   : f32,
        vorticity : f32,
    }
`;

export const GRID_UNIFORMS_STRUCT_SHADER = `
    struct GridUniforms {
        width  : u32,
        height : u32,
        dx     : u32,
    }
`;

export const POINTER_UNIFORMS_STRUCT_SHADER = `
    struct PointerUniforms {
        position : vec2f,
        movement : vec2f,
        pressed  : f32,
    }
`;

export const SPLAT_UNIFORMS_STRUCT_SHADER = `
    struct SplatUniforms {
        radius    : f32,
        intensity : f32,
        force     : f32,
    }
`;
