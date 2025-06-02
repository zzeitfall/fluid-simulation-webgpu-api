export function createRAFLoop(callback: (...args: unknown[]) => void, immediate = true) {
    let rafID = 0;

    if (immediate) {
        _loop();
    }

    function _loop() {
        callback();

        start();
    }

    function start() {
        rafID = requestAnimationFrame(_loop);
    }

    function once() {
        if (immediate) {
            stop();

            return;
        }

        _loop();

        stop();
    }

    function stop() {
        cancelAnimationFrame(rafID);
    }

    return {
        start,
        once,
        stop,
    };
}
