import { defineProperty } from '../utils';

export class GPUCanvas extends HTMLCanvasElement {
    declare private readonly _resizeObserver: ResizeObserver;

    declare readonly context: GPUCanvasContext;

    constructor() {
        super();

        this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
    }

    get area() {
        return this.width * this.height;
    }

    connectedCallback() {
        defineProperty(this, 'context', this.getContext('webgpu'));

        this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
        this._resizeObserver.disconnect();
    }

    configure(configuration: GPUCanvasConfiguration) {
        this.context.configure(configuration);
    }

    private _resizeHandler(entries: ResizeObserverEntry[]) {
        const { devicePixelContentBoxSize } = entries[0];
        const { inlineSize, blockSize } = devicePixelContentBoxSize[0];

        this.width = inlineSize;
        this.height = blockSize;
    }
}
