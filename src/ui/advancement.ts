import type { ViewContext } from "./views";
import { button as b, esc, icon, time } from "./helpers";
import { OBJECTS, FRAGMENTS, HINTS } from "../content/data";
import { episode, EPISODES } from "../content/episodes";
import { objective } from "./experience";
import {
  conversation,
  diagnose,
  defaultLessonPack,
  HINT_KEYS,
  type LessonPack,
} from "../game/advancement";
import { PUZZLES } from "../game/model";

export function tutorial(c: ViewContext) {
  const n = c.tutorialStep ?? 0;
  const stages = [
    [
      "물건 살펴보기",
      "이름이 붙은 물건을 눌러 가까이 살펴봐요.",
      "연습 상자 살펴보기",
      "demo-object",
    ],
    [
      "장소 이동하기",
      "‘이동’에서 가고 싶은 곳을 골라요.",
      "이동 · 창가로",
      "demo-move",
    ],
    [
      "가방에서 도구 고르기",
      "찾은 도구를 누르면 손에 들어요.",
      "가방 · 연습 열쇠 선택",
      "demo-bag",
    ],
    [
      "도구 사용하기",
      "열쇠를 고른 뒤 사용할 곳을 눌러요.",
      "연습 상자에 열쇠 사용",
      "demo-use",
    ],
  ];
  return `<h2 id="dialog-title">30초 조작 연습</h2><p>게임의 시간·도구·점수는 바뀌지 않아요.</p><div class="demo-progress" role="status">${Math.min(n, 4)} / 4</div>${n < 4 ? `<section class="demo-stage"><span aria-hidden="true" class="demo-art">${icon(n === 2 ? "bag" : n === 3 ? "key" : "note", 64)}</span><h3 tabindex="-1">${stages[n][0]}</h3><p>${stages[n][1]}</p>${b(stages[n][2], stages[n][3], "", 'class="primary"')}</section>` : `<section class="demo-stage"><h3 tabindex="-1">준비됐어요!</h3><p>물건을 누르고, 장소를 고르고, 가방의 도구를 사용하면 돼요.</p>${b("게임으로 돌아가기", "close-modal", "", 'class="primary"')}</section>`}`;
}
export function spaceMap(c: ViewContext) {
  const s = c.state,
    pack = episode(c.learning?.options.episode ?? "classroom");
  const target = s ? objective(s)[1] : "O02";
  const here = c.objectId ? OBJECTS.find((o) => o.id === c.objectId) : null;
  return `<h2 id="dialog-title">한눈에 보는 ${pack.room}</h2><p>◎ 지금 위치 · ★ 다음 물건 · ✓ 살펴본 곳</p><p>지도 숫자를 보고, 아래의 큰 물건 이름을 눌러요.</p><div class="map-paper" role="img" aria-label="${pack.room} 안의 물건 위치"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="2" y="2" width="96" height="96" rx="5" fill="#edf0df" stroke="#8ca28b"/><path d="M50 8V92M8 50H92" stroke="#fffdf4" stroke-width="9"/>${OBJECTS.map((o, i) => `<circle cx="${o.x}" cy="${o.y}" r="${o.id === target ? 5 : 3.5}" fill="${o.id === target ? "#c7a24d" : s?.discoveredClueIds.includes(o.id) ? "#52755e" : "#a7b49a"}"/><text x="${o.x}" y="${o.y + 1.3}" text-anchor="middle" font-size="6" fill="white">${i + 1}</text>`).join("")}<text x="${here?.x ?? 50}" y="${here ? Math.min(94, here.y + 9) : 52}" font-size="7" text-anchor="middle" fill="#214f45">◎</text></svg></div><p>현재: ${esc(here ? here.name : c.learning?.view.pose?.stop === "plant" ? "창가" : `${pack.room} 통로`)}</p><div class="map-object-list">${OBJECTS.map((o, i) => b(`${i + 1}. ${esc(o.name)}<small>${o.id === target ? "★ 다음 물건" : s?.discoveredClueIds.includes(o.id) ? "✓ 살펴봄" : "살펴보기"}</small>`, "inspect", o.id, `class="${o.id === target ? "next-object" : ""}"`)).join("")}</div>`;
}
export function friendTalk(c: ViewContext) {
  const talk = conversation(c.learning),
    selected = c.learning?.extras.conversation;
  return `<h2 id="dialog-title">친구에게 말 걸기</h2><p>${talk.situation}</p><div class="talk-options">${talk.options.map((text, i) => b(text, "talk-choice", String(i), `aria-pressed="${selected === i}"`)).join("")}</div>${selected !== null && selected !== undefined ? `<article class="friend-reply" tabindex="-1" role="region" aria-label="친구의 대답"><strong>토끼의 대답</strong><p>${esc(talk.replies[selected])}</p><p class="muted">말하는 방법은 여러 가지예요. 친구의 답을 듣고 다시 물어볼 수 있어요.</p></article>` : ""}`;
}
export function teacherProgress(c: ViewContext) {
  const s = c.state,
    pack = episode(c.learning?.options.episode ?? "classroom");
  if (!s)
    return `<main id="main" class="narrow"><h1>이 기기의 진행 확인</h1><p>아직 시작한 활동이 없어요.</p><a href="#/">시작 화면으로</a></main>`;
  const current = OBJECTS.find((o) => o.id === c.objectId);
  return `<main id="main" class="narrow advancement-page"><a href="#/teacher">← 수업 안내</a><h1>이 기기의 진행 확인</h1><p>학생 이름을 입력하지 않아요. 다른 기기의 진행을 모으지 않아요.</p><section class="surface"><h2>${pack.label} · ${esc(c.learning?.extras.custom?.title ?? pack.title)}</h2><p>현재 물건: ${esc(current ? (pack.objects[current.id] ?? current.name) : "공간 탐색")}</p><p>진행 시간 ${time(s.elapsedMs)} · 필수 ${s.solvedPuzzleIds.length}/5</p><ol class="progress-stages">${PUZZLES.map((id, i) => `<li>${s.solvedPuzzleIds.includes(id) ? "✓ 완료" : "○ 남음"} · ${FRAGMENTS[i]} · 도움 ${s.hints[id] ?? 0}단계</li>`).join("")}</ol><p>조합판 ${s.finalCombined ? "완성" : "미완성"} · 열쇠 ${s.finalKeyObtained ? "찾음" : "아직"} · 탈출 ${s.exitUsed ? "완료" : "진행 중"}</p><h3>지금 도와줄 부분</h3><p>${esc(diagnose(s, c.learning, c.objectId))}</p></section>${b("활동으로 돌아가기", "continue", "", 'class="primary"')}<p class="muted">학습 지도용 확인이며 학생의 성격이나 인성을 평가하는 자료가 아니에요.</p></main>`;
}
export function offlineSection(c: ViewContext) {
  return `<section class="surface offline-section"><h2>수업 전 오프라인 준비</h2><p>세 에피소드의 그림·글꼴·입체 화면·이야기를 이 브라우저에 준비해요. 처음 준비할 때는 인터넷 연결이 필요해요.</p>${b("필수 파일 준비·확인", "offline-prepare", "", `class="primary" ${c.offlineBusy ? "disabled" : ""}`)}<p id="offline-status" role="status">${esc(c.offlineStatus ?? "아직 이 브라우저의 준비 상태를 확인하지 않았어요.")}</p><p class="muted">브라우저의 저장 공간 정리·시크릿 모드·재설치 뒤에는 다시 준비해요.</p></section>`;
}
export function editor(c: ViewContext) {
  const p =
    c.authorDraft ?? defaultLessonPack(c.lessonDraft?.episode ?? "classroom");
  const field = (name: string, label: string, value: string, max: number) =>
    `<label for="author-${name.replace(":", "-")}">${label}</label><textarea id="author-${name.replace(":", "-")}" data-author="${name}" maxlength="${max}" rows="${name === "intro" ? 3 : 2}">${esc(value)}</textarea>`;
  return `<main id="main" class="narrow advancement-page"><a href="#/teacher">← 수업 안내</a><h1>수업 이야기 편집</h1><p>가상 인물의 이야기만 작성해요. 학생 이름·실제 피해 경험·연락처는 쓰지 않아요. 이 파일을 적용한 활동은 연습 모드예요.</p><p>기호의 연결 순서와 퍼즐 규칙은 그대로예요. 직접 대사는 친구의 요청이 드러나도록 써요.</p><section class="surface author-fields"><label for="author-episode">바탕 이야기</label><select id="author-episode" data-author="episode">${Object.values(
    EPISODES,
  )
    .map(
      (x) =>
        `<option value="${x.id}" ${x.id === p.episode ? "selected" : ""}>${x.label} · ${x.room}</option>`,
    )
    .join(
      "",
    )}</select>${field("title", "이야기 제목 · 40자", p.title, 40)}${field("intro", "시작 이야기 · 300자", p.intro, 300)}${field("speech", "가상 친구의 직접 대사 · 160자", p.speech, 160)}<h2>도움을 줄 문장 · 각 180자</h2>${HINT_KEYS.map((k, i) => field(`hint:${k}`, k === "final" ? "마지막 조합" : `${i + 1}. ${FRAGMENTS[i]}`, p.hints[k], 180)).join("")}<div class="author-actions">${b("수업 파일 저장", "author-export")}${b("이 이야기로 새 게임 준비", "author-apply", "", 'class="primary"')}${b("선택한 이야기 기본 문구", "author-default")}</div><label class="file-label">수업 JSON 파일 불러오기<input id="lesson-pack-file" type="file" accept=".json,application/json"/></label><p role="status">${esc(c.authorStatus ?? "파일은 이 기기에서만 읽고, 자동으로 업로드하지 않아요.")}</p></section></main>`;
}
export function gymTeams(c: ViewContext) {
  const solved = c.state?.solvedPuzzleIds.includes("P4");
  const plans = [
    ["토끼·여우", "곰·다람쥐"],
    ["토끼·곰", "토끼·여우"],
    ["여우·다람쥐", "곰·여우"],
  ];
  return `<div class="device-heading"><h3>네 친구에게 같은 기회</h3><p>두 팀은 두 명씩이에요. 네 친구가 한 번씩 모두 들어간 팀 계획을 골라요.</p></div><div class="team-plan-list">${plans.map((teams, i) => b(`<strong>계획 ${i + 1}</strong><span>초록 팀: ${teams[0]}</span><span>노랑 팀: ${teams[1]}</span>`, "gym-team", String(i), `${solved ? "disabled" : ""} class="team-plan"`)).join("")}</div>${solved ? "<p>✓ 네 친구가 한 번씩, 두 팀에 똑같이 참여해요.</p>" : ""}`;
}
export function customizeHtml(
  html: string,
  custom: LessonPack | null | undefined,
  episodeId: string,
) {
  if (!custom) return html;
  const pack = episode(episodeId),
    originalSpeech = defaultLessonPack(custom.episode).speech;
  return html
    .split(pack.title)
    .join(esc(custom.title))
    .split(originalSpeech)
    .join(esc(custom.speech));
}
export function learningHints(c: ViewContext, id: string) {
  if (c.learning?.options.episode === "gym" && id === "P4")
    return [
      "두 팀의 네 자리를 살펴봐요.",
      "한 친구가 두 번 들어가거나 빠진 친구가 있는지 확인해요.",
      "초록 팀 토끼·여우, 노랑 팀 곰·다람쥐인 계획은 네 친구가 한 번씩 참여해요.",
    ];
  return HINTS[id] ?? [];
}
