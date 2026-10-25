import {
  PUZZLES,
  unlocked,
  type Progress,
  type ItemId,
  type PuzzleId,
} from "../game/model";
import {
  CLUES,
  FRAGMENTS,
  MAP_WORDS,
  SENTENCES,
  INVITATIONS,
} from "../content/data";
import {
  WALLS,
  FRIENDS,
  ADJACENCY,
  lensWindows,
  adjacent,
} from "../puzzles/judges";
import { button as b, esc, animal, icon } from "./helpers";
import type { ViewContext } from "./views";
import { digit, displayCode, orderCards } from "../game/advancement";
import { gymTeams } from "./advancement";
const disabled = (v: boolean) => (v ? "disabled" : "");
const done = (s: Progress, id: PuzzleId) => s.solvedPuzzleIds.includes(id);
const head = (name: string, text: string) =>
  `<div class="device-heading"><h3>${name}</h3><p>${text}</p></div>`;
function locked(s: Progress, id: PuzzleId, render: () => string) {
  return unlocked(s, id)
    ? render()
    : `<div class="physical-lock">${icon("key", 60)}<h3>아직 장치가 잠겨 있어요</h3><p>${FRAGMENTS[PUZZLES.indexOf(id) - 1]} 조각을 찾으면 열려요.</p>${b("교실에서 다른 단서 찾기", "close-panel", "", 'class="primary"')}</div>`;
}
function solved(s: Progress, id: PuzzleId) {
  return done(s, id)
    ? `<div class="opened-device">${icon("check", 28)} ${FRAGMENTS[PUZZLES.indexOf(id)]} 조각을 찾았어요.</div>`
    : "";
}
function modeMenu(current: string, bonusName: string, mainName: string) {
  return `<div class="device-tabs" role="group" aria-label="살펴볼 장치">${b(mainName, "device", "main", `aria-pressed="${current === "main"}"`)}${b(bonusName + " · 선택", "device", "bonus", `aria-pressed="${current === "bonus"}"`)}</div>`;
}
function p1(s: Progress, c: ViewContext) {
  const p = s.puzzles.p1,
    d = done(s, "P1"),
    guided = c.learning?.options.grade === "guided",
    correct = p.order.join(",") === "P1-C1,P1-C3,P1-C5";
  return `${head("반쪽 메모 맞추기", "같은 모양끼리 이어지는 메모 세 장을 차례로 눌러요.")}${solved(s, "P1")}
 <div class="memo-board"><div class="memo-slots" role="group" aria-label="고른 메모 · 누르면 빼기">${[
   0, 1, 2,
 ]
   .map((i) => {
     const card = CLUES.find((x) => x.id === p.order[i]);
     return b(
       card
         ? `<strong>${card.short}</strong><span class="connector">${card.symbol}</span><small>${guided ? "✓ 놓았어요" : "× 빼기"}</small>`
         : `<small>${i + 1}번째</small><span>＋</span>`,
       "memo-remove",
       String(i),
       `class="memo-slot" aria-label="${i + 1}번째 메모${card ? " " + card.short + (guided ? " 완료" : " 빼기") : " 빈칸"}" ${disabled(d || !card || guided)}`,
     );
   })
   .join("")}</div>
 ${
   !d
     ? `<p class="device-feedback ${p.order.length === 3 && !correct ? "needs-fix" : ""}" role="status">${p.order.length === 3 && !correct ? "기호가 이어지지 않아요. 위 메모를 눌러 빼고 다시 골라요." : `메모 ${p.order.length}/3 · 메모를 누르면 다음 빈칸에 놓여요.`}</p><div class="clue-cards compact-cards">${orderCards(
         CLUES.filter(
           (card) =>
             s.discoveredClueIds.includes(card.id) &&
             !p.order.includes(card.id) &&
             (!guided ||
               card.id === ["P1-C1", "P1-C3", "P1-C5"][p.order.length]),
         ),
         c.learning,
       )
         .map((card) =>
           b(
             `${card.id === "P1-C1" ? animal("토끼", 42) : icon("note", 26)}<strong>${card.short}</strong><span>${esc(card.text)}</span><span class="join-marks" aria-label="${card.back}">${card.symbol.replace(" ", " → ")}</span><small>＋ 놓기</small>`,
             "memo-pick",
             card.id,
             `class="clue-card direct-card" aria-label="${card.short} 놓기" ${disabled(p.order.length === 3)}`,
           ),
         )
         .join("")}</div>`
     : ""
 }</div>
 ${!s.discoveredClueIds.includes("P1-C3") ? `<p class="notice">토끼가 직접 한 말이 적힌 쪽지도 찾아봐요.</p>${b("토끼 쪽지 찾으러 가기 →", "inspect", "O03", 'class="primary"')}` : ""}
 ${d ? '<p class="revealed-clue">메모 지도는 창가 두 번째 그림 책상을 가리켜요.</p>' : ""}`;
}
function p2(s: Progress, c: ViewContext) {
  return locked(s, "P2", () => {
    const p = s.puzzles.p2,
      d = done(s, "P2"),
      windows = lensWindows(p.rotation),
      ready = !!p.lensUsed && p.rotation === 0,
      owned = s.inventory.some((id) => id.endsWith("lens"));
    return `${head("서랍의 암호판", p.lensUsed ? "▲ 표시를 위로 맞추고 창 1 → 2 → 3의 숫자를 눌러요." : "렌즈를 올리면 세 개의 숫자 창이 보여요.")}${solved(s, "P2")}
 ${!p.lensUsed && !owned ? b("공용 렌즈 찾으러 가기 →", "inspect", "O06", 'class="primary next-place"') : ""}
 <div class="cipher physical-cipher"><div class="board-up">▲ 위 · 암호판</div>${b(
   `${p.lensUsed ? `<span class="lens-indicator"><span class="lens-up-mark" style="transform:rotate(${p.rotation}deg)">▲ 위</span></span>` : '<span class="lens-placeholder">◎ 렌즈를 올리는 자리</span>'}<span class="cipher-grid">${[
     7, 2, 9, 4, 6, 1, 8, 3, 5,
   ]
     .map((n, i) => {
       const wi = p.lensUsed
         ? windows.findIndex(
             ([x, y]) => x === (i % 3) + 1 && y === Math.floor(i / 3) + 1,
           )
         : -1;
       return `<span class="${wi >= 0 ? "window-cell" : "covered-cell"}">${wi >= 0 ? `<small>창 ${wi + 1}</small>${digit(c.learning, n)}` : p.lensUsed ? "·" : digit(c.learning, n)}</span>`;
     })
     .join("")}</span>`,
   p.lensUsed ? "lens-rotate" : "place-lens",
   "O04",
   `class="lens-board" aria-label="${p.lensUsed ? "투명 렌즈를 시계 방향으로 회전" : "렌즈 올리기"}" ${disabled(d || (!p.lensUsed && !owned))}`,
 )}</div>
 <div class="lens-controls">${p.lensUsed ? b("↻ 렌즈 돌리기", "lens-rotate", "", 'class="primary" ' + disabled(d)) : owned ? b("◎ 렌즈 올리기", "place-lens", "O04", 'class="primary"') : ""}</div>
 ${ready ? `<div class="window-reading" aria-label="렌즈에 보이는 세 숫자">${[7, 1, 3].map((n, i) => `<span>창 ${i + 1}<strong>${digit(c.learning, n)}</strong></span>`).join("")}</div>` : '<p class="notice">렌즈의 ▲ 표시가 위를 향하면 숫자를 누를 수 있어요.</p>'}
 <div class="code-display" aria-live="polite">${esc(displayCode(c.learning, p.code).padEnd(3, "_"))}</div><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지우기", 0].map((n) => b(String(n), "code", String(n), disabled(d || !ready))).join("")}</div>`;
  });
}
function p3(s: Progress, c: ViewContext) {
  return locked(s, "P3", () => {
    const p = s.puzzles.p3,
      d = done(s, "P3"),
      trace = c.ballPath.slice(0, c.ballIndex + 1),
      last = p.path.at(-1)!;
    return `${head("모두에게 닿는 우정 공", "빛나는 칸을 눌러 네 친구를 만나요. 지나온 칸을 누르면 그곳까지 되돌려요.")}${solved(s, "P3")}
 <p class="route-progress" role="status">친구 ${Object.keys(FRIENDS).filter((i) => p.path.includes(Number(i))).length}/4명 · 마지막은 골대 ⚑</p><div class="friends">${Object.entries(
   FRIENDS,
 )
   .map(
     ([cell, name]) =>
       `<span class="${p.path.includes(Number(cell)) ? "met" : ""}">${animal(name, 40)}${name}${p.path.includes(Number(cell)) ? " ✓" : ""}</span>`,
   )
   .join(
     "",
   )}</div>${c.learning?.options.grade === "guided" ? `<div class="guided-actions">${b(last === 14 ? "길 확인하기" : Object.keys(FRIENDS).every((cell) => p.path.includes(Number(cell))) ? "골대까지 길 잇기" : "다음 친구까지 길 이어보기", "guided-route", "", `class="primary" ${disabled(d || c.running)}`)}</div>` : ""}<div class="route-board"><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="route-line" aria-hidden="true"><polyline points="${p.path.map((i) => `${(i % 5) * 20 + 10},${Math.floor(i / 5) * 20 + 10}`).join(" ")}"/></svg><div class="ball-grid route-grid" role="group" aria-label="공의 길 만들기">${p.arrows.map((_, i) => (WALLS.includes(i) ? '<div class="wall" aria-label="벽">벽</div>' : b(`<small>${FRIENDS[i] ?? (i === 10 ? "시작" : i === 14 ? "골대" : "")}</small><strong>${c.running && c.ballPath[c.ballIndex] === i ? "●" : i === last && !d ? "●" : i === 14 ? "⚑" : p.path.includes(i) ? ["→", "↓", "←", "↑"][p.arrows[i]] : "·"}</strong>${p.path.includes(i) ? `<span class="step-number">${p.path.indexOf(i) + 1}</span>` : ""}`, "path-step", String(i), `class="tile ${i === 14 ? "goal" : ""} ${p.path.includes(i) ? "visited" : ""} ${adjacent(last, i) && !p.path.includes(i) && last !== 14 ? "next-cell" : ""} ${trace.includes(i) ? "ball-passed" : ""}" aria-label="${(i % 5) + 1}열 ${Math.floor(i / 5) + 1}행 ${FRIENDS[i] ?? ""}${i === 14 ? " 골대" : ""}" ${disabled(d || c.running || (!p.path.includes(i) && !adjacent(last, i)) || (last === 14 && !p.path.includes(i)))}`))).join("")}</div></div>
 <div class="path-actions">${b("↶ 한 칸 취소", "path-undo", "", disabled(d || c.running || p.path.length <= 1))}${b("길 다시 만들기", "path-reset", "", disabled(d || c.running || p.path.length <= 1))}${b(c.running ? "공이 가는 중…" : "공 굴리기 →", "ball-run", "", 'class="primary" ' + disabled(d || c.running || last !== 14))}</div><p class="muted">길을 고치려면 지나온 칸을 누르거나 한 칸 취소를 눌러요.</p>`;
  });
}
function wire(
  s: Progress,
  id: keyof Progress["puzzles"]["p4"],
  kind: "photo" | "help",
) {
  const on = s.puzzles.p4[id];
  return b(
    `<svg viewBox="0 0 100 30" aria-hidden="true"><path d="${on ? "M3 15H92m-9-7 10 7-10 7" : "M3 15H37m26 0H97M43 8l14 14m0-14L43 22"}"/></svg><span>${on ? (kind === "photo" ? "사진 멈추기" : "도움 연결됨") : kind === "photo" ? "사진 멈춤 ✓" : "도움 잇기"}</span>`,
    "switch",
    id,
    `class="wire ${kind} ${on ? "connected" : "disconnected"}" role="switch" aria-checked="${on}" aria-label="${{ "photo-1": "기기에서 단체 대화방으로 사진 전달", "photo-2": "단체 대화방에서 다른 대화방으로 사진 전달", "help-1": "친구에게 도움 요청", "help-2": "교무실 선생님에게 도움 요청", "help-3": "상담교사에게 도움 요청" }[id]}" ${disabled(done(s, "P4"))}`,
  );
}
function p4(s: Progress, c: ViewContext) {
  if (c.learning?.options.grade === "guided")
    return locked(s, "P4", () => {
      const stopped = !s.puzzles.p4["photo-1"] && !s.puzzles.p4["photo-2"];
      const complete = done(s, "P4");
      return `${head("사진은 멈추고, 도움은 이어요", "먼저 사진을 멈추고, 믿을 수 있는 어른에게 도움을 요청해요.")}${solved(s, "P4")}<div class="guided-actions">${b(stopped ? "✓ 사진 전달을 멈췄어요" : "1. 사진 전달 멈추기", "guided-photo", "", `class="primary" ${disabled(stopped || complete)}`)}${b(complete ? "✓ 친구와 선생님께 도움을 요청했어요" : "2. 친구와 함께 선생님께 도움 요청하기", "guided-help", "", disabled(!stopped || complete))}</div><p class="notice">이미 전달된 사진이 자동으로 삭제되지는 않아요. 도움이 필요하면 어른에게 말해요.</p>`;
    });
  return locked(
    s,
    "P4",
    () => `${head("사진은 멈추고, 도움은 이어요", "사진은 두 곳 모두 멈춰요. 도움은 친구를 거쳐 어른 한 분에게 이어요.")}${solved(s, "P4")}
 <div class="physical-network photo-network"><h4>▧ 사진 전달</h4><div class="network-chain"><span class="network-person">${animal("토끼", 48)}친구의 기기</span>${wire(s, "photo-1", "photo")}<span class="network-person">${icon("note", 36)}단체 대화방</span>${wire(s, "photo-2", "photo")}<span class="network-person">${icon("note", 36)}다른 대화방</span></div></div>
 <div class="physical-network help-network"><h4>♡ 도움 요청</h4><div class="network-chain help-first"><span class="network-person">${animal("토끼", 48)}도움이 필요한 친구</span>${wire(s, "help-1", "help")}<span class="network-person">${animal("곰", 48)}함께 돕는 친구</span></div><div class="help-branches"><div><span>함께 돕는 친구</span>${wire(s, "help-2", "help")}<strong>♙ 교무실 선생님</strong></div><div><span>함께 돕는 친구</span>${wire(s, "help-3", "help")}<strong>♙ 상담교사</strong></div></div></div><p class="notice">더 전달되지 않게 막는 활동이에요. 이미 전달된 사진이 자동으로 삭제되지는 않아요.</p>`,
  );
}
function mapLegend() {
  return `<div class="map-legend symbol-legend" aria-label="지도 기호와 숫자">${[
    ["arrow", "화살표", "3"],
    ["chat", "말풍선", "1"],
    ["adult", "어른", "2"],
  ]
    .map(
      ([id, name, n]) =>
        `<span>${icon(id, 22)}${name} <strong>${n}</strong></span>`,
    )
    .join("")}</div>`;
}
function p5(s: Progress, c: ViewContext) {
  return locked(s, "P5", () => {
    const p = s.puzzles.p5,
      d = done(s, "P5"),
      ask = ["교무실", "상담실"].includes(p.place),
      started = p.sentence[0] === "R0";
    const placeName = (place: string) =>
      place === "교실" && c.learning?.options.episode !== "classroom"
        ? c.learning?.options.episode === "gym"
          ? "체육관"
          : "도서관"
        : place;
    const dialog =
      p.place === "담임 자리"
        ? `<div class="npc-dialog"><h4 tabindex="-1">지금 자리에 없어요.</h4><p>다른 선생님을 찾아가도 괜찮아요.</p>${b("복도로 돌아가 다른 선생님 찾기 →", "move", "복도", 'class="primary"')}</div>`
        : ask && !d
          ? `<div class="npc-dialog"><span class="npc-face">${icon("adult", 44)}</span><h4 tabindex="-1">${started ? "어떻게 이야기하고 싶나요?" : "어떤 도움이 필요하니?"}</h4>${started ? `<p class="spoken-line">나: ${SENTENCES.R0}</p><div class="sentence-cards">${["R1", "R2"].map((id) => b(SENTENCES[id], "sentence-add", id, 'class="primary"')).join("")}</div><p>편한 방법을 하나 골라요. 둘 다 괜찮아요.</p>` : `<div class="sentence-cards">${b(SENTENCES.R0, "sentence-start", "", 'class="primary"')}</div>`}</div>`
          : "";
    return `${head("도움이 닿는 지도", ask ? "선생님께 하고 싶은 말을 눌러요." : `지금 ${placeName(p.place)}에 있어요. 갈 수 있는 장소를 눌러요.`)}${solved(s, "P5")}${dialog}
 <div class="school-map"><svg viewBox="0 0 500 250" preserveAspectRatio="none" aria-hidden="true"><path d="M75 190H250V60M250 190H337V60H425M250 190H425"/></svg><div class="map-places">${(["교실", "복도", "담임 자리", "교무실", "상담실"] as const).map((place) => b(`<span>${place === "교실" ? "▦" : place === "복도" ? "↔" : place === "담임 자리" ? "♙" : "♡"}</span><strong>${placeName(place)}</strong><small>${place === p.place ? "● 현재 위치" : ADJACENCY[p.place].includes(place) ? "여기로 가기 →" : place === "담임 자리" ? "지금 자리에 없음" : "연결된 길"}</small>`, "move", place, `class="map-room ${place === p.place ? "current" : ""}" ${disabled(d || !ADJACENCY[p.place].includes(place))}`)).join("")}</div></div>${mapLegend()}`;
  });
}

