import { test } from "node:test";
import assert from "node:assert/strict";
import { bindSceneGestures } from "../src/scene/gestures";

class Surface extends EventTarget {
  captures = new Set<number>();
  classes = new Set<string>();
  classList = {
    add: (value: string) => this.classes.add(value),
    remove: (value: string) => this.classes.delete(value),
  };
  closest() {
    return null;
  }
  setPointerCapture(id: number) {
    this.captures.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captures.has(id);
  }
  releasePointerCapture(id: number) {
    this.captures.delete(id);
  }
}
function fixture() {
  const stage = new Surface();
  const label = { closest: () => label };
  const looks: number[][] = [];
  const taps: number[][] = [];
  const zooms: number[] = [];
  let enabled = true;
  const controller = bindSceneGestures(stage as unknown as HTMLElement, {
    enabled: () => enabled,
    onLook: (x, y, touch) => looks.push([x, y, Number(touch)]),
    onTap: (x, y) => taps.push([x, y]),
    onZoom: (factor) => zooms.push(factor),
  });
  function send(type: string, values: Record<string, unknown> = {}) {
    const event = new Event(type, { cancelable: true });
    const { target, ...properties } = values;
    Object.assign(event, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      detail: 1,
      ...properties,
    });
    if (target) Object.defineProperty(event, "target", { value: target });
    stage.dispatchEvent(event);
    return event;
  }
  return {
    stage,
    label,
    looks,
    taps,
    zooms,
    controller,
    send,
    disable: () => {
      enabled = false;
    },
  };
}

