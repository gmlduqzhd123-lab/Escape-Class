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
