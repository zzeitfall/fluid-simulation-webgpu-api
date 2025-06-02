// Formulas mainly taken from this article: https://www.cs.ubc.ca/~rbridson/fluidsimulation/fluids_notes.pdf

import {
    VERTEX_INPUT_STRUCT_SHADER,
    VERTEX_OUTPUT_STRUCT_SHADER,
    COMPUTE_INPUT_STRUCT_SHADER,
    SETTINGS_UNIFORMS_STRUCT_SHADER,
    GRID_UNIFORMS_STRUCT_SHADER,
    POINTER_UNIFORMS_STRUCT_SHADER,
    SPLAT_UNIFORMS_STRUCT_SHADER,
} from './structs';

import { BOUND_ASSERTIONS_SHADER, POINTER_ASSERTIONS_SHADER } from './assertions';

export const POINTER_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}
    ${POINTER_UNIFORMS_STRUCT_SHADER}
    ${SPLAT_UNIFORMS_STRUCT_SHADER}
    
    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(0) @binding(2) var<uniform> u_pointer  : PointerUniforms;
    @group(0) @binding(3) var<uniform> u_splat    : SplatUniforms;
    @group(1) @binding(0) var          u          : texture_storage_2d<r32float, read_write>;
    @group(1) @binding(1) var          v          : texture_storage_2d<r32float, read_write>;
    @group(1) @binding(2) var          dye        : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}
    ${POINTER_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position) || !is_pointer_valid()) {
            return;
        }
            
        var movement            = u_pointer.movement;
        var movement_force      = length(movement);
        var movement_normalized = normalize(movement);

        var splat_distance  = length(f_thread_position - u_pointer.position);
        var splat_radius    = u_splat.radius;
        var splat_intensity = u_splat.intensity;
        var splat_force     = u_splat.force;

        if (splat_distance <= splat_radius) {
            var splat_fade = 1 - splat_distance / splat_radius;

            var current_u   = textureLoad(u, thread_position)[0];
            var current_v   = textureLoad(v, thread_position)[0];
            var current_dye = textureLoad(dye, thread_position)[0];

            var new_u   = current_u   + splat_fade * splat_force * movement_normalized.x;
            var new_v   = current_v   + splat_fade * splat_force * movement_normalized.y;
            var new_dye = current_dye + splat_fade * splat_intensity * movement_force;

            textureStore(u, thread_position, vec4f(new_u, 0, 0, 0));
            textureStore(v, thread_position, vec4f(new_v, 0, 0, 0));
            textureStore(dye, thread_position, vec4f(new_dye, 0, 0, 0));
        }
    }
`;

export const ADVECTION_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(1) @binding(0) var          u          : texture_storage_2d<r32float, read>;
    @group(1) @binding(1) var          v          : texture_storage_2d<r32float, read>;
    @group(1) @binding(2) var          q0         : texture_storage_2d<r32float, read>;
    @group(1) @binding(3) var          q1         : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position)) {
            return;
        }

        var dt = u_settings.dt;

        var thread_u = f_thread_position.x;
        var thread_v = f_thread_position.y;

        var u_size = textureDimensions(u);
        var v_size = textureDimensions(v);

        var uL = textureLoad(u, thread_position)[0];               // u(i - 1/2, j)
        var uR = textureLoad(u, thread_position + vec2u(1, 0))[0]; // u(i + 1/2, j)
        var vT = textureLoad(v, thread_position)[0];               // v(i, j - 1/2)
        var vB = textureLoad(v, thread_position + vec2u(0, 1))[0]; // v(i, j + 1/2)

        var u        = (uL + uR) / 2; // (2.22)
        var v        = (vT + vB) / 2; // (2.22)
        var traced_u = clamp(thread_u - dt * u, 0f, f32(u_size.x)); // (3.7)
        var traced_v = clamp(thread_v - dt * v, 0f, f32(v_size.y)); // (3.7)
        var int_u    = i32(floor(traced_u));
        var int_v    = i32(floor(traced_v));
        var fract_u  = fract(traced_u);
        var fract_v  = fract(traced_v);

        var L = int_u;
        var R = L + 1;
        var T = int_v;
        var B = T + 1;

        var TL = vec2i(L, T);
        var TR = vec2i(R, T);
        var BL = vec2i(L, B);
        var BR = vec2i(R, B);

        var qTL = textureLoad(q0, TL)[0];
        var qTR = textureLoad(q0, TR)[0];
        var qBL = textureLoad(q0, BL)[0];
        var qBR = textureLoad(q0, BR)[0];

        var qT = mix(qTL, qTR, fract_u);
        var qB = mix(qBL, qBR, fract_u);

        textureStore(q1, thread_position, vec4f(mix(qT, qB, fract_v), 0, 0, 0));
    }
`;