test("small finger jitter still taps a scene object once", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointermove", { clientX: 110, clientY: 103 });
  f.send("pointerup", { clientX: 110, clientY: 103 });
  assert.deepEqual(f.taps, [[110, 103]]);
  assert.deepEqual(f.looks, []);
  assert.equal(f.stage.captures.size, 0);
});
test("a native label tap uses the button click without a duplicate mesh tap", () => {
  const f = fixture();
  f.send("pointerdown", { target: f.label });
  f.send("pointerup", { target: f.label });
  assert.equal(f.send("click", { target: f.label }).defaultPrevented, false);
  assert.equal(f.taps.length, 0);
});
test("horizontal label swipe survives the label losing implicit touch capture", () => {
  const f = fixture();
  f.send("pointerdown", { target: f.label });
  f.send("pointermove", { clientX: 125, target: f.label });
  f.send("lostpointercapture", { target: f.label });
  f.send("pointermove", { clientX: 150 });
  f.send("pointerup", { clientX: 150 });
  assert.equal(f.looks.length, 2);
  assert.equal(f.taps.length, 0);
  assert.equal(f.send("click").defaultPrevented, true);
  assert.equal(f.send("click", { detail: 0 }).defaultPrevented, false);
  f.send("pointerdown");
  f.send("pointerup");
  assert.equal(f.taps.length, 1);
});
test("vertical touch scroll never turns or selects a scene object", () => {
  const f = fixture();
  f.send("pointerdown", { target: f.label });
  f.send("pointermove", { clientY: 130, clientX: 103 });
  f.send("pointermove", { clientY: 150, clientX: 130 });
  f.send("pointerup", { clientY: 150, clientX: 130 });
  assert.equal(f.looks.length, 0);
  assert.equal(f.taps.length, 0);
  assert.equal(f.send("click").defaultPrevented, true);
});
test("a second finger cancels investigation and the next single tap still works", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointerdown", { pointerId: 2, isPrimary: false });
  f.send("pointermove", { clientX: 160 });
  f.send("pointerup");
  assert.equal(f.looks.length + f.taps.length, 0);
  assert.equal(f.send("click").defaultPrevented, true);
  f.send("pointerdown");
  f.send("pointerup");
  assert.equal(f.taps.length, 1);
});
test("two-finger pinch zooms by the spread ratio and never looks or taps", () => {
  const f = fixture();
  f.send("pointerdown", { clientX: 100 });
  f.send("pointerdown", { pointerId: 2, isPrimary: false, clientX: 200 });
  // Spread 100 → 150 → 300: factors 1.5 then 2.
  f.send("pointermove", { pointerId: 2, isPrimary: false, clientX: 250 });
  f.send("pointermove", { clientX: -50 });
  assert.deepEqual(f.zooms, [1.5, 2]);
  f.send("pointerup", { pointerId: 2, isPrimary: false });
  f.send("pointermove", { clientX: 0 });
  f.send("pointerup");
  assert.equal(f.zooms.length, 2);
  assert.equal(f.looks.length + f.taps.length, 0);
  // After both fingers lift, a single tap investigates again.
  f.send("pointerdown");
  f.send("pointerup");
  assert.equal(f.taps.length, 1);
});
test("a pinch whose finger lift was never seen does not block the next swipe", () => {
  const f = fixture();
  f.send("pointerdown", { clientX: 100 });
  f.send("pointerdown", { pointerId: 2, isPrimary: false, clientX: 200 });
  f.send("pointermove", { pointerId: 2, isPrimary: false, clientX: 260 });
  assert.equal(f.zooms.length, 1);
  // Both lifts happen over the HUD and never reach the stage.
  f.send("pointerdown", { pointerId: 3, clientX: 100 });
  f.send("pointermove", { pointerId: 3, clientX: 160 });
  assert.equal(f.looks.length, 1);
  assert.equal(f.zooms.length, 1);
});
test("cancelling the scene gestures also ends a pinch", () => {
  const f = fixture();
  f.send("pointerdown", { clientX: 100 });
  f.send("pointerdown", { pointerId: 2, isPrimary: false, clientX: 200 });
  f.controller.cancel();
  f.send("pointermove", { pointerId: 2, isPrimary: false, clientX: 300 });
  assert.deepEqual(f.zooms, []);
});
test("a paused scene ignores pinch zoom", () => {
  const f = fixture();
  f.send("pointerdown", { clientX: 100 });
  f.disable();
  f.send("pointerdown", { pointerId: 2, isPrimary: false, clientX: 200 });
  f.send("pointermove", { pointerId: 2, isPrimary: false, clientX: 300 });
  assert.deepEqual(f.zooms, []);
});
test("cancellation and capture loss ignore other pointers and cancel the active one", () => {
  const f = fixture();
  f.send("pointerdown");
  f.send("pointercancel", { pointerId: 9 });
  f.send("pointerup");
  assert.equal(f.taps.length, 1);
  f.send("pointerdown");
  f.send("lostpointercapture");
  f.send("pointerup");
  assert.equal(f.taps.length, 1);
  assert.equal(f.send("click").defaultPrevented, true);
  assert.equal(f.stage.captures.size, 0);
});
test("a touch long-press context menu cannot investigate on release", () => {
  const f = fixture();
  f.send("pointerdown", { target: f.label });
  assert.equal(f.send("contextmenu").defaultPrevented, true);
  f.send("pointerup");
  assert.equal(f.taps.length, 0);
  assert.equal(f.send("click").defaultPrevented, true);
});
test("mouse dragging retains vertical look while touch uses horizontal look", () => {
  const f = fixture();
  f.send("pointerdown", { pointerType: "mouse" });
  f.send("pointermove", { pointerType: "mouse", clientY: 120 });
  f.send("pointerup", { pointerType: "mouse", clientY: 120 });
  assert.deepEqual(f.looks, [[0, 20, 0]]);
  assert.equal(f.taps.length, 0);
});
test("pausing or disposing prevents late taps and releases capture", () => {
  const f = fixture();
  f.send("pointerdown");
  f.disable();
  f.controller.cancel();
  f.send("pointerup");
  assert.equal(f.taps.length, 0);
  assert.equal(f.stage.captures.size, 0);
  f.controller.dispose();
  f.send("pointerdown");
  f.send("pointerup");
  assert.equal(f.taps.length, 0);
});
