// Canvas drawing for the 3D room's signs and notes, kept free of three.js so it
// can be read (and reasoned about) on its own.
const INK = "#385148";
// Panels draw in a fixed 768×384 space. The canvas itself matches the plane's
// shape and size, so that space is stretched; text() undoes the stretch per glyph.
export const LOGICAL_W = 768,
  LOGICAL_H = 384;
const glyphStretch = new WeakMap<HTMLCanvasElement, number>();
export function paintPanel(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  size: number[],
  max: number,
) {
  const surface = document.createElement("canvas");
  const aspect = size[0] / size[1];
  // About 700 texels per metre, at least 768 on the long side and 512 on the short.
  const long = Math.min(max, Math.max(768, Math.max(...size) * 700));
  let width = aspect >= 1 ? long : long * aspect;
  let height = aspect >= 1 ? long / aspect : long;
  const grow = Math.min(
    Math.max(1, 512 / Math.min(width, height)),
    max / Math.max(width, height),
  );
  surface.width = Math.round(width * grow);
  surface.height = Math.round(height * grow);
  const ctx = surface.getContext("2d")!;
  ctx.scale(surface.width / LOGICAL_W, surface.height / LOGICAL_H);
  glyphStretch.set(surface, aspect / (LOGICAL_W / LOGICAL_H));
  draw(ctx, LOGICAL_W, LOGICAL_H);
  return surface;
}
export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = INK,
  maxWidth = Infinity,
) {
  // Pre-squeeze glyphs against the panel stretch so they read at true proportions,
  // and shrink (never distort) text that would then run past the panel edge.
  const squeeze = 1 / (glyphStretch.get(ctx.canvas) ?? 1);
  const font = (px: number) =>
    `700 ${px}px Classroom, "Malgun Gothic", sans-serif`;
  ctx.font = font(size);
  // Measure where the text really lands, since some notes draw inside a rotation.
  const m = ctx.getTransform(),
    base = ctx.canvas.width / LOGICAL_W,
    at = (m.a * x + m.c * y + m.e) / base,
    local = Math.hypot(m.a, m.b) / base;
  const room = Math.min(2 * Math.min(at, LOGICAL_W - at) * 0.94, maxWidth);
  const wide = ctx.measureText(value).width * squeeze * local;
  if (room > 0 && wide > room) ctx.font = font(size * (room / wide));
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(x, y);
  ctx.scale(squeeze, 1);
  ctx.fillText(value, 0, 0);
  ctx.restore();
}
export function animalFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: number,
) {
  ctx.save();
  ctx.translate(x, y);
  // Like text(), undo the panel stretch so faces keep their round shape.
  const squeeze = 1 / (glyphStretch.get(ctx.canvas) ?? 1);
  ctx.scale((size / 100) * squeeze, size / 100);
  const color = ["#f3e5d5", "#c79665", "#df8855", "#b68f6c"][type % 4];
  ctx.fillStyle = color;
  ctx.strokeStyle = "#695447";
  ctx.lineWidth = 3;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(
      sign * 25,
      -30,
      type === 0 ? 10 : 17,
      type === 0 ? 34 : 17,
      sign * 0.1,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 7, 44, 39, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff5df";
  ctx.beginPath();
  ctx.ellipse(0, 23, 25, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#554337";
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sign * 15, 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-6, 19);
  ctx.lineTo(0, 25);
  ctx.lineTo(6, 19);
  ctx.stroke();
  ctx.fillStyle = "#e8a29a";
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sign * 28, 19, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
