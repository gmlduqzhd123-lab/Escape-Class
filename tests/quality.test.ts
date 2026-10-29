import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneQuality } from "../src/scene/quality";

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
