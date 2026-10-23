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
function modeMenu(current: string, bonusName: string) {
  return `<div class="device-tabs" role="group" aria-label="살펴볼 장치">${b("주요 장치", "device", "main", `aria-pressed="${current === "main"}"`)}${b(bonusName + " · 추가 단서", "device", "bonus", `aria-pressed="${current === "bonus"}"`)}</div>`;
}
function p1(s: Progress, c: ViewContext) {
  const p = s.puzzles.p1,
    d = done(s, "P1");
  return `${head("반쪽 메모 맞추기", "메모를 고르고, 놓을 홈을 눌러요. ↻를 누르면 뒷면 기호가 보여요.")}${solved(s, "P1")}
 <div class="memo-board"><div class="memo-slots" role="group" aria-label="메모를 놓는 세 홈">${[
   0, 1, 2,
 ]
   .map((i) => {
     const card = CLUES.find((x) => x.id === p.order[i]);
     return b(
       card
         ? `<strong>${card.short}</strong><span class="connector">${card.symbol}</span>`
         : `<small>${i + 1}번째</small><span>＋</span>`,
       "p1-slot",
       String(i),
       `class="memo-slot ${c.held && i <= p.order.length ? "can-place" : ""}" aria-label="${i + 1}번째 메모 홈${card ? " · " + card.short : ""}" ${disabled(d || (!c.held && !card) || (!card && i > p.order.length))}`,
     );
   })
   .join("")}</div><div class="clue-cards compact-cards">${CLUES.filter(
   (card) =>
     s.discoveredClueIds.includes(card.id) && !p.order.includes(card.id),
 )
   .map(
     (card) =>
       `<article class="clue-card ${c.held === card.id ? "held" : ""}">${b(`${card.id === "P1-C1" ? animal("토끼", 46) : card.id === "P1-C5" ? '<span class="drawing-sign">☞ ▤</span>' : icon("note", 28)}<strong>${card.short}</strong><span>${esc(p.flipped.includes(card.id) ? card.back : card.text)}</span>`, "hold", card.id, `class="pick-card" aria-pressed="${c.held === card.id}" ${disabled(d)}`)}${b(p.flipped.includes(card.id) ? "↻ 앞면" : "↻ 뒤집기", "flip", card.id, `class="flip-card" ${disabled(d)}`)}</article>`,
   )
   .join(
     "",
   )}</div></div>${!s.discoveredClueIds.includes("P1-C3") ? '<p class="notice">모둠의 추측과 토끼가 직접 한 말을 구분해 봐요. 아직 찾지 못한 쪽지가 있어요.</p>' : ""}${c.held ? '<p class="placement-tip" role="status">골랐어요. 위의 메모 홈을 눌러 놓아요.</p>' : ""}${d ? '<p class="revealed-clue">메모 뒷면의 지도는 창가 두 번째 그림 책상을 가리켜요.</p>' : ""}`;
}
function p2(s: Progress, c: ViewContext) {
  return locked(s, "P2", () => {
    const p = s.puzzles.p2,
      d = done(s, "P2"),
      windows = lensWindows(p.rotation),
      ready = !!p.lensUsed && p.rotation === 0;
    return `${head("서랍의 암호판", "렌즈를 판 위에 올리고 ▲ 위를 맞춰요. 보이는 창 번호대로 암호를 눌러요.")}${solved(s, "P2")}
 <div class="cipher physical-cipher"><div class="board-up">▲ 위 · 암호판</div>${b(
   `${p.lensUsed ? `<span class="lens-indicator"><span class="lens-up-mark" style="transform:rotate(${p.rotation}deg)">▲ 위</span><span>렌즈를 눌러 돌리기 ↻</span></span>` : '<span class="lens-placeholder">◎ 렌즈를 놓는 자리</span>'}<span class="cipher-grid">${[
     7, 2, 9, 4, 6, 1, 8, 3, 5,
   ]
     .map((n, i) => {
       const wi = p.lensUsed
         ? windows.findIndex(
             ([x, y]) => x === (i % 3) + 1 && y === Math.floor(i / 3) + 1,
           )
         : -1;
       return `<span class="${wi >= 0 ? "window-cell" : "covered-cell"}">${wi >= 0 ? `<small>창 ${wi + 1}</small>${n}` : p.lensUsed ? "·" : n}</span>`;
     })
     .join("")}</span>`,
   p.lensUsed ? "lens-rotate" : "apply",
   "O04",
   `class="lens-board" aria-label="${p.lensUsed ? "투명 렌즈를 시계 방향으로 회전" : "선택한 렌즈를 암호판에 사용"}" ${disabled(d)}`,
 )}</div>
 <div class="code-display" aria-live="polite">${esc(p.code.padEnd(3, "_"))}</div><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지우기", 0].map((n) => b(String(n), "code", String(n), disabled(d || !ready))).join("")}</div>${!p.lensUsed ? '<p class="notice">아래 아이템 칸에서 렌즈를 고른 뒤 판을 눌러요.</p>' : !ready ? '<p class="notice">렌즈의 ▲ 위를 판의 ▲ 위와 맞춰요.</p>' : '<p class="muted">세 자리를 누르면 잠금장치가 확인해요.</p>'}`;
  });
}
function p3(s: Progress, c: ViewContext) {
  return locked(s, "P3", () => {
    const p = s.puzzles.p3,
      d = done(s, "P3"),
      trace = c.ballPath.slice(0, c.ballIndex + 1),
      last = p.path.at(-1)!;
    return `${head("모두에게 닿는 우정 공", "공 옆의 칸을 차례로 눌러 길을 이어요. 네 친구를 모두 만난 뒤 골대로 가요.")}${solved(s, "P3")}
 <div class="friends">${Object.entries(FRIENDS)
   .map(
     ([cell, name]) =>
       `<span class="${p.path.includes(Number(cell)) ? "met" : ""}">${animal(name, 40)}${name}${p.path.includes(Number(cell)) ? " ✓" : ""}</span>`,
   )
   .join(
     "",
   )}</div><div class="route-board"><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="route-line" aria-hidden="true"><polyline points="${p.path.map((i) => `${(i % 5) * 20 + 10},${Math.floor(i / 5) * 20 + 10}`).join(" ")}"/></svg><div class="ball-grid route-grid" role="group" aria-label="공의 길 만들기">${p.arrows.map((_, i) => (WALLS.includes(i) ? '<div class="wall" aria-label="벽">벽</div>' : b(`<small>${FRIENDS[i] ?? (i === 10 ? "시작" : i === 14 ? "골대" : "")}</small><strong>${c.running && c.ballPath[c.ballIndex] === i ? "●" : i === last && !d ? "●" : i === 14 ? "⚑" : p.path.includes(i) ? ["→", "↓", "←", "↑"][p.arrows[i]] : "·"}</strong>${p.path.includes(i) ? `<span class="step-number">${p.path.indexOf(i) + 1}</span>` : ""}`, "path-step", String(i), `class="tile ${i === 14 ? "goal" : ""} ${p.path.includes(i) ? "visited" : ""} ${adjacent(last, i) && !p.path.includes(i) && last !== 14 ? "next-cell" : ""} ${trace.includes(i) ? "ball-passed" : ""}" aria-label="${(i % 5) + 1}열 ${Math.floor(i / 5) + 1}행 ${FRIENDS[i] ?? ""}${i === 14 ? " 골대" : ""}" ${disabled(d || c.running)}`))).join("")}</div></div>
 <div class="path-actions">${b("↶ 한 칸 취소", "path-undo", "", disabled(d || c.running || p.path.length <= 1))}${b("길 다시 만들기", "path-reset", "", disabled(d || c.running || p.path.length <= 1))}${b(c.running ? "공이 가는 중…" : "공 굴리기 →", "ball-run", "", 'class="primary" ' + disabled(d || c.running || last !== 14))}</div><p class="muted">실패해도 만든 길은 남아요. 빛나는 이웃 칸으로 이어 갈 수 있어요.</p>`;
  });
}
function wire(
  s: Progress,
  id: keyof Progress["puzzles"]["p4"],
  kind: "photo" | "help",
) {
  const on = s.puzzles.p4[id];
  return b(
    `<svg viewBox="0 0 100 30" aria-hidden="true"><path d="${on ? "M3 15H92m-9-7 10 7-10 7" : "M3 15H37m26 0H97M43 8l14 14m0-14L43 22"}"/></svg><span>${on ? (kind === "photo" ? "전달 중 · 끊기" : "연결됨 · 끊기") : kind === "photo" ? "차단됨 · 잇기" : "끊김 · 잇기"}</span>`,
    "switch",
    id,
    `class="wire ${kind} ${on ? "connected" : "disconnected"}" role="switch" aria-checked="${on}" aria-label="${{ "photo-1": "기기에서 단체 대화방으로 사진 전달", "photo-2": "단체 대화방에서 다른 대화방으로 사진 전달", "help-1": "친구에게 도움 요청", "help-2": "교무실 선생님에게 도움 요청", "help-3": "상담교사에게 도움 요청" }[id]}" ${disabled(done(s, "P4"))}`,
  );
}
function p4(s: Progress) {
  return locked(
    s,
    "P4",
    () => `${head("사진은 멈추고, 도움은 이어요", "선을 누르면 끊거나 연결할 수 있어요.")}${solved(s, "P4")}
 <div class="physical-network photo-network"><h4>▧ 사진 전달</h4><div class="network-chain"><span class="network-person">${animal("토끼", 48)}친구의 기기</span>${wire(s, "photo-1", "photo")}<span class="network-person">${icon("note", 36)}단체 대화방</span>${wire(s, "photo-2", "photo")}<span class="network-person">${icon("note", 36)}다른 대화방</span></div></div>
 <div class="physical-network help-network"><h4>♡ 도움 요청</h4><div class="network-chain help-first"><span class="network-person">${animal("토끼", 48)}도움이 필요한 친구</span>${wire(s, "help-1", "help")}<span class="network-person">${animal("곰", 48)}함께 돕는 친구</span></div><div class="help-branches"><div><span>함께 돕는 친구</span>${wire(s, "help-2", "help")}<strong>♙ 교무실 선생님</strong></div><div><span>함께 돕는 친구</span>${wire(s, "help-3", "help")}<strong>♙ 상담교사</strong></div></div></div><p class="notice">더 전달되지 않게 막는 활동이에요. 이미 전달된 사진이 자동으로 삭제되지는 않아요.</p>`,
  );
}
function p5(s: Progress) {
  return locked(s, "P5", () => {
    const p = s.puzzles.p5,
      d = done(s, "P5"),
      ask = ["교무실", "상담실"].includes(p.place);
    return `${head("도움이 닿는 지도", `현재 ${p.place}에 있어요. 선으로 연결된 장소를 눌러 이동해요.`)}${solved(s, "P5")}
 <div class="school-map"><svg viewBox="0 0 500 250" preserveAspectRatio="none" aria-hidden="true"><path d="M75 190H250V60M250 190H337V60H425M250 190H425"/></svg><div class="map-places">${(["교실", "복도", "담임 자리", "교무실", "상담실"] as const).map((place) => b(`<span>${place === "교실" ? "▦" : place === "복도" ? "↔" : place === "담임 자리" ? "♙" : "♡"}</span><strong>${place}</strong><small>${place === p.place ? "● 현재 위치" : place === "담임 자리" ? "지금 자리에 없음" : ["교무실", "상담실"].includes(place) ? "도움 가능한 어른" : "연결된 길"}</small>`, "move", place, `class="map-room ${place === p.place ? "current" : ""}" ${disabled(d || !ADJACENCY[p.place].includes(place))}`)).join("")}</div></div>
 ${
   p.place === "담임 자리"
     ? `<div class="npc-dialog"><strong>지금 자리에 없어요.</strong><p>복도로 돌아가 다른 선생님을 찾아볼까요?</p>${b("복도로 돌아가기", "move", "복도")}</div>`
     : ask
       ? `<div class="npc-dialog"><span class="npc-face">♙</span><h4>무슨 이야기를 전하고 싶나요?</h4><div class="spoken-sentences">${p.sentence.map((id, i) => b(`${i + 1}. ${SENTENCES[id]} ×`, "sentence-remove", String(i), disabled(d))).join("")}</div><div class="sentence-cards">${Object.entries(
           SENTENCES,
         )
           .filter(([id]) => !p.sentence.includes(id))
           .map(([id, text]) => b(text, "sentence-add", id, disabled(d)))
           .join(
             "",
           )}</div><p class="muted">먼저 도움이 필요하다는 말을 전하고, 이야기할 방법을 이어 골라요.</p></div>`
       : '<p class="map-note">담임 자리에서 도움을 못 받아도 다른 어른을 찾을 수 있어요.</p>'
 }<details class="map-legend"><summary>지도 기호 읽기</summary><p>화살표 = 3 · 말풍선 = 1 · 어른 = 2</p></details>`;
  });
}
function final(s: Progress, c: ViewContext) {
  if (s.solvedPuzzleIds.length < 5)
    return `<div class="physical-lock">${icon("key", 60)}<h3>우정 조각 다섯 개가 필요해요</h3><p>교실의 장치에서 조각을 모아 출구에 맞춰요.</p></div>`;
  const p = s.puzzles.final;
  return `${head("우정 조각으로 지도 완성하기", "조각을 골라 홈에 놓고, 놓인 조각을 눌러 ▲ 위로 돌려요.")}${s.finalCombined ? `<div class="treasure-map"><span>숨겨진 열쇠의 위치</span><strong>${MAP_WORDS.join(" / ")}</strong>${b("화분 받침 살펴보기", "inspect", "O11", 'class="primary"')}</div>` : ""}<div class="fragment-slots physical-fragments">${[
    0, 1, 2, 3, 4,
  ]
    .map((i) => {
      const id = p.order[i],
        n = Number(id?.slice(1)) - 1;
      return b(
        `<small>${i + 1}번째 홈</small>${id ? `<span class="piece-mark" style="transform:rotate(${p.rotations[n]}deg)">▲</span><strong>${FRAGMENTS[n]}</strong><small>↻</small>` : '<span class="empty-piece">＋</span>'}`,
        "fragment-slot",
        String(i),
        `class="fragment-home ${c.held && i <= p.order.length ? "can-place" : ""}" aria-label="${i + 1}번째 조각 홈${id ? " " + FRAGMENTS[n] + " 회전" : ""}" ${disabled(s.finalCombined || (!id && !c.held) || (!id && i > p.order.length))}`,
      );
    })
    .join(
      "",
    )}</div><div class="fragment-pool">${FRAGMENTS.map((name, i) => (!p.order.includes(`F${i + 1}`) ? b(`<span class="piece-mark" style="transform:rotate(${p.rotations[i]}deg)">▲ 위</span><strong>${name}</strong>`, "hold", `F${i + 1}`, `class="${c.held === `F${i + 1}` ? "held" : ""}" aria-pressed="${c.held === `F${i + 1}`}" ${disabled(s.finalCombined)}`) : "")).join("")}</div>${!s.finalCombined ? b("조각 다시 배치하기", "fragment-reset") : ""}<p class="muted">칠판에 적힌 순서: ${FRAGMENTS.join(" → ")}</p>`;
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
        modeMenu(mode, "초대장") +
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
        modeMenu(mode, "도구함 라벨") +
        (mode === "bonus"
          ? bonus(
              s,
              "B2",
              "함께 쓰는 도구함의 라벨",
              `<div class="label-options">${b("👐 펼친 두 손<br>함께 쓰기", "bonus", "B2:함께 쓰기")}${b("▣ 개인용 자물쇠", "bonus", "B2:개인용")}${b("◷ 사용 중 시계", "bonus", "B2:사용 중")}</div>`,
            )
          : `${head("공용 도구함", "이 렌즈는 누구나 함께 쓸 수 있어요.")}<div class="toolbox-open">${b('<span class="big-lens">◎</span><strong>공용 렌즈 집기</strong>', "take", "shared-lens", `class="collect-object" ${disabled(s.inventory.includes("shared-lens"))}`)}</div>${s.inventory.includes("shared-lens") ? '<p class="opened-device">렌즈를 아래 아이템 칸에 넣었어요.</p>' : ""}`)
      );
    case "O07":
      return p3(s, c);
    case "O08":
      return p4(s);
    case "O09":
      return p5(s);
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
        ? `<div class="key-found">${icon("key", 94)}<h3>받침 아래에서 열쇠를 찾았어요!</h3><p>아래 아이템 칸에 넣었어요. 열쇠를 고른 뒤 출구를 눌러요.</p>${b("교실로 돌아가기", "close-panel", "", 'class="primary"')}</div>`
        : `<div class="pot-base">♧<h3>둥근 화분 받침</h3><p>완성된 지도가 숨은 곳을 알려 줄 거예요.</p></div>`;
    case "O12":
      return s.solvedPuzzleIds.length === 5
        ? modeMenu(mode, "기호 잠금장치") +
            (mode === "bonus"
              ? bonus(
                  s,
                  "B4",
                  "출구 옆 기호 잠금장치",
                  `<div class="symbol-lock">→ ▱ ♙</div><p>도움 지도에서 본 기호의 숫자를 눌러요.</p><form data-form="bonus4"><label for="bonus-code">세 자리 암호</label><input id="bonus-code" name="code" value="${esc(s.puzzles.b4)}" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" autocomplete="off" required/><button type="submit" class="primary">잠금장치 열기</button></form>`,
                )
              : final(s, c)) +
            `<div class="door-target">${b(`${icon("key", 35)} 출구의 열쇠 구멍`, "use-exit", "", 'class="door-keyhole"')}<p>열쇠를 선택한 뒤 여기를 눌러도 돼요.</p></div>`
        : final(s, c);
    default:
      return "";
  }
}
