import type { ViewContext } from "./views";
import { PUZZLES, score, type Progress } from "../game/model";
import { FRAGMENTS, OBJECTS } from "../content/data";
import { button as b, esc, icon, room, time } from "./helpers";
import { objectContent } from "./panels";
import { learningPanel } from "./learning";
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
  if (
    c.learning?.options.cooperation &&
    !c.learning.coopSolved &&
    c.state?.solvedPuzzleIds.includes("P1") &&
    !c.state.inventory.some((id) => id.endsWith("lens")) &&
    (!c.objectId || ["O05", "O06"].includes(c.objectId)) &&
    c.device !== "bonus"
  )
    return "cooperation";
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
  const targetName = OBJECTS.find((object) => object.id === target)!.name;
  const title = o?.name ?? "교실을 살펴봐요";
  const roomView =
    c.sceneMode === "3d"
      ? '<div id="classroom-scene" class="classroom-scene"><p class="scene-loading" role="status">입체 교실을 준비하고 있어요…</p></div>'
      : `<div class="scene-caption"><span>${c.sceneFailed ? "그림 교실로 이어서 탐색해요" : "물건을 눌러 가까이 살펴봐요"}</span></div>${room(true, target, s)}<div class="room-legend"><span>◎ 살펴볼 물건</span><span>✓ 열린 장치</span></div>`;
  if (!o && c.sceneMode === "3d") {
    const selectedName = c.selected ? ITEM_NAMES[c.selected] : null;
    return `<main id="main" class="escape-play with-3d-room room-fill"><h1 class="sr-only">교실을 살펴봐요</h1><section id="inspection" class="escape-stage" aria-label="교실 탐색">${roomView}</section><header class="explore-hud">${b(`${icon("key", 20)}<span>${targetName} 살펴보기 →</span><span class="sr-only">${goal}</span>`, "inspect", target, `class="explore-goal" aria-label="다음 물건: ${targetName} 살펴보기"`)}<div class="explore-progress" aria-label="${score(s)}점 · 우정 조각 ${s.solvedPuzzleIds.length}/5"><strong>${score(s)}점</strong><span class="explore-pieces">◆ ${s.solvedPuzzleIds.length}/5</span><output id="timer">${time(s.elapsedMs)}</output></div>${b(icon("pause", 22), "pause", "", 'class="explore-pause" aria-label="일시정지"')}</header><nav class="explore-dock" aria-label="탐색 도구">${b(`${icon("bag", 21)}<span>가방 <b class="bag-count">${s.inventory.length}</b></span>`, "modal", "bag", `aria-label="가방 · 도구 ${s.inventory.length}개${selectedName ? ` · ${selectedName} 선택됨` : ""}" ${selectedName ? 'class="has-selected-tool"' : ""}`)}${b(`${icon("arrow", 21)}<span>이동</span>`, "modal", "navigation")}${b(`${icon("hint", 21)}<span>${c.hintSuggested ? "도움!" : "도움"}</span>`, "modal", "hint", `class="${c.hintSuggested ? "hint-suggested" : ""}" aria-label="${c.hintSuggested ? "도움 받을까요?" : "힌트"}"`)}${b('<span aria-hidden="true" class="menu-symbol">☰</span><span>메뉴</span>', "modal", "game-menu")}</nav>${selectedName ? `<p class="explore-selected" role="status">${selectedName} 선택됨 · ${c.selected === "final-key" ? "출구를" : "암호판을"} 눌러요</p>` : ""}</main>`;
  }
  return `<main id="main" class="escape-play ${!o && c.sceneMode === "3d" ? "with-3d-room" : ""}"><div class="escape-hud"><div><span class="eyebrow">사라진 우정 열쇠</span><h1>${o ? esc(title) : "교실을 살펴봐요"}</h1></div><div class="escape-stats"><span aria-label="점수">${score(s)}점</span><span>조각 ${s.solvedPuzzleIds.length}/5</span><span>${icon("clock", 17)}<output id="timer">${time(s.elapsedMs)}</output></span>${b(c.immersive ? "화면 줄이기" : "전체화면", "fullscreen", "", `class="fullscreen-toggle" aria-pressed="${c.immersive}"`)}${b(icon("pause"), "pause", "", 'class="icon-button" aria-label="일시정지"')}</div></div>
  <div class="goal-bar">${icon("key", 22)}${o?.id !== target ? b(`<span id="goal-instruction">${goal}</span><small class="goal-destination">${targetName} 살펴보기 →</small>`, "inspect", target, `class="goal-target" aria-label="다음 물건: ${targetName} 살펴보기" aria-describedby="goal-instruction"`) : `<span>${goal}</span>`}${b("역할", "modal", "team", 'class="team-button"')}${b(`${icon("hint", 20)} ${c.hintSuggested ? "도움 받을까요?" : "힌트"}`, "modal", "hint", `class="goal-hint ${c.hintSuggested ? "hint-suggested" : ""}"`)}</div>
  <section id="inspection" class="escape-stage ${o ? "is-zoomed" : ""}" aria-label="${o ? "물건 확대와 장치" : "교실 탐색"}">${o ? `<div class="zoom-top">${b("← 교실로 돌아가기", "close-panel", "", 'class="back-room"')}<h2 id="panel-title" tabindex="-1">${title}</h2><span class="phone-scroll-hint" data-phone-scroll-hint hidden aria-hidden="true"></span></div><div class="zoom-vignette" aria-hidden="true"><img src="${new URL("assets/classroom.svg", new URL(import.meta.env.BASE_URL, document.baseURI)).href}" style="object-position:${o.x}% ${o.y}%" alt=""/></div><div class="zoom-device" data-device="${o.id}:${c.device}" aria-describedby="device-scroll-help">${learningPanel(c, objectContent(s, o.id, c.selected, c.ballPath, c.ballIndex, c.running, c))}</div><p id="device-scroll-help" class="device-scroll-cue" hidden></p>` : roomView}</section>
  <div class="escape-bottom"><div class="pocket-tray" aria-label="아이템 칸"><span class="tray-label">내 도구</span>${s.inventory.length ? s.inventory.map((id) => b(`${icon(id === "final-key" ? "key" : "bag", 26)}<span>${ITEM_NAMES[id]}</span>${c.selected === id ? `<small>${id === "final-key" ? "출구를" : "그림 책상을"} 눌러요</small>` : ""}`, "select-item", id, `class="pocket-item ${c.selected === id ? "equipped" : ""}" aria-pressed="${c.selected === id}"`)).join("") : '<span class="empty-pocket">찾은 도구가 여기에 모여요</span>'}</div><div class="adventure-controls">${b(`${icon("note", 20)} 단서 노트`, "modal", "notes")}${o ? b("← 교실로", "close-panel", "", 'class="bottom-back"') : b("물건 목록", "modal", "objects")}${!o ? b(c.sceneMode === "3d" ? "그림으로 보기" : "입체로 보기", "scene-mode", "", `aria-label="${c.sceneMode === "3d" ? "그림 교실로 전환" : "입체 교실로 전환"}"`) : ""}${b("설정", "modal", "settings")}<div class="tiny-fragments" aria-label="우정 조각">${FRAGMENTS.map((n, i) => `<span class="${s.solvedPuzzleIds.includes(PUZZLES[i]) ? "found" : ""}" title="${n}">${s.solvedPuzzleIds.includes(PUZZLES[i]) ? "◆" : "◇"}<span class="sr-only">${n}</span></span>`).join("")}</div></div></div></main>`;
}
