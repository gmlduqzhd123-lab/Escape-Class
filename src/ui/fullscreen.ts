export interface FullscreenController {
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
  isFullscreen(): boolean;
  isFallback(): boolean;
  dispose(): void;
}

/** Keeps immersion separate from game progress and survives updates inside #app. */
export function createFullscreenController(
  target: HTMLElement,
  onChange: () => void,
): FullscreenController {
  const doc = target.ownerDocument;
  let fallback = false;
  let disposed = false;
  let desired = false;
  let generation = 0;
  let pending: Promise<void> | undefined;
  let lastFullscreen = false;
  let lastFallback = false;

  const isFullscreen = () => !disposed && doc.fullscreenElement === target;
  const isFallback = () => !disposed && fallback && !isFullscreen();

  function sync() {
    if (disposed) return;
    const native = isFullscreen();
    const fill = isFallback();
    target.classList.toggle("immersive-fullscreen", native);
    target.classList.toggle("immersive-fallback", fill);
    if (native === lastFullscreen && fill === lastFallback) return;
    lastFullscreen = native;
    lastFallback = fill;
    // Record the state before notifying: a render callback may call sync again.
    onChange();
  }

  async function leaveNative() {
    if (doc.fullscreenElement !== target || !doc.exitFullscreen) return;
    try {
      await doc.exitFullscreen();
    } catch {
      // The browser remains authoritative if it refuses an exit request.
    }
    sync();
  }

  function enter(): Promise<void> {
    if (disposed) return Promise.resolve();
    desired = true;
    if (isFullscreen()) {
      fallback = false;
      sync();
      return Promise.resolve();
    }
    if (pending) return pending;
    const requestGeneration = ++generation;
    if (
      !doc.fullscreenEnabled ||
      typeof target.requestFullscreen !== "function"
    ) {
      fallback = true;
      sync();
      return Promise.resolve();
    }

    let request: Promise<void>;
    try {
      // Intentionally called before any await to retain the click's activation.
      request = target.requestFullscreen();
    } catch {
      fallback = true;
      sync();
      return Promise.resolve();
    }
    pending = Promise.resolve(request)
      .then(async () => {
        if (disposed || requestGeneration !== generation) {
          // A late successful request must not undo the player's exit choice.
          if (disposed || !desired) await leaveNative();
          return;
        }
        fallback = !isFullscreen();
        sync();
      })
      .catch(() => {
        if (disposed || requestGeneration !== generation) return;
        fallback = !isFullscreen();
        sync();
      })
      .finally(() => {
        if (requestGeneration === generation) pending = undefined;
      });
    return pending;
  }

  async function exit() {
    if (disposed) return;
    generation += 1;
    desired = false;
    pending = undefined;
    fallback = false;
    sync();
    await leaveNative();
  }

  function onFullscreenChange() {
    if (disposed) return;
    if (isFullscreen()) fallback = false;
    else if (lastFullscreen) {
      // Escape and the browser's own controls are genuine exits, not failures.
      generation += 1;
      desired = false;
      pending = undefined;
      fallback = false;
    }
    sync();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !isFallback()) return;
    event.preventDefault();
    void exit();
  }

  doc.addEventListener("fullscreenchange", onFullscreenChange);
  doc.addEventListener("keydown", onKeyDown);
  sync();

  return {
    enter,
    exit,
    toggle: () =>
      isFullscreen() || isFallback() || pending ? exit() : enter(),
    isFullscreen,
    isFallback,
    dispose() {
      if (disposed) return;
      disposed = true;
      desired = false;
      generation += 1;
      pending = undefined;
      fallback = false;
      doc.removeEventListener("fullscreenchange", onFullscreenChange);
      doc.removeEventListener("keydown", onKeyDown);
      target.classList.remove("immersive-fullscreen", "immersive-fallback");
      void leaveNative();
    },
  };
}