function final(s: Progress, c: ViewContext) {
  if (s.solvedPuzzleIds.length < 5)
    return `<div class="physical-lock">${icon("key", 60)}<h3>우정 조각 다섯 개가 필요해요</h3><p>교실의 장치에서 조각을 모아 출구에 맞춰요.</p></div>`;
  const p = s.puzzles.final;
  return `${head("우정 조각으로 지도 완성하기", "칠판에 적힌 순서대로 조각을 눌러요. 빈칸에 바로 맞춰져요.")}${s.finalCombined ? `<div class="treasure-map"><span>숨겨진 열쇠의 위치</span><strong>${MAP_WORDS.join(" / ")}</strong>${b("화분 받침 살펴보기 →", "inspect", "O11", 'class="primary"')}</div>` : ""}<p class="assembly-order">${FRAGMENTS.join(" → ")}</p>
 <div class="fragment-slots physical-fragments">${[0, 1, 2, 3, 4]
   .map((i) => {
     const id = p.order[i],
       n = Number(id?.slice(1)) - 1;
     return b(
       `<small>${i + 1}번째</small>${id ? `<span class="piece-mark">◆</span><strong>${FRAGMENTS[n]}</strong><small>× 빼기</small>` : '<span class="empty-piece">＋</span>'}`,
       "fragment-remove",
       String(i),
       `class="fragment-home" aria-label="${i + 1}번째 조각${id ? " " + FRAGMENTS[n] + " 빼기" : " 빈칸"}" ${disabled(s.finalCombined || !id)}`,
     );
   })
   .join("")}</div>
 ${!s.finalCombined ? `<p class="device-feedback" role="status">${p.order.length === 5 ? "순서가 맞지 않아요. 위 조각을 눌러 빼고 다시 골라요." : `조각 ${p.order.length}/5 · 아래 조각을 누르면 다음 빈칸에 놓여요.`}</p><div class="fragment-pool">${FRAGMENTS.map((name, i) => (!p.order.includes(`F${i + 1}`) ? b(`<span class="piece-mark">◆</span><strong>${name}</strong><small>＋ 놓기</small>`, "fragment-pick", `F${i + 1}`, `aria-label="${name} 조각 놓기" ${disabled(p.order.length === 5)}`) : "")).join("")}</div>${p.order.length ? b("모두 빼고 다시 고르기", "fragment-reset") : ""}` : ""}`;
}
function bonus(s: Progress, id: string, title: string, content: string) {
  return `${head(title, "장치의 기호를 살펴보고 직접 눌러 보세요.")}${s.foundBonusIds.includes(id as any) ? '<div class="opened-device">✓ 추가 단서를 찾았어요 · 5점</div>' : content}`;
}
export function objectContent(
  s: Progress,
  id: string,
  selected: ItemId | null,
  path: number[],
  ballIndex: number,
  running: boolean,
  c: ViewContext,
) {
  const mode = c.device ?? "main";
  switch (id) {
    case "O01":
      return `<div class="chalk-note"><h3>사라진 우정 열쇠</h3><p>다섯 우정 조각을 연결하면 열쇠의 위치가 나타나요.</p><p class="fragment-sequence">${FRAGMENTS.join(" → ")}</p></div>`;
    case "O02":
      return (
        modeMenu(mode, "초대장", "메모 맞추기") +
        (mode === "bonus"
          ? bonus(
              s,
              "B3",
              "초대장 잇기",
              `<p>맞닿는 원과 삼각형을 살펴봐요. 문장을 누르면 차례로 놓여요.</p><div class="invitation-slots">${s.puzzles.b3.map((n, i) => b(`<small>${i === 0 ? "시작 ○" : i === 1 ? "○ → △" : "△ 끝"}</small>${INVITATIONS[n]}`, "invite-remove", String(i), 'class="invitation-paper"')).join("")}</div><div class="invites">${[
                "3",
                "1",
                "2",
              ]
                .filter((n) => !s.puzzles.b3.includes(n))
                .map((n) =>
                  b(
                    `<small>${n === "1" ? "시작 → ○" : n === "2" ? "○ → △" : "△ → 끝"}</small>${INVITATIONS[n]}`,
                    "invite-add",
                    n,
                  ),
                )
                .join("")}</div>`,
            )
          : p1(s, c))
      );
    case "O03":
      return `<div class="paper-note">${animal("토끼", 80)}<blockquote>“함께 만들고 싶어. 만드는 방법을 먼저 알려 주면 좋겠어.”</blockquote><p>토끼가 직접 쓴 쪽지예요. 단서 노트에 넣었어요.</p>${b("게시판에서 메모 맞추기", "inspect", "O02", 'class="primary"')}</div>`;
    case "O04":
      return p2(s, c);
    case "O05":
      return `${head("주인이 남긴 허락 안내", "쓰기 전에 안내를 읽어 봐요.")}<div class="permission-card"><h4>“투명 렌즈는 사용해도 좋아.”</h4>${b(`${icon("bag", 42)} 허락받은 렌즈 집기`, "take", "borrowed-lens", disabled(s.inventory.includes("borrowed-lens")))}</div><div class="permission-card"><h4>“지금 쓰는 중이라 빌려주기 어려워.”</h4><p>이 도구함은 열지 않아요. 공용 도구함에도 같은 기능의 렌즈가 있어요.</p></div>`;
    case "O06":
      return (
        modeMenu(mode, "라벨", "렌즈 꺼내기") +
        (mode === "bonus"
          ? bonus(
              s,
              "B2",
              "함께 쓰는 도구함의 라벨",
              `<div class="label-options">${b("👐 펼친 두 손<br>함께 쓰기", "bonus", "B2:함께 쓰기")}${b("▣ 개인용 자물쇠", "bonus", "B2:개인용")}${b("◷ 사용 중 시계", "bonus", "B2:사용 중")}</div>`,
            )
          : `${head("공용 도구함", "이 렌즈는 누구나 함께 쓸 수 있어요.")}<div class="toolbox-open">${b('<span class="big-lens">◎</span><strong>공용 렌즈 집기</strong>', "take", "shared-lens", `class="collect-object" ${disabled(s.inventory.includes("shared-lens"))}`)}</div>${s.inventory.includes("shared-lens") ? `<p class="opened-device">렌즈를 집었어요!</p>${b("렌즈로 암호판 살펴보기 →", "lens-desk", "", "class=primary")}` : ""}`)
      );
    case "O07":
      return p3(s, c);
    case "O08":
      return c.learning?.options.episode === "gym"
        ? locked(s, "P4", () => gymTeams(c))
        : p4(s, c);
    case "O09":
      return p5(s, c);
    case "O10":
      return bonus(
        s,
        "B1",
        "책장의 두 그림",
        `<div class="picture-compare"><div>△ ♡ ☆</div><div>○ ♧ ♡</div></div><p>두 그림에 같은 기호가 있어요. 무엇일까요?</p><div class="symbol-choices">${[
          ["하트", "♡"],
          ["삼각형", "△"],
          ["별", "☆"],
          ["원", "○"],
          ["나뭇잎", "♧"],
        ]
          .map(([name, symbol]) =>
            b(
              `<strong>${symbol}</strong><span>${name}</span>`,
              "bonus",
              `B1:${name}`,
            ),
          )
          .join("")}</div>`,
      );
    case "O11":
      return s.finalKeyObtained
        ? `<div class="key-found">${icon("key", 94)}<h3>받침 아래에서 열쇠를 찾았어요!</h3><p>이 열쇠로 출구를 열 수 있어요.</p>${b("열쇠로 출구 열기 →", "key-exit", "", 'class="primary"')}</div>`
        : `<div class="pot-base">♧<h3>둥근 화분 받침</h3><p>완성된 지도가 숨은 곳을 알려 줄 거예요.</p></div>`;
    case "O12":
      return s.solvedPuzzleIds.length === 5
        ? modeMenu(mode, "숫자 자물쇠", "우정 조각") +
            (mode === "bonus"
              ? bonus(
                  s,
                  "B4",
                  "출구 옆 기호 잠금장치",
                  `<div class="symbol-lock named-symbols">${["arrow", "chat", "adult"].map((id, i) => `<span>${icon(id, 36)}<small>${["화살표", "말풍선", "어른"][i]}</small></span>`).join("")}</div><p>도움 지도에서 본 기호 순서로 세 자리 숫자를 눌러요.</p><form data-form="bonus4"><label for="bonus-code">세 자리 암호</label><input id="bonus-code" name="code" value="${esc(s.puzzles.b4)}" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" autocomplete="off" required/><button type="submit">암호 확인</button></form><div class="keypad bonus-keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지우기", 0].map((n) => b(String(n), "bonus-code", String(n))).join("")}</div>`,
                )
              : final(s, c)) +
            `<div class="door-target">${b(`${icon("key", 35)} ${s.finalKeyObtained ? "열쇠로 출구 열기" : "출구의 열쇠 구멍"}`, s.finalKeyObtained ? "key-exit" : "use-exit", "", 'class="door-keyhole"')}<p>${s.finalKeyObtained ? "이제 문을 열면 탈출 성공이에요." : "완성한 지도가 열쇠 위치를 알려 줄 거예요."}</p></div>`
        : final(s, c);
    default:
      return "";
  }
}
