interface PointerListener {
    (event: PointerEvent): void;
}

export function createPointerController(target: HTMLElement) {
    const handlers = new Map<string, PointerListener>();
    const events = new Map<string, PointerListener[]>();

    function on(type: string, listener: PointerListener) {
        const isHandlerDefined = handlers.has(type);
        const isEventDefined = events.has(type);

        if (isHandlerDefined && isEventDefined) {
            events.get(type).push(listener);

            return;
        }

        handlers.set(type, (event) => {
            listener(event);

            events.set(type, [listener]);
        });

        // @ts-expect-error ...
        target.addEventListener(type, handlers.get(type));
    }

    return {
        on,
    };
}
