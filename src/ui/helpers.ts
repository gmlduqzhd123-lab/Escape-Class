import { asset } from "../ranking/service";
import { OBJECTS } from "../content/data";
export const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function button(label: string, action: string, value = "", attrs = "") {
  return `<button type="button" data-action="${action}" data-value="${esc(value)}" data-focus="${esc(action + ":" + value)}" ${attrs}>${label}</button>`;
}
export function icon(name: string, size = 24) {
  const shapes: Record<string, string> = {
    key: '<circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-5-5 3-3m0 6 3-3"/>',
    bag: '<rect x="4" y="7" width="16" height="14" rx="4"/><path d="M8 7V5a4 4 0 0 1 8 0v2M8 12h8m-5 4h2"/>',
    note: '<path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h7m-7 4h7m-7 4h5"/>',
    hint: '<path d="M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
    pause: '<path d="M8 5v14m8-14v14"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    home: '<path d="m3 10 9-7 9 7v11H3Zm6 11v-8h6v8"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] ?? shapes.star}</svg>`;
}
export function animal(name: string, size = 58) {
  const colors: Record<string, string> = {
    토끼: "#f3e5d5",
    곰: "#c79665",
    여우: "#df8855",
    다람쥐: "#b68f6c",
  };
  const ears =
    name === "토끼"
      ? '<ellipse cx="22" cy="16" rx="7" ry="16"/><ellipse cx="42" cy="16" rx="7" ry="16"/>'
      : name === "여우"
        ? '<path d="M9 30 9 6 28 23m27 7V6L36 23"/>'
        : '<circle cx="15" cy="22" r="10"/><circle cx="49" cy="22" r="10"/>';
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 70" role="img" aria-label="${name}"><g fill="${colors[name] ?? colors.토끼}" stroke="#695447" stroke-width="1.5">${ears}<ellipse cx="32" cy="43" rx="25" ry="24"/></g><ellipse cx="32" cy="51" rx="14" ry="10" fill="#fff5df"/><circle cx="23" cy="40" r="2.4"/><circle cx="41" cy="40" r="2.4"/><path d="m29 49 3 3 3-3m-3 3v4" fill="none" stroke="#554337" stroke-width="2"/><circle cx="15" cy="49" r="4" fill="#e8a29a"/><circle cx="49" cy="49" r="4" fill="#e8a29a"/></svg>`;
}
export function room(interactive = false, current: string | null = null) {
  return `<div class="room ${interactive ? "interactive-room" : ""}"><img src="${asset("assets/classroom.svg")}" alt="나무 책상, 칠판, 게시판과 햇살이 비치는 가상 교실" width="1200" height="760" />${interactive ? OBJECTS.map((o) => button(`<span class="object-dot">${o.id.slice(1)}</span><span class="hotspot-label">${o.name}</span>`, "inspect", o.id, `class="hotspot ${current === o.id ? "selected" : ""}" style="left:${o.x}%;top:${o.y}%" aria-label="${o.name} 조사하기"`)).join("") : ""}</div>`;
}
export function time(ms: number) {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)
    .toString()
    .padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
}
