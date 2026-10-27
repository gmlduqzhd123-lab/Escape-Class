type Options = {
  enabled: () => boolean;
  onLook: (dx: number, dy: number, touch: boolean) => void;
  onTap: (x: number, y: number) => void;
  /** Two-finger pinch: called with the distance ratio since the last move. */
  onZoom?: (factor: number) => void;
};
type Point = { id: number; x: number; y: number };

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
  let pinch: { a: Point; b: Point; distance: number } | null = null;
  const spread = (p: NonNullable<typeof pinch>) =>
    Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y);

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
    // A second finger zooms the scene (when supported), never an investigation.
    if (event.pointerType === "touch" && !event.isPrimary) {
      const first = pointer;
      cancel();
      suppressClick = true;
      if (first?.touch && options.onZoom && options.enabled() && !pinch) {
        pinch = {
          a: { id: first.id, x: first.lastX, y: first.lastY },
          b: { id: event.pointerId, x: event.clientX, y: event.clientY },
          distance: 0,
        };
        pinch.distance = spread(pinch);
      }
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
        ".classroom-object-label, .classroom-move-label, .classroom-3d-zoom",
      ),
      dragging: false,
      scrolling: false,
    };
    if (!pointer.label) stage.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (pinch) {
      const end = [pinch.a, pinch.b].find((p) => p.id === event.pointerId);
      if (!end) return;
      end.x = event.clientX;
      end.y = event.clientY;
      const distance = spread(pinch);
      if (pinch.distance > 0 && distance > 0 && options.enabled())
        options.onZoom?.(distance / pinch.distance);
      pinch.distance = distance;
      return;
    }
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
  const endPinch = (event: PointerEvent) => {
    if (pinch?.a.id === event.pointerId || pinch?.b.id === event.pointerId)
      pinch = null;
  };
  const up = (event: PointerEvent) => {
    endPinch(event);
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
    endPinch(event);
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
