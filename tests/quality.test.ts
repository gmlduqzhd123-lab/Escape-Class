import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneQuality } from "../src/scene/quality";

test("high-density phones keep a small drawing buffer and omit expensive passes", () => {
  const q = sceneQuality(844, 390, true, 3);
  assert.equal(q.pixelRatio, 1);
  assert.equal(q.maxFps, 30);
  assert.equal(q.shadows, false);
  assert.equal(q.antialias, true);
});
test("large touch displays stay within the mobile pixel budget", () => {
  const q = sceneQuality(1366, 1024, true, 2);
  assert.ok(1366 * 1024 * q.pixelRatio * q.pixelRatio <= 500001);
  assert.equal(q.mobile, true);
});
test("desktop fullscreen has a bounded buffer while retaining the visual effects", () => {
  const q = sceneQuality(2560, 1440, false, 2);
  assert.ok(2560 * 1440 * q.pixelRatio * q.pixelRatio <= 1500001);
  assert.equal(q.maxFps, 60);
  assert.equal(q.shadows, true);
});
