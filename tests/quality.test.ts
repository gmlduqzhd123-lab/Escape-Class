import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameBudget, sceneQuality } from "../src/scene/quality";

test("high-density phones sharpen text while retaining the frame and pixel budget", () => {
  const q = sceneQuality(844, 390, true, 3);
  // A 3x phone in fullscreen renders at 2.25x, not 1.5x, so board text is not blurred.
  assert.equal(q.pixelRatio, 2.25);
  assert.ok(844 * 390 * q.pixelRatio ** 2 <= 2_600_001);
  assert.equal(q.maxFps, 30);
  assert.equal(q.shadows, false);
  assert.equal(q.antialias, true);
});
test("large touch displays stay within the mobile pixel budget", () => {
  const q = sceneQuality(1366, 1024, true, 2);
  assert.ok(1366 * 1024 * q.pixelRatio * q.pixelRatio <= 2_600_001);
  assert.ok(q.pixelRatio > 1.3);
  assert.equal(q.mobile, true);
});
test("desktop fullscreen has a bounded buffer while retaining the visual effects", () => {
  const q = sceneQuality(2560, 1440, false, 2);
  assert.ok(2560 * 1440 * q.pixelRatio * q.pixelRatio <= 3000001);
  assert.equal(q.maxFps, 60);
  assert.equal(q.shadows, true);
});
test("slow devices lower resolution step by step while moving, never below half", () => {
  const budget = createFrameBudget(30);
  let t = 0;
  const run = (ms: number, frames = 25) => {
    let dropped = false;
    for (let i = 0; i < frames; i++)
      dropped = budget.frame((t += ms)) || dropped;
    return dropped;
  };
  // A smooth 30fps device keeps full sharpness.
  assert.equal(run(33), false);
  assert.equal(budget.scale, 1);
  // A device stuck near 12fps steps down, and stops at half.
  assert.equal(run(85), true);
  assert.equal(budget.scale, 0.75);
  for (let i = 0; i < 6; i++) run(85);
  assert.equal(budget.scale, 0.5);
  // A pause between movements is not counted as a slow frame.
  const fresh = createFrameBudget(30);
  fresh.frame(0);
  fresh.pause();
  for (let i = 1; i <= 25; i++) fresh.frame(5000 + i * 33);
  assert.equal(fresh.scale, 1);
});
