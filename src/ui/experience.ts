import type { ViewContext } from "./views";
import { PUZZLES, score, type Progress } from "../game/model";
import { FRAGMENTS, OBJECTS } from "../content/data";
import { button as b, esc, icon, room, time } from "./helpers";
import { objectContent } from "./panels";
export const ITEM_NAMES: Record<string, string> = {
  "shared-lens": "공용 렌즈",
  "borrowed-lens": "허락받은 렌즈",
  "final-key": "마지막 열쇠",
};
export function objective(s: Progress): [string, string] {
  if (!s.solvedPuzzleIds.includes("P1"))
    return !s.discoveredClueIds.includes("O02")
      ? ["게시판에 붙은 메모를 살펴봐요.", "O02"]
      : !s.discoveredClueIds.includes("P1-C3")
        ? ["바구니 옆에서 토끼가 직접 쓴 쪽지를 찾아요.", "O03"]
        : ["메모 조각 세 장을 연결해요.", "O02"];
  if (!s.solvedPuzzleIds.includes("P2"))
    return !s.inventory.some((i) => i.endsWith("lens"))
      ? ["공용 도구함에서 렌즈를 찾아요.", "O06"]
      : !s.puzzles.p2.lensUsed
        ? ["찾은 렌즈로 그림 책상 암호판을 살펴봐요.", "O04"]
        : ["렌즈의 위 표시를 맞추고 암호를 풀어요.", "O04"];
  if (!s.solvedPuzzleIds.includes("P3"))
    return ["네 친구를 모두 만나는 공의 길을 만들어요.", "O07"];
  if (!s.solvedPuzzleIds.includes("P4"))
    return ["사진은 멈추고, 도움은 어른에게 이어 줘요.", "O08"];
  if (!s.solvedPuzzleIds.includes("P5"))
    return ["도움 가능한 어른에게 이야기를 전해요.", "O09"];
  if (!s.finalCombined) return ["출구의 조합판에 우정 조각을 맞춰요.", "O12"];
  if (!s.finalKeyObtained)
    return ["창가 둥근 화분 받침 아래를 살펴봐요.", "O11"];
  return ["열쇠로 출구를 열면 탈출 성공이에요!", "O12"];
}
export function hintTarget(c: ViewContext) {
  if (c.device === "bonus")
    return (
      ({ O02: "B3", O06: "B2", O12: "B4" } as Record<string, string>)[
        c.objectId ?? ""
      ] ?? "B1"
    );
  return (
    (
      {
        O02: "P1",
        O03: "P1",
        O04: "P2",
        O05: "P2",
        O06: "P2",
        O07: "P3",
        O08: "P4",
        O09: "P5",
        O10: "B1",
        O11: "final",
        O12: "final",
      } as Record<string, string>
    )[c.objectId ?? ""] ??
    (c.state!.solvedPuzzleIds.length === 5
      ? "final"
      : PUZZLES[c.state!.solvedPuzzleIds.length])
  );
}
export function renderPlay(c: ViewContext) {
  const s = c.state!,
    o = OBJECTS.find((o) => o.id === c.objectId),
    [goal, target] = objective(s);
  const title = o?.name ?? "교실을 살펴봐요";
  return `<main id="main" class="escape-play"><div class="escape-hud"><div><span class="eyebrow">사라진 우정 열쇠</span><h1>${o ? esc(title) : "교실을 살펴봐요"}</h1></div><div class="escape-stats"><span aria-label="점수">${score(s)}점</span><span>조각 ${s.solvedPuzzleIds.length}/5</span><span>${icon("clock", 17)}<output id="timer">${time(s.elapsedMs)}</output></span>${b(icon("pause"), "pause", "", 'class="icon-button" aria-label="일시정지"')}</div></div>
  <div class="goal-bar">${icon("key", 22)}${o?.id !== target ? b(`${goal} →`, "inspect", target, 'class="goal-target"') : `<span>${goal}</span>`}${b(`${icon("hint", 20)} 힌트`, "modal", "hint", 'class="goal-hint"')}</div>
  <section id="inspection" class="escape-stage ${o ? "is-zoomed" : ""}" aria-label="${o ? "물건 확대와 장치" : "교실 탐색"}">${o ? `<div class="zoom-top">${b("← 교실로 돌아가기", "close-panel", "", 'class="back-room"')}<h2 id="panel-title" tabindex="-1">${title}</h2></div><div class="zoom-vignette" aria-hidden="true"><img src="${new URL("assets/classroom.svg", new URL(import.meta.env.BASE_URL, document.baseURI)).href}" style="object-position:${o.x}% ${o.y}%" alt=""/></div><div class="zoom-device" data-device="${o.id}:${c.device}" aria-describedby="device-scroll-help">${objectContent(s, o.id, c.selected, c.ballPath, c.ballIndex, c.running, c)}</div><p id="device-scroll-help" class="device-scroll-cue" hidden></p>` : `<div class="scene-caption"><span>물건을 눌러 가까이 살펴봐요</span><span>단서를 찾으면 장치가 열려요</span></div>${room(true, target, s)}<div class="room-legend"><span>◎ 살펴볼 물건</span><span>✓ 열린 장치</span></div>`}</section>
  <div class="escape-bottom"><div class="pocket-tray" aria-label="아이템 칸"><span class="tray-label">내 도구</span>${s.inventory.length ? s.inventory.map((id) => b(`${icon(id === "final-key" ? "key" : "bag", 26)}<span>${ITEM_NAMES[id]}</span>${c.selected === id ? "<small>선택 중 · 대상 물건을 눌러요</small>" : ""}`, "select-item", id, `class="pocket-item ${c.selected === id ? "equipped" : ""}" aria-pressed="${c.selected === id}"`)).join("") : '<span class="empty-pocket">찾은 도구가 여기에 모여요</span>'}</div><div class="adventure-controls">${b(`${icon("note", 20)} 단서 노트`, "modal", "notes")}${o ? b("← 교실로", "close-panel", "", 'class="bottom-back"') : b("물건 목록", "modal", "objects")}${b("설정", "modal", "settings")}<div class="tiny-fragments" aria-label="우정 조각">${FRAGMENTS.map((n, i) => `<span class="${s.solvedPuzzleIds.includes(PUZZLES[i]) ? "found" : ""}" title="${n}">${s.solvedPuzzleIds.includes(PUZZLES[i]) ? "◆" : "◇"}<span class="sr-only">${n}</span></span>`).join("")}</div></div></div></main>`;
}
