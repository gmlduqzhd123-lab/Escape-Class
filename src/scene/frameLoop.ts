type Options = {
  canDraw: () => boolean;
  animating: () => boolean;
  draw: (now: number) => void;
  onFailure: () => void;
  maxFps?: number;
  idleFps?: number;
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
    lastDraw = -Infinity;
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
      // Recover an idle buffer without continuously rendering a stationary room.
      const fps =
        force || options.animating()
          ? (options.maxFps ?? 30)
          : (options.idleFps ?? 4);
      if (now - lastDraw + 0.5 >= 1000 / fps) {
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
