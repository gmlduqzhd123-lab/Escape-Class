import { inlineFeedback } from "./visibility";
import type { ViewContext } from "./views";
import { button as b, esc } from "./helpers";
import {
  DEFAULT_LESSON,
  ROLES,
  PLEDGES,
  roleAssignments,
  cooperationLegend,
  type Experience,
} from "../game/learning";
import { EPISODES, episode } from "../content/episodes";

export function lessonSetup(c: ViewContext, compact = false) {
  const o = c.lessonDraft ?? DEFAULT_LESSON;
  const html = `<section class="surface lesson-settings"><h2>우리 수업에 맞춰요</h2><p>학년과 시간, 모둠 활동을 골라요. 설정은 새 게임부터 적용돼요.</p><fieldset><legend>학년과 도움</legend>${b("3~4학년 · 차근차근", "lesson", "grade:guided", `aria-pressed="${o.grade === "guided"}"`)}${b("5~6학년 · 스스로", "lesson", "grade:standard", `aria-pressed="${o.grade === "standard"}"`)}</fieldset><fieldset><legend>수업 시간</legend>${[15, 25, 40].map((n) => b(`${n}분`, "lesson", `minutes:${n}`, `aria-pressed="${o.minutes === n}"`)).join("")}<p>${o.minutes === 15 ? "필수 퍼즐에 집중해요. 추가 단서는 숨겨요." : o.minutes === 40 ? "추가 단서와 역할 설명, 실천 약속까지 충분히 나눠요." : "필수 퍼즐과 원하는 추가 단서를 찾아요."}</p></fieldset><fieldset><legend>협동과 힌트</legend>${b(o.cooperation ? "✓ 역할 단서로 도구함 열기" : "역할 단서로 도구함 열기", "lesson", `cooperation:${!o.cooperation}`, `aria-pressed="${o.cooperation}"`)}${b(o.hints === "suggest" ? "✓ 막히면 도움 제안" : "막히면 도움 제안", "lesson", `hints:${o.hints === "suggest" ? "request" : "suggest"}`, `aria-pressed="${o.hints === "suggest"}"`)}</fieldset><fieldset><legend>이야기 선택</legend>${Object.values(
    EPISODES,
  )
    .map((p) =>
      b(
        `${p.label} · ${p.title}`,
        "lesson",
        `episode:${p.id}`,
        `aria-pressed="${o.episode === p.id}"`,
      ),
    )
    .join(
      "",
    )}<p>${episode(o.episode).intro}</p></fieldset><p class="muted">차근차근·협동·도서관 테마는 연습 활동이에요. 점수는 학생 평가에 쓰지 않아요.</p>${b("기본 공식 규칙으로 맞추기", "lesson", "official")}</section>`;
  return compact
    ? `<details class="surface lesson-options optional-controls" data-disclosure="lesson-settings"><summary>수업 설정 바꾸기 · ${o.grade === "guided" ? "차근차근" : "스스로"} · ${o.minutes}분 · ${episode(o.episode).label}</summary>${html}</details>`
    : html;
}
export function teamSummary(c: ViewContext) {
  if (!c.learning || !c.state) return "";
  const people = roleAssignments(c.learning, c.state);
  return `<section class="team-summary"><h3>이번에는 누가 맡을까요?</h3><p>이름 대신 모둠 자리 1~4번을 정해요. 퍼즐을 풀면 역할이 한 칸씩 바뀌어요.</p><div class="role-grid">${people.map((x) => `<div><strong>${x.student}번 친구</strong><span>${x.role.endsWith("기") ? x.role : x.role + "하기"}</span></div>`).join("")}</div>${b("역할 한 칸 바꾸기", "role-shift")}${b("역할 단서 카드 보기", "modal", "team-puzzle")}${b("역할 카드 인쇄", "print-roles")}${b("역할 카드 파일 저장", "download-roles")}</section>`;
}
export function teamPuzzle(c: ViewContext) {
  const e = c.learning!;
  const guided = e.options.grade === "guided";
  const selected = c.roleCard ?? null;
  const people = roleAssignments(e, c.state!);
  const ready = e.viewedRoles.includes(0) && e.viewedRoles.includes(1);
  const cards = [
    `기호 순서: ${episode(e.options.episode)
      .coopSequence.slice(0, guided ? 2 : 3)
      .join(" → ")}. 이 순서를 친구에게 말해요.`,
    `기호 사전: ${cooperationLegend(e)}. 친구가 말한 기호를 숫자로 바꿔요.`,
    "두 친구의 설명을 연결하고, 서로 같은 뜻으로 이해했는지 확인해요.",
    `친구의 설명을 듣고 ${guided ? "두" : "세"} 자리 숫자를 눌러요.`,
  ];
  const tab = (i: number) =>
    b(
      `${people[i].student}번 친구 · ${ROLES[i]} 단서${e.viewedRoles.includes(i) ? " ✓" : ""}`,
      "role-card",
      String(i),
      `aria-pressed="${selected === i}"`,
    );
  const card =
    selected !== null && selected < 2
      ? `<article class="role-clue"><h3 tabindex="-1">${people[selected].student}번 ${ROLES[selected]} 친구가 읽어요</h3><p>${cards[selected]}</p></article>${b(selected === 0 ? "다음: 숫자 단서 읽기 →" : ready ? "다음: 암호 입력하기 →" : "관찰 단서부터 보기 →", "role-card", selected === 0 ? "1" : ready ? "" : "0", 'class="primary"')}`
      : "";
  const keypad =
    selected === null && ready
      ? `<div class="coop-entry"><div class="coop-code-context"><h3 tabindex="-1" class="coop-input-title">${people[3].student}번 조작 친구가 암호를 눌러요</h3><p class="coop-stage">${inlineFeedback(c.toast, "3/3 · 두 단서를 숫자로 바꿔요.")}</p><output class="team-code" aria-live="polite">${esc(e.coopCode.padEnd(guided ? 2 : 3, "_"))}</output>${b("단서 다시 보기", "role-card", "0", 'class="coop-recall"')}</div><div class="keypad team-keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지우기", 0].map((n) => b(String(n), "coop-code", String(n))).join("")}</div></div>`
      : "";
  return `<h2 id="dialog-title">친구와 도구함 열기</h2>${e.coopSolved ? '<p class="opened-device">✓ 두 친구의 단서를 맞췄어요!</p>' + b("렌즈 찾으러 가기 →", "inspect", "O06", 'class="primary"') : `${selected === null && ready ? "" : `<p class="notice">${selected !== null && selected >= 2 ? "다른 역할 도움 · 선택" : selected === null && ready ? "3/3 · 두 단서를 숫자로 바꿔요." : selected === 1 ? "2/3 · 숫자 단서를 읽어요." : "1/3 · 기호 순서를 읽어요."}</p>`}${selected === null && ready ? "" : `<div class="role-card-tabs">${tab(0)}${tab(1)}</div>`}${card}${keypad}${selected === null && !ready ? b("첫 번째 단서 읽기 →", "role-card", "0", 'class="primary"') : ""}`}<details class="optional-controls" data-disclosure="coop-extras"><summary>다른 역할·인쇄 카드 · 선택</summary><div class="role-card-tabs">${tab(2)}${tab(3)}</div>${selected !== null && selected >= 2 ? `<article class="role-clue"><h3 tabindex="-1">${people[selected].student}번 ${ROLES[selected]} 친구가 읽어요</h3><p>${cards[selected]}</p>${b(e.coopSolved ? "설명 카드 닫기" : "두 단서로 돌아가기", "role-card", ready ? "" : "0")}</article>` : ""}${b("역할 카드 인쇄", "print-roles")}${b("역할 카드 파일 저장", "download-roles")}</details>`;
}
export function learningPanel(c: ViewContext, html: string) {
  const e = c.learning;
  if (!e || !c.state) return html;
  if (e.options.minutes === 15) {
    html = html.replace(
      /(<button\b[^>]*data-action="device"[^>]*data-value="bonus"[^>]*)(>)/g,
      "$1 hidden$2",
    );
    if (c.objectId === "O10")
      return (
        "<h3>책장의 그림</h3><p>15분 활동에서는 다섯 우정 조각에 집중해요.</p>" +
        b("다음 단서 찾기", "close-panel")
      );
  }
  if (
    e.options.cooperation &&
    !e.coopSolved &&
    ["O05", "O06"].includes(c.objectId ?? "") &&
    c.state.solvedPuzzleIds.includes("P1")
  ) {
    html = html.replace(
      /(<button\b[^>]*data-action="take"[^>]*)(>)/g,
      "$1 disabled$2",
    );
    html =
      `<div class="cooperation-gate"><h3>친구의 설명으로 도구함을 열어요</h3><p>기호 순서와 숫자 사전을 나눠 읽어요.</p>${b("협동 단서 맞추기", "modal", "team-puzzle", 'class="primary"')}</div>` +
      html;
  }
  if (e.options.grade === "guided") {
    const help: Record<string, string> = {
      O02: "첫 메모를 놓았어요. 토끼가 직접 한 말을 찾고, 끝 기호까지 이어요.",
      O04: "렌즈의 위를 맞춰 두었어요. 창 1 → 2 → 3 순서로 숫자를 눌러요.",
      O07: "시작 부분을 이어 두었어요. 남은 세 친구를 만나고 골대로 가요.",
      O08: "사진 전달 두 곳은 끄고, 친구와 어른에게 도움을 이어요.",
      O09: "복도를 거쳐 교무실이나 상담실로 가요.",
    };
    if (help[c.objectId ?? ""])
      html =
        `<p class="guided-help">차근차근 · ${help[c.objectId!]}</p>` + html;
    if (c.objectId === "O04")
      html = html.replace(
        /(<button\b[^>]*data-action="lens-rotate"[^>]*)(>)/g,
        "$1 disabled$2",
      );
  }
  if (
    c.sceneMode === "3d" &&
    ((c.objectId === "O04" && c.state.solvedPuzzleIds.includes("P1")) ||
      (c.objectId === "O06" &&
        c.state.solvedPuzzleIds.includes("P1") &&
        (!e.options.cooperation || e.coopSolved)) ||
      (c.objectId === "O12" && c.state.finalKeyObtained))
  )
    html += `<details class="optional-controls" data-disclosure="device-motion"><summary>장치 움직여 보기 · 선택</summary>${b(
      c.objectId === "O04"
        ? "서랍 열고 닫기"
        : c.objectId === "O06"
          ? "도구함 뚜껑 열고 닫기"
          : "출구 문 열고 닫기",
      "operate-device",
      c.objectId!,
      'class="operate-device"',
    )}</details>`;
  return html;
}
export function pledgeView(c: ViewContext) {
  const selected = c.learning?.pledge;
  return `<section class="surface pledge-section"><h2>우리 모둠의 작은 실천</h2><p>모두 실천할 수 있는 약속 하나를 골라요. 개인 이름이나 점수는 카드에 넣지 않아요.</p><div class="pledge-options">${PLEDGES.map((p, i) => b(p, "pledge", String(i), `aria-pressed="${selected === i}"`)).join("")}</div>${selected !== null && selected !== undefined ? `<article class="pledge-preview" tabindex="-1" role="region" aria-label="선택한 실천 카드"><small>함께 정한 약속</small><h3>${PLEDGES[selected]}</h3><p>실천한 순간을 발견하면 고마운 마음을 전해요.</p></article>${b("실천 카드 인쇄 / PDF", "print-pledge")}${b("실천 카드 파일 저장", "download-pledge")}` : ""}</section>`;
}
export function rolesDocument(e: Experience) {
  const seq = episode(e.options.episode)
    .coopSequence.slice(0, e.options.grade === "guided" ? 2 : 3)
    .join(" → ");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>모둠 역할 카드</title><style>body{font-family:system-ui,'Malgun Gothic',sans-serif;color:#254e45;padding:24px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{border:2px dashed #6e855c;border-radius:16px;padding:25px;break-inside:avoid}p{font-size:22px;line-height:1.8}</style><h1>나눠 가지고 서로 설명해요</h1><p>${episode(e.options.episode).title}</p><div class="cards">${[`${seq} 순서로 기호를 읽어 주세요.`, `${cooperationLegend(e)}. 친구가 말한 기호를 숫자로 바꿔요.`, `두 친구의 설명을 연결하고 서로 확인해요.`, `친구의 설명을 들은 뒤 ${e.options.grade === "guided" ? 2 : 3}자리 암호를 눌러요.`].map((t, i) => `<article><h2>${i + 1}. ${ROLES[i]} 친구</h2><p>${t}</p></article>`).join("")}</div></html>`;
}
export const DEVICE_CHECKS = [
  "가로로 돌렸을 때 안내가 닫히고 교실이 보여요.",
  "손가락으로 물건 이름과 발자국을 누를 수 있어요.",
  "화면을 밀어 둘러본 뒤 물건이 잘못 열리지 않아요.",
  "글씨와 버튼이 읽기 쉽고 서로 겹치지 않아요.",
  "새로고침 후 같은 진행으로 이어갈 수 있어요.",
  "퍼즐을 끝까지 풀고 열쇠로 탈출했어요.",
];
export type DeviceAudit = {
  device: string;
  checks: number[];
  taps: number;
  swipes: number;
  multi: number;
  touchSeen: boolean;
};
export function deviceView(a: DeviceAudit) {
  return `<main id="main" class="narrow"><a href="#/teacher">← 수업 안내</a><h1>실제 기기 점검</h1><p>이 화면을 시험할 휴대폰·태블릿에서 열어요. 아래 결과는 이 기기에만 있고, 파일로 저장할 때만 내보내요.</p><label>시험 기기<select data-input="audit-device">${["기기 선택", "안드로이드 Chrome", "아이폰 Safari", "아이패드 Safari", "기타"].map((x) => `<option ${a.device === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><p>화면 ${innerWidth} × ${innerHeight} · ${innerWidth > innerHeight ? "가로" : "세로"} · 터치 API ${navigator.maxTouchPoints > 0 ? "제공" : "없음"}</p><div id="device-touch-pad" class="device-touch-pad">손가락으로 누르고 옆으로 밀어 봐요.<br>두 손가락도 올려 봐요.</div><p id="device-touch-stats">터치 감지 ${a.touchSeen ? "있음" : "아직 없음"} · 누르기 ${a.taps} · 밀기 ${a.swipes} · 두 손가락 ${a.multi}</p><p>아래 항목은 직접 게임을 확인한 뒤 표시해요. 자동으로 실기기 통과를 판정하지 않아요.</p>${DEVICE_CHECKS.map((text, i) => b(`${a.checks.includes(i) ? "✓" : "○"} ${text}`, "audit-check", String(i), `class="audit-row" aria-pressed="${a.checks.includes(i)}"`)).join("")}${b("점검 결과 파일 저장", "audit-download")}${b("게임 시작 화면으로", "home")}<p class="muted">아직 직접 시험하지 않은 항목은 미실시로 기록해요.</p></main>`;
}
