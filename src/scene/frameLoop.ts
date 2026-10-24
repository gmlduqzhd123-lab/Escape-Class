type Options = {
  canDraw: () => boolean;
  animating: () => boolean;
  draw: (now: number) => void;
  onFailure: () => void;
  request?: (callback: (now: number) => void) => number;
  cancel?: (id: number) => void;
};

/** Mobile compositors can discard an idle WebGL buffer without a resize event. */
export function createFrameLoop(options: Options) {
  const request = options.request ?? requestAnimationFrame;
  const cancel = options.cancel ?? cancelAnimationFrame;
  let frame = 0;
  let lastDraw = -Infinity;
  let force = true;
  let disposed = false;
  let failed = false;
  function schedule() {
    if (!disposed && !failed && !frame && options.canDraw())
      frame = request(tick);
  }
  function stop() {
    if (frame) cancel(frame);
    frame = 0;
  }
  function fail() {
    if (failed || disposed) return;
    failed = true;
    stop();
    options.onFailure();
  }
  function tick(now: number) {
    frame = 0;
    if (disposed || failed || !options.canDraw()) return;
    try {
      // Keep the resting room alive at 30 fps; gestures and walks can use 60 fps.
      if (force || options.animating() || now - lastDraw >= 1000 / 30) {
        force = false;
        lastDraw = now;
        options.draw(now);
      }
    } catch {
      fail();
      return;
    }
    schedule();
  }
  return {
    request() {
      force = true;
      schedule();
    },
    stop,
    fail,
    dispose() {
      stop();
      disposed = true;
    },
  };
}
