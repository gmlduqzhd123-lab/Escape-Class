import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameLoop } from "../src/scene/frameLoop";

function fixture() {
  let id = 0;
  const pending = new Map<number, (now: number) => void>();
  const state = {
    visible: true,
    connected: true,
    active: true,
    moving: false,
    pixels: false,
    throws: false,
    failures: 0,
    draws: 0,
  };
  const loop = createFrameLoop({
    canDraw: () => state.visible && state.connected && state.active,
    animating: () => state.moving,
    draw: () => {
      if (state.throws) throw Error("GPU render failed");
      state.draws++;
      state.pixels = true;
    },
    onFailure: () => {
      state.failures++;
    },
    request: (fn) => {
      pending.set(++id, fn);
      return id;
    },
    cancel: (key) => {
      pending.delete(key);
    },
  });
  return {
    state,
    loop,
    pending,
    frame(now: number) {
      const jobs = [...pending.values()];
      pending.clear();
      for (const job of jobs) job(now);
    },
  };
}

test("an idle classroom repaints after its buffer is cleared without an input event", () => {
  const f = fixture();
  f.loop.request();
  f.frame(0);
  assert.equal(f.state.pixels, true);
  f.state.pixels = false;
  f.frame(40);
  assert.equal(f.state.pixels, true);
  assert.equal(f.pending.size, 1);
});
test("resting room is throttled while movement and invalidation draw immediately", () => {
  const f = fixture();
  f.loop.request();
  f.frame(0);
  f.frame(16);
  assert.equal(f.state.draws, 1);
  f.state.moving = true;
  f.frame(24);
  assert.equal(f.state.draws, 2);
  f.state.moving = false;
  f.loop.request();
  f.frame(25);
  assert.equal(f.state.draws, 3);
  assert.equal(f.pending.size, 1);
});
test("hidden tabs and detached panels stop, then repaint when resumed", () => {
  const f = fixture();
  f.loop.request();
  f.frame(0);
  f.state.visible = false;
  f.frame(40);
  assert.equal(f.pending.size, 0);
  f.state.visible = true;
  f.state.connected = false;
  f.loop.request();
  assert.equal(f.pending.size, 0);
  f.state.connected = true;
  f.loop.request();
  f.frame(41);
  assert.equal(f.state.draws, 2);
  f.state.active = false;
  f.loop.stop();
  assert.equal(f.pending.size, 0);
  f.state.active = true;
  f.loop.request();
  f.frame(42);
  assert.equal(f.state.draws, 3);
});
test("a thrown WebGL render falls back once and cannot silently leave a dead loop", () => {
  const f = fixture();
  f.state.throws = true;
  f.loop.request();
  f.frame(0);
  assert.equal(f.state.failures, 1);
  assert.equal(f.pending.size, 0);
  f.loop.request();
  f.loop.fail();
  assert.equal(f.pending.size, 0);
  assert.equal(f.state.failures, 1);
});
test("context or shader failure cancels already scheduled frames", () => {
  const f = fixture();
  f.loop.request();
  f.frame(0);
  f.loop.fail();
  assert.equal(f.state.failures, 1);
  assert.equal(f.pending.size, 0);
});
test("disposing the classroom prevents subsequent redraws and failure callbacks", () => {
  const f = fixture();
  f.loop.request();
  f.loop.dispose();
  f.loop.request();
  f.loop.fail();
  f.frame(100);
  assert.equal(f.pending.size, 0);
  assert.equal(f.state.draws, 0);
  assert.equal(f.state.failures, 0);
});