export const CALCULATE_DIVERGENCE_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(1) @binding(0) var          u          : texture_storage_2d<r32float, read>;
    @group(1) @binding(1) var          v          : texture_storage_2d<r32float, read>;
    @group(1) @binding(2) var          div        : texture_storage_2d<r32float, read_write>;
    @group(1) @binding(3) var          p          : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position)) {
            return;
        }

        var dx = f32(u_grid.dx);

        var div_normalizer = 1 / dx;

        var uL = textureLoad(u, thread_position)[0];               // u(i - 1/2, j)
        var uR = textureLoad(u, thread_position + vec2u(1, 0))[0]; // u(i + 1/2, j)
        var vT = textureLoad(v, thread_position)[0];               // v(i, j - 1/2)
        var vB = textureLoad(v, thread_position + vec2u(0, 1))[0]; // v(i, j + 1/2)

        var div_value = ((uR - uL) + (vB - vT)) * div_normalizer; // (4.13)

        textureStore(div, thread_position, vec4f(div_value, 0, 0, 0));
        textureStore(p, thread_position, vec4f(0)); // Clear pressure for Jacobi iteration method
    }
`;

export const CALCULATE_PRESSURE_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(1) @binding(0) var          div        : texture_storage_2d<r32float, read>;
    @group(1) @binding(1) var          p0         : texture_storage_2d<r32float, read>;
    @group(1) @binding(2) var          p1         : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position)) {
            return;
        }

        var dx = f32(u_grid.dx);
        var dt = u_settings.dt;
        var density = u_settings.density;

        var div_normalizer = dx * dx * density / dt;
        var divC           = textureLoad(div, thread_position)[0];

        var pL = textureLoad(p0, thread_position - vec2u(1, 0))[0]; // p(i - 1, j)
        var pR = textureLoad(p0, thread_position + vec2u(1, 0))[0]; // p(i + 1, j)
        var pT = textureLoad(p0, thread_position - vec2u(0, 1))[0]; // p(i, j - 1)
        var pB = textureLoad(p0, thread_position + vec2u(0, 1))[0]; // p(i, j + 1)

        var p_value = (pL + pR + pT + pB - divC * div_normalizer) / 4; // (4.19)

        textureStore(p1, thread_position, vec4f(p_value, 0, 0, 0));
    }
`;

export const SUBTRACT_PRESSURE_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(1) @binding(0) var          p          : texture_storage_2d<r32float, read_write>;
    @group(1) @binding(1) var          u          : texture_storage_2d<r32float, read_write>;
    @group(1) @binding(2) var          v          : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_outside_bounds(thread_position, 0)) {
            return;
        }

        var dx      = f32(u_grid.dx);
        var dt      = u_settings.dt;
        var density = u_settings.density;

        var u_size = textureDimensions(u);
        var v_size = textureDimensions(v);

        var p_normalizer = dt / (dx * density);

        if (thread_position.x < u_size.x - 1 && thread_position.y < u_size.y) {
            var pL = textureLoad(p, thread_position)[0];
            var pR = textureLoad(p, thread_position + vec2u(1, 0))[0];

            var u_position = thread_position + vec2u(1, 0);

            var u0 = textureLoad(u, u_position)[0];
            var u1 = u0 - (pR - pL) * p_normalizer; // (4.4)

            textureStore(u, u_position, vec4f(u1, 0, 0, 0));
        }

        if (thread_position.y < v_size.y - 1 && thread_position.x < v_size.x) {
            var pT = textureLoad(p, thread_position)[0];
            var pB = textureLoad(p, thread_position + vec2u(0, 1))[0];

            var v_position = thread_position + vec2u(0, 1);

            var v0 = textureLoad(v, v_position)[0];
            var v1 = v0 - (pB - pT) * p_normalizer; // (4.5)

            textureStore(v, v_position, vec4f(v1, 0, 0, 0));
        }
    }
`;

export const CALCULATE_VORTICES_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(1) @binding(0) var          u          : texture_storage_2d<r32float, read>;
    @group(1) @binding(1) var          v          : texture_storage_2d<r32float, read>;
    @group(1) @binding(2) var          vor        : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position)) {
            return;
        }

        var dx = f32(u_grid.dx);

        var vor_normalizer = 1 / (2 * dx);

        var vL = textureLoad(v, thread_position - vec2u(1, 0))[0];
        var vR = textureLoad(v, thread_position + vec2u(1, 0))[0];
        var uT = textureLoad(u, thread_position - vec2u(0, 1))[0];
        var uB = textureLoad(u, thread_position + vec2u(0, 1))[0];

        var vor_value = ((vR - vL) - (uB - uT)) * vor_normalizer;

        textureStore(vor, thread_position, vec4f(vor_value, 0, 0, 0)); // (5.3) or 2D version of (5.6) -> A.1.3
    }
`;

