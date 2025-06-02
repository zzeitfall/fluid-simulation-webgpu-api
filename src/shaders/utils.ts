export const ARRAY_UTILS_SHADER = `
    fn ix(position : vec2u) -> u32 {
        var x     = position.x;
        var y     = position.y;
        var width = u_grid.width;

        return x + y * width;
    }
`;
