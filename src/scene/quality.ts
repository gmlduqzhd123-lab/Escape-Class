export function sceneQuality(
  width: number,
  height: number,
  touch: boolean,
  dpr: number,
) {
  const mobile = touch || Math.min(width, height) <= 600;
  const pixels = Math.max(1, width) * Math.max(1, height);
  // Phones render near their native density so 3D signs stay sharp in fullscreen.
  const budget = mobile ? 2_600_000 : 3_000_000;
  return {
    mobile,
    pixelRatio: Math.min(
      Number.isFinite(dpr) && dpr > 0 ? dpr : 1,
      mobile ? 2.25 : 2,
      Math.sqrt(budget / pixels),
    ),
    shadows: !mobile,
    antialias: true,
    maxFps: mobile ? 30 : 60,
  };
}
/**
 * Watches frame intervals while the camera moves. When a device keeps falling
 * well below the frame target, it asks for a lower resolution, one step at a
 * time and never below the screen's own 1x, so slow classroom tablets stay
 * smooth while fast ones keep sharp text.
 */
export function createFrameBudget(targetFps: number, samples = 24) {
  const slowMs = (1000 / targetFps) * 1.6;
  let scale = 1;
  let intervals: number[] = [];
  let last = 0;
  return {
    get scale() {
      return scale;
    },
    /** Record a frame drawn during movement; returns true when the scale dropped. */
    frame(now: number) {
      if (last && now - last < 1000) intervals.push(now - last);
      last = now;
      if (intervals.length < samples) return false;
      const sorted = [...intervals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      intervals = [];
      if (median <= slowMs || scale <= 0.5) return false;
      scale = Math.max(0.5, Math.round(scale * 0.75 * 100) / 100);
      return true;
    },
    /** Movement ended; the next movement starts a fresh measurement. */
    pause() {
      last = 0;
    },
  };
}
