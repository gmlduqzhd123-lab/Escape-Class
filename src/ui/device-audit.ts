import type { DeviceAudit } from "./learning";
// Teacher self-check pad: counts touch taps, swipes and two-finger touches.
export function mountDeviceAudit(a: DeviceAudit) {
  const pad = document.getElementById("device-touch-pad");
  if (!pad) return;
  const pointers = new Map<number, { x: number; y: number }>();
  const update = () => {
    const t = document.getElementById("device-touch-stats");
    if (t)
      t.textContent = `터치 감지 ${a.touchSeen ? "있음" : "아직 없음"} · 누르기 ${a.taps} · 밀기 ${a.swipes} · 두 손가락 ${a.multi}`;
  };
  pad.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    a.touchSeen = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) a.multi++;
    pad.setPointerCapture(event.pointerId);
    update();
  });
  pad.addEventListener("pointerup", (event) => {
    const p = pointers.get(event.pointerId);
    if (!p) return;
    Math.hypot(event.clientX - p.x, event.clientY - p.y) > 14
      ? a.swipes++
      : a.taps++;
    pointers.delete(event.pointerId);
    update();
  });
  pad.addEventListener("pointercancel", (event) =>
    pointers.delete(event.pointerId),
  );
}