export const APPLY_VORTICITY_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${SETTINGS_UNIFORMS_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_settings : SettingsUniforms;
    @group(0) @binding(1) var<uniform> u_grid     : GridUniforms;
    @group(1) @binding(0) var          vor        : texture_storage_2d<r32float, read>;
    @group(1) @binding(1) var          u          : texture_storage_2d<r32float, read_write>;
    @group(1) @binding(2) var          v          : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position)) {
            return;
        }

        var dx        = f32(u_grid.dx);
        var vorticity = u_settings.vorticity;

        var grad_normalizer = 1 / (2 * dx);

        var vorC = textureLoad(vor, thread_position)[0];
        var vorL = abs(textureLoad(vor, thread_position - vec2u(1, 0))[0]);
        var vorR = abs(textureLoad(vor, thread_position + vec2u(1, 0))[0]);
        var vorT = abs(textureLoad(vor, thread_position - vec2u(0, 1))[0]);
        var vorB = abs(textureLoad(vor, thread_position + vec2u(0, 1))[0]);

        var grad_vor_x      = (vorR - vorL) * grad_normalizer; // 2D version of (5.7)
        var grad_vor_y      = (vorB - vorT) * grad_normalizer; // 2D version of (5.7)
        var grad_vor_length = max(length(vec2f(grad_vor_x, grad_vor_y)), 1e-8);

        grad_vor_x /= grad_vor_length;
        grad_vor_y /= grad_vor_length;

        var vor_force = dx * vorticity * vorC;

        var u0 = textureLoad(u, thread_position)[0];
        var v0 = textureLoad(v, thread_position)[0];

        var u1 = u0 + grad_vor_y * vor_force;
        var v1 = v0 - grad_vor_x * vor_force;

        textureStore(u, thread_position, vec4f(u1, 0, 0, 0));
        textureStore(v, thread_position, vec4f(v1, 0, 0, 0));
    }
`;

export const CLEAR_PROGRAM_SHADER = `
    ${COMPUTE_INPUT_STRUCT_SHADER}
    ${GRID_UNIFORMS_STRUCT_SHADER}

    @id(0) override WG_SIZE_X : u32;
    @id(1) override WG_SIZE_Y : u32;

    @group(0) @binding(0) var<uniform> u_grid  : GridUniforms;
    @group(1) @binding(0) var          q       : texture_storage_2d<r32float, read_write>;

    ${BOUND_ASSERTIONS_SHADER}

    @compute @workgroup_size(WG_SIZE_X, WG_SIZE_Y)
    fn main(input : CSInput) {
        var thread_position   = input.global_id.xy;
        var f_thread_position = vec2f(thread_position);

        if (is_exterior(thread_position)) {
            return;
        }

        var current_q = textureLoad(q, thread_position);

        textureStore(q, thread_position, .99 * current_q);
    }
`;

export const RENDER_PROGRAM_SHADER = `
    ${VERTEX_INPUT_STRUCT_SHADER}
    ${VERTEX_OUTPUT_STRUCT_SHADER}

    @group(0) @binding(0) var texture         : texture_2d<f32>;
    @group(0) @binding(1) var texture_sampler : sampler;

    fn jet_color(value : f32) -> vec3f {
        var v0 = clamp(value, 0, 1);
        var v1 = vec3f(0);

        v1.r = clamp(1.5 - 4 * abs(v0 - .75), 0, 1);
        v1.g = clamp(1.5 - 4 * abs(v0 - .5), 0, 1);
        v1.b = clamp(1.5 - 4 * abs(v0 - .25), 0, 1);

        return v1;
    }

    @vertex
    fn vs_main(input : VSInput) -> VSOutput {
        var output : VSOutput;

        output.position         = vec4f(input.position, 0, 1);
        output.texel_position   = (input.position + 1) / 2;
        output.texel_position.y = 1 - output.texel_position.y;

        return output;
    }

    @fragment
    fn fs_main(input : VSOutput) -> @location(0) vec4f {
        var texture_size   = vec2f(textureDimensions(texture, 0));
        var texel_position = vec2u(input.texel_position * texture_size);
        var texel_color    = textureLoad(texture, texel_position, 0);

        return vec4f(jet_color(texel_color.x), 1);

        // return textureSample(texture, texture_sampler, input.texel_position);
    }
`;
