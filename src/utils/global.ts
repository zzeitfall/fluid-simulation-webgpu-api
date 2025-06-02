export function defineProperty(context: unknown, name: string, value: unknown) {
    Object.defineProperty(context, name, {
        value,
        writable: false,
        enumerable: false,
        configurable: false,
    });
}

export function defineGlobalProperty(name: string, value: unknown) {
    defineProperty(globalThis, name, value);
}
