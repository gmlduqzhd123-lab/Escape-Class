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
import { WALLS, FRIENDS, ADJACENCY, lensWindows } from "../puzzles/judges";
import { button as b, esc, animal, icon } from "./helpers";
const done = (s: Progress, id: PuzzleId) => s.solvedPuzzleIds.includes(id);
const lock = (s: Progress, id: PuzzleId, html: () => string) =>
  !unlocked(s, id)
    ? `<div class="locked">${icon("key", 32)}<h3>아직 잠긴 장치예요</h3><p>${FRAGMENTS[PUZZLES.indexOf(id) - 1]} 조각을 먼저 찾아요. 물건 설명과 추가 단서는 언제든 살펴볼 수 있어요.</p></div>`
    : html();
function puzzleHeader(s: Progress, id: PuzzleId, title: string) {
  return `<div class="eyebrow">${id} · ${FRAGMENTS[PUZZLES.indexOf(id)]} ${done(s, id) ? "✓ 해결했어요" : ""}</div><h3>${title}</h3>`;
}
const disabled = (yes: boolean) => (yes ? "disabled" : "");
function p1(s: Progress) {
  const p = s.puzzles.p1,
    d = done(s, "P1");
  return `${puzzleHeader(s, "P1", "토끼의 이야기를 연결해요")}<p>발견한 카드를 뒤집어 기호를 읽고, 세 장을 순서대로 배치해요.</p>
  <div class="clue-cards">${CLUES.filter((c) =>
    s.discoveredClueIds.includes(c.id),
  )
    .map(
      (c) =>
        `<article class="clue-card ${p.flipped.includes(c.id) ? "flipped" : ""}"><small>${c.id}</small><div class="card-picture">${c.id === "P1-C1" ? animal("토끼") : c.id === "P1-C5" ? '<span class="drawing-sign">☞ ▤</span>' : icon("note", 32)}</div><p>${esc(p.flipped.includes(c.id) ? c.back : c.text)}</p>${b(p.flipped.includes(c.id) ? "앞면 보기" : "뒤집기", "flip", c.id, disabled(d))}${b("배치하기", "p1-add", c.id, disabled(d || p.order.includes(c.id) || p.order.length >= 3))}</article>`,
    )
    .join("")}</div>
  ${!s.discoveredClueIds.includes("P1-C3") ? '<p class="notice">아직 찾지 못한 카드가 있어요. 바구니 옆 쪽지를 살펴볼까요?</p>' : ""}
  <ol class="slots">${[0, 1, 2].map((i) => `<li>${p.order[i] ? esc(CLUES.find((c) => c.id === p.order[i])?.short) : `${i + 1}번째 카드`}${p.order[i] ? b("빼기", "p1-remove", String(i), disabled(d)) : ""}</li>`).join("")}</ol>
  ${b("연결 확인하기", "solve", "P1", `class="primary" ${disabled(d)}`)}${d ? '<p class="success">완성된 지도는 창가 두 번째 그림 책상 O04를 가리켜요.</p>' : ""}`;
}
function p2(s: Progress, selected: ItemId | null) {
  return lock(s, "P2", () => {
    const p = s.puzzles.p2,
      d = done(s, "P2"),
      windows = lensWindows(p.rotation);
    return `${puzzleHeader(s, "P2", "허락받은 렌즈로 암호를 읽어요")}<p>판과 렌즈의 <strong>▲ 위</strong> 표시를 맞춰요. 창 번호 순서로 숫자를 읽어요.</p>
  ${b(`${icon("bag")} ${selected ? "선택한 도구 사용하기" : "가방에서 도구 선택"}`, selected ? "apply" : "modal", selected ? "O04" : "bag", disabled(d))}
  <div class="cipher"><div class="board-up">▲ 위 · 암호판</div>${p.lensUsed ? `<div class="lens-indicator"><span class="lens-up-mark" style="transform:rotate(${p.rotation}deg)">▲ 위</span><span>투명 렌즈 · ${p.rotation}°</span></div>` : '<div class="muted">렌즈를 사용해 주세요</div>'}<div class="cipher-grid">${[
    7, 2, 9, 4, 6, 1, 8, 3, 5,
  ]
    .map((n, i) => {
      const wi = p.lensUsed
        ? windows.findIndex(
            ([x, y]) => x === (i % 3) + 1 && y === Math.floor(i / 3) + 1,
          )
        : -1;
      return `<div class="${wi >= 0 ? "window-cell" : ""}">${wi >= 0 ? `<small>창 ${wi + 1}</small>` : ""}${n}</div>`;
    })
    .join("")}</div></div>
  ${b("렌즈 회전하기 ↻ 90°", "lens-rotate", "", disabled(d || !p.lensUsed))}
  <div class="code-display" aria-live="polite" aria-label="입력한 암호">${esc(p.code.padEnd(3, "_"))}</div><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지우기", 0].map((n) => b(String(n), "code", String(n), disabled(d))).join("")}</div>${b("암호 확인하기", "solve", "P2", `class="primary" ${disabled(d)}`)}`;
  });
}
function p3(
  s: Progress,
  ballPath: number[],
  ballIndex: number,
  running: boolean,
) {
  return lock(s, "P3", () => {
    const d = done(s, "P3");
    return `${puzzleHeader(s, "P3", "모두에게 닿는 우정 공")}<p>네 친구 모두 참여하고 싶대요. 타일을 눌러 <strong>→ ↓ ← ↑</strong> 순서로 회전해요.</p><div class="friends">${Object.entries(
      FRIENDS,
    )
      .map(
        ([i, n]) =>
          `<span>${animal(n, 38)} ${n} ${ballPath.slice(0, ballIndex + 1).includes(Number(i)) ? "✓" : ""}</span>`,
      )
      .join("")}</div>
  <div class="ball-grid" role="group" aria-label="5 곱하기 5 화살표 놀이판">${s.puzzles.p3.arrows.map((a, i) => (WALLS.includes(i) ? `<div class="wall" aria-label="(${(i % 5) + 1},${Math.floor(i / 5) + 1}) 벽">벽</div>` : i === 14 ? `<div class="goal ${ballPath[ballIndex] === i ? "ball-here" : ""}" aria-label="골대 (5,3)">⚑ 골대</div>` : b(`<small>${FRIENDS[i] ?? (i === 10 ? "시작" : `${(i % 5) + 1},${Math.floor(i / 5) + 1}`)}</small><strong>${ballPath[ballIndex] === i ? "●" : ["→", "↓", "←", "↑"][a]}</strong>${ballPath.slice(0, ballIndex + 1).includes(i) ? '<span class="visited-dot">✓</span>' : ""}`, "arrow", String(i), `class="tile ${ballPath.slice(0, ballIndex + 1).includes(i) ? "visited" : ""}" aria-label="(${(i % 5) + 1},${Math.floor(i / 5) + 1}) ${FRIENDS[i] ?? ""} ${["오른쪽", "아래", "왼쪽", "위"][a]} 화살표 회전하기" ${disabled(d || running)}`))).join("")}</div>
  ${b(running ? "공이 이동하는 중…" : "공 실행하기", "ball-run", "", `class="primary" ${disabled(d || running)}`)}<p class="muted">실패해도 화살표는 그대로예요. 이동 경로의 ✓를 살펴보고 고쳐요.</p>`;
  });
}
function p4(s: Progress) {
  return lock(s, "P4", () => {
    const p = s.puzzles.p4,
      d = done(s, "P4");
    const switches = [
      ["photo-1", "사진 전달 · S 기기 → G 단체 대화방"],
      ["photo-2", "사진 전달 · G → X 다른 대화방"],
      ["help-1", "도움 요청 · S 기기 → H 함께 돕는 친구"],
      ["help-2", "도움 요청 · H → T 교무실 선생님"],
      ["help-3", "도움 요청 · H → C 상담교사"],
    ] as const;
    return `${puzzleHeader(s, "P4", "사진과 도움의 두 연결망")}<p>사진은 더 퍼지지 않게, 도움은 어른에게 닿게 조절해요.</p><div class="network photo-network"><strong>▧ 사진 전달</strong><p>S 기기 <span>${p["photo-1"] ? "━ ON →" : "╳ OFF"}</span> G 단체방 <span>${p["photo-2"] ? "━ ON →" : "╳ OFF"}</span> X 다른 방</p></div><div class="network help-network"><strong>♡ 도움 요청</strong><p>S 기기 ${p["help-1"] ? "━ ON →" : "╳ OFF"} H 친구<br>H 친구 ${p["help-2"] ? "━ ON →" : "╳ OFF"} T 교무실<br>H 친구 ${p["help-3"] ? "━ ON →" : "╳ OFF"} C 상담교사</p></div><div class="switches">${switches.map(([id, text]) => b(`${esc(text)} <strong>${p[id] ? "ON · 켜짐" : "OFF · 꺼짐"}</strong>`, "switch", id, `role="switch" aria-checked="${p[id]}" class="${p[id] ? "on" : ""}" ${disabled(d)}`)).join("")}</div><p class="notice">전달을 끊어도 이미 전달된 사진이 자동으로 삭제되지는 않아요.</p>${b("연결 확인하기", "solve", "P4", `class="primary" ${disabled(d)}`)}`;
  });
}
function p5(s: Progress) {
  return lock(s, "P5", () => {
    const p = s.puzzles.p5,
      d = done(s, "P5"),
      canAsk = ["교무실", "상담실"].includes(p.place);
    return `${puzzleHeader(s, "P5", "도움이 닿는 지도")}<p><strong>현재 위치: ${p.place}</strong></p><div class="map-places">${(["교실", "복도", "담임 자리", "교무실", "상담실"] as const).map((place) => b(`${place} ${place === p.place ? "● 현재 위치" : ""}<small>${place === "담임 자리" ? "지금 자리에 없음" : ["교무실", "상담실"].includes(place) ? "도움 가능한 어른 있음" : place === "복도" ? "교실·담임 자리·교무실·상담실 연결" : "복도와 연결"}</small>`, "move", place, `class="${place === p.place ? "current" : ""}" ${disabled(d || !ADJACENCY[p.place].includes(place))}`)).join("")}</div><p class="muted">교실 ↔ 복도 ↔ 담임 자리 / 교무실 / 상담실</p>${p.place === "담임 자리" ? '<p class="notice">지금 자리에 없어요. 복도로 돌아가 교무실이나 상담실로 이동해도 감점은 없어요.</p>' : ""}
  ${
    canAsk
      ? `<h4>도움 요청 문장 조합하기</h4><div class="sentence-cards">${Object.entries(
          SENTENCES,
        )
          .map(([id, text]) =>
            b(
              `${id} · ${text}`,
              "sentence-add",
              id,
              disabled(d || p.sentence.includes(id)),
            ),
          )
          .join(
            "",
          )}</div><ol class="sentence-order">${p.sentence.map((id, i) => `<li>${esc(SENTENCES[id])}${b("빼기", "sentence-remove", String(i), disabled(d))}</li>`).join("")}</ol>${b("도움 요청하기", "solve", "P5", `class="primary" ${disabled(d)}`)}`
      : '<p class="notice">도움 가능한 장소에 도착하면 문장 카드를 조합할 수 있어요.</p>'
  }<div class="legend">지도 범례: 화살표 → = 3 · 말풍선 ▱ = 1 · 어른 ♙ = 2</div>`;
  });
}
function final(s: Progress) {
  if (s.solvedPuzzleIds.length < 5)
    return '<p class="notice">다섯 우정 조각을 모으면 마지막 조합판이 열려요.</p>';
  const p = s.puzzles.final,
    d = s.finalCombined;
  return `<div class="eyebrow">마지막 조합 · ${d ? "✓ 완성" : "다섯 우정 조각"}</div><h3>우리의 조각을 하나로</h3><p>칠판의 순서대로 배치하고, 각 조각의 ▲ 위를 맞춰요.</p><div class="fragment-pool">${FRAGMENTS.map((name, i) => b(`<span class="piece-mark" style="transform:rotate(${p.rotations[i]}deg)">▲ 위</span><strong>F${i + 1} ${name}</strong><small>${p.rotations[i]}°</small>`, "fragment-add", `F${i + 1}`, disabled(d || p.order.includes(`F${i + 1}`)))).join("")}</div><ol class="fragment-slots">${[
    0, 1, 2, 3, 4,
  ]
    .map((i) => {
      const id = p.order[i],
        n = Number(id?.slice(1)) - 1;
      return `<li><small>${i + 1}번째</small>${id ? `<span class="piece-mark" style="transform:rotate(${p.rotations[n]}deg)">▲ 위</span><strong>${FRAGMENTS[n]}</strong>${b("회전 ↻", "fragment-rotate", String(n), disabled(d))}${b("빼기", "fragment-remove", String(i), disabled(d))}` : "조각 배치"}</li>`;
    })
    .join(
      "",
    )}</ol>${b("지도 완성하기", "combine", "", `class="primary" ${disabled(d)}`)}${d ? `<div class="success treasure-map"><strong>${MAP_WORDS.join(" / ")}</strong><p>그곳에서 열쇠를 찾아 가방에서 선택하고 출구에 사용해요.</p></div>` : ""}`;
}
function bonus(s: Progress, id: string, title: string, html: string) {
  const found = s.foundBonusIds.includes(id as any);
  return `<section class="bonus-box"><div class="eyebrow">추가 단서 ${id} · 5점 ${found ? "✓ 발견" : ""}</div><h3>${title}</h3>${found ? '<p class="success">단서를 발견했어요. 점수는 한 번만 반영돼요.</p>' : html}</section>`;
}
export function objectContent(
  s: Progress,
  id: string,
  selected: ItemId | null,
  path: number[],
  ballIndex: number,
  running: boolean,
) {
  switch (id) {
    case "O01":
      return `<div class="chalk-note"><h3>사라진 우정 열쇠</h3><p>교실 장치를 해결하고, 조각을 연결해 마지막 열쇠를 찾아요.</p><p class="fragment-sequence">${FRAGMENTS.map((x, i) => `F${i + 1} ${x}`).join(" → ")}</p><p>점수는 퍼즐 해결 기록이에요. 친구의 인성을 평가하지 않아요.</p></div>`;
    case "O02":
      return (
        p1(s) +
        bonus(
          s,
          "B3",
          "초대장을 연결해요",
          `<p>1–2는 원, 2–3은 삼각형으로 맞물려요.</p><div class="invites">${["3", "1", "2"].map((n) => b(`<small>${n === "1" ? "시작 → ○" : n === "2" ? "○ → △" : "△ → 끝"}</small>${INVITATIONS[n]}`, "invite-add", n, disabled(s.puzzles.b3.includes(n)))).join("")}</div><ol>${s.puzzles.b3.map((n) => `<li>${esc(INVITATIONS[n])}</li>`).join("")}</ol>${b("처음부터 배치", "invite-reset")}${b("초대장 확인", "bonus", `B3:${s.puzzles.b3.join(",")}`)}`,
        )
      );
    case "O03":
      return `<div class="character-quote">${animal("토끼", 92)}<blockquote>${esc(CLUES[2].text)}</blockquote></div><p class="success">P1-C3을 단서 노트에 보관했어요. 게시판에서 뒤집고 연결해 볼 수 있어요.</p>${b("게시판 조사하기", "inspect", "O02")}`;
    case "O04":
      return p2(s, selected);
    case "O05":
      return `<div class="permission-card"><h3>허락된 도구함</h3><p>“투명 렌즈는 사용해도 좋아.”</p>${b(s.inventory.includes("borrowed-lens") ? "✓ 렌즈를 받았어요" : "허락받은 렌즈 받기", "take", "borrowed-lens", disabled(s.inventory.includes("borrowed-lens")))}</div><div class="permission-card"><h3>다른 도구함</h3><p>“지금 쓰는 중이라 빌려주기 어려워.”</p><p class="notice">안내를 존중해 내부를 열지 않아요. 공용 도구함의 렌즈로도 똑같이 진행할 수 있어요.</p></div>`;
    case "O06":
      return `<h3>함께 쓰는 공용 렌즈</h3><p>누구나 쓸 수 있는 게임용 렌즈예요. 허락받은 렌즈와 기능·보상이 같아요.</p>${b(s.inventory.includes("shared-lens") ? "✓ 공용 렌즈를 받았어요" : "공용 렌즈 받기", "take", "shared-lens", disabled(s.inventory.includes("shared-lens")))}${bonus(s, "B2", "공용 도구함의 라벨", `<p>함께 쓸 수 있다는 뜻의 라벨을 골라요.</p>${b('<svg width="30" height="28" viewBox="0 0 60 45" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M24 40V28l-3-5V8c0-4-5-4-5 0v13-17c0-4-5-4-5 0v18-13c0-4-5-4-5 0v17l-2-6c-2-4-6-2-4 2l6 14v4m30 0V28l3-5V8c0-4 5-4 5 0v13-17c0-4 5-4 5 0v18-13c0-4 5-4 5 0v17l2-6c2-4 6-2 4 2l-6 14v4"/></svg> 펼친 두 손 · 함께 쓰기', "bonus", "B2:함께 쓰기")}${b("▣ 개인용 자물쇠", "bonus", "B2:개인용")}${b("◷ 사용 중 시계", "bonus", "B2:사용 중")}`)}`;
    case "O07":
      return p3(s, path, ballIndex, running);
    case "O08":
      return p4(s);
    case "O09":
      return p5(s);
    case "O10":
      return bonus(
        s,
        "B1",
        "두 그림의 같은 기호",
        `<div class="picture-compare"><p>왼쪽: △ 삼각형 · ♡ 하트 · ☆ 별</p><p>오른쪽: ○ 원 · ♧ 나뭇잎 · ♡ 하트</p></div><p>두 그림에 공통으로 있는 기호는 무엇일까요?</p>${["하트", "삼각형", "별", "원", "나뭇잎"].map((x) => b(x, "bonus", `B1:${x}`)).join("")}`,
      );
    case "O11":
      return s.finalKeyObtained
        ? `<div class="key-found">${icon("key", 72)}<h3>마지막 열쇠를 찾았어요!</h3><p>열쇠를 가방에 넣었어요. 가방에서 선택하고 출구에 사용해요.</p>${b("가방 열기", "modal", "bag", 'class="primary"')}</div>`
        : '<p class="notice">둥근 화분 받침 아래를 가리키는 완성된 지도가 필요해요. 먼저 출구의 조합판을 완성해요.</p>';
    case "O12":
      return (
        final(s) +
        `<section class="exit-box"><h3>출구에 아이템 사용하기</h3><p>선택한 아이템: ${selected === "final-key" ? "마지막 열쇠" : selected ? "렌즈" : "없음"}</p>${b("가방 열기", "modal", "bag")}${b("선택한 아이템을 출구에 사용", "use-exit", "", 'class="primary"')}</section>` +
        (done(s, "P5")
          ? bonus(
              s,
              "B4",
              "출구 옆 기호 암호",
              `<p>화살표 → 말풍선 → 어른</p><p>도움 지도의 범례: → = 3, 말풍선 = 1, 어른 = 2</p><form data-form="bonus4"><label for="bonus-code">세 자리 기호 암호</label><input id="bonus-code" name="code" value="${esc(s.puzzles.b4)}" inputmode="numeric" maxlength="3" pattern="[0-9]{3}" autocomplete="off" required /><button class="primary" type="submit">추가 단서 확인</button></form>`,
            )
          : '<p class="muted">B4 기호 암호는 도움 지도 P5를 완성하면 열려요.</p>')
      );
    default:
      return "";
  }
}
