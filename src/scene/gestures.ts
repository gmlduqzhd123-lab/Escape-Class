type Options = {
  enabled: () => boolean;
  onLook: (dx: number, dy: number, touch: boolean) => void;
  onTap: (x: number, y: number) => void;
};

/** Pointer Events keep touch scrolling, scene swipes and native button taps separate. */
export function bindSceneGestures(stage: HTMLElement, options: Options) {
  let pointer: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    touch: boolean;
    label: boolean;
    dragging: boolean;
    scrolling: boolean;
  } | null = null;
  let suppressClick = false;

  function clear() {
    const previous = pointer;
    pointer = null;
    stage.classList.remove("dragging");
    if (previous && stage.hasPointerCapture(previous.id))
      stage.releasePointerCapture(previous.id);
  }
  function cancel() {
    if (pointer) suppressClick = true;
    clear();
  }
  const down = (event: PointerEvent) => {
    // A second finger belongs to a browser gesture, never an investigation.
    if (event.pointerType === "touch" && !event.isPrimary) {
      cancel();
      suppressClick = true;
      return;
    }
    if (!options.enabled() || event.button !== 0 || !event.isPrimary) return;
    clear();
    suppressClick = false;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      touch: event.pointerType === "touch",
      label: !!(event.target as Element).closest(
        ".classroom-object-label, .classroom-move-label",
      ),
      dragging: false,
      scrolling: false,
    };
    if (!pointer.label) stage.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id || !options.enabled())
      return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const slop = pointer.touch ? 14 : 9;
    if (!pointer.dragging && !pointer.scrolling && Math.hypot(dx, dy) >= slop) {
      pointer.scrolling = pointer.touch && Math.abs(dy) >= Math.abs(dx);
      pointer.dragging = !pointer.scrolling;
      if (pointer.dragging) {
        stage.setPointerCapture(event.pointerId);
        stage.classList.add("dragging");
      }
    }
    if (pointer.dragging)
      options.onLook(
        event.clientX - pointer.lastX,
        event.clientY - pointer.lastY,
        pointer.touch,
      );
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  };
  const up = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const label = pointer.label;
    const tapped =
      !pointer.dragging &&
      !pointer.scrolling &&
      Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <
        (pointer.touch ? 14 : 9);
    suppressClick = !tapped;
    clear();
    if (tapped && !label && options.enabled())
      options.onTap(event.clientX, event.clientY);
  };
  const click = (event: MouseEvent) => {
    // Keep keyboard/assistive clicks (detail=0) working after a cancelled swipe.
    if (suppressClick && event.detail > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }
  };
  const pointerCancel = (event: PointerEvent) => {
    if (event.pointerId === pointer?.id) cancel();
  };
  const lostCapture = (event: PointerEvent) => {
    // A touch label loses implicit capture when the stage takes a swipe.
    if (event.target === stage && event.pointerId === pointer?.id) cancel();
  };
  const contextMenu = (event: Event) => {
    if (pointer?.touch) {
      event.preventDefault();
      cancel();
    }
  };
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", pointerCancel);
  stage.addEventListener("lostpointercapture", lostCapture);
  stage.addEventListener("click", click, true);
  stage.addEventListener("contextmenu", contextMenu);
  return {
    cancel,
    dispose() {
      cancel();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", pointerCancel);
      stage.removeEventListener("lostpointercapture", lostCapture);
      stage.removeEventListener("click", click, true);
      stage.removeEventListener("contextmenu", contextMenu);
    },
  };
}
