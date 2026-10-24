import { renderPlay, hintTarget, objective } from "./experience";
import { lessonSetup, teamSummary, teamPuzzle, pledgeView } from "./learning";
import type { DeviceAudit } from "./learning";
import type { Experience, LessonOptions } from "../game/learning";
import {
  score,
  PUZZLES,
  type Progress,
  type GameConfig,
  type School,
  type ItemId,
} from "../game/model";
import { OBJECTS, FRAGMENTS, REFLECTIONS, HINTS, CLUES } from "../content/data";
import { rankedRows, type RankingFile } from "../ranking/validation";
import { exportReason } from "../ranking/service";
import type { AggregateState } from "../tools/aggregate";
import { button as b, esc, icon, animal, room, time } from "./helpers";
export interface ViewContext {
  learning?: Experience | null;
  lessonDraft?: LessonOptions;
  roleCard?: number | null;
  hintSuggested?: boolean;
  deviceAudit?: DeviceAudit;
  sceneMode: "3d" | "2d";
  sceneFailed: boolean;
  immersive: boolean;
  held: string | null;
  device: "main" | "bonus";
  bonusHintLevel: number;
  reward: { title: string; text: string; next: string } | null;
  state: Progress | null;
  config: GameConfig | null;
  schools: School[];
  ranking: RankingFile | null;
  warnings: string[];
  saved: boolean;
  storageWarning: boolean;
  objectId: string | null;
  selected: ItemId | null;
  modal: string | null;
  schoolQuery: string;
  setupSchool: string | null;
  setupSound: boolean;
  setupReduced: boolean;
  ballPath: number[];
  ballIndex: number;
  running: boolean;
  reflection: number | null;
  aggregate: AggregateState;
  importErrors: string[];
  importBusy: boolean;
  toast: string;
  loading: boolean;
  loadError: boolean;
}
export function header(c: ViewContext) {
  return `<header class="site-header"><a class="brand" href="#/" aria-label="교실 탈출 시작 화면">${icon("key", 30)}<span>교실 탈출<small>함께 풀면, 문이 열려요</small></span></a><nav aria-label="주 메뉴"><a href="#/teacher">수업 안내</a><a href="#/rankings">공식 학교 순위 ${icon("arrow", 18)}</a></nav><div class="ys-key"><button type="button" class="ys-chip" data-ys-install>📲 <span class="ys-wide">앱 </span>설치</button><button type="button" class="ys-chip" data-qr aria-label="QR 코드로 접속">📱 QR</button></div></header>`;
}
export function footer() {
  return `<footer class="site-footer"><span>교실 탈출 · 친구사랑 협동 챌린지</span><a href="#/teacher">개인정보·저장 안내</a><a href="#/tools/results">결과 파일 집계</a><p class="ys-credit">© 2026 엽쌤. All rights reserved. · <a href="https://gmlduqzhd123-lab.github.io/YScode/" target="_blank" rel="noopener">엽쌤의 다른 앱 보기 →</a></p></footer>`;
}
export function home(c: ViewContext) {
  return `<main id="main" class="home"><div class="hero-copy"><span class="pill">친구사랑 협동 방탈출 · EP.01</span><p class="eyebrow hero-overline">작은 배려가 모여, 하나의 열쇠로</p><h1>교실 <span>탈출</span><i class="title-spark">✦</i></h1><h2>사라진 우정 열쇠</h2><p class="hero-description">친구의 이야기에 귀 기울이고,<br>우리의 단서를 모아 교실의 문을 열어요.</p><div class="hero-actions">${b(`새 게임 ${icon("arrow")}`, "new", "", 'class="primary large"')}${b("이어하기", "continue", "", `class="large" ${c.saved ? "" : "disabled"}`)}</div><div class="hero-meta"><span>${icon("clock", 19)} 20~25분</span><span>초등 3~6학년</span><span>모둠당 기기 한 대</span></div></div><div class="hero-art"><div class="art-label"><span class="live-dot"></span>FRIENDSHIP CLASSROOM <small>01</small></div>${room()}<div class="hero-note"><span>오늘의 미션</span><strong>우정 조각 다섯 개를 찾아라!</strong>${icon("key", 34)}</div><div class="character-row">${["토끼", "곰", "여우", "다람쥐"].map((n) => `<span>${animal(n, 57)}</span>`).join("")}<p>우리가 함께<br><strong>도와줄게!</strong></p></div></div><section class="mission-strip"><div><span>01</span><strong>꼼꼼히 살펴보고</strong><p>교실 속 물건에서 단서를 찾아요.</p></div><div><span>02</span><strong>생각을 함께 나누고</strong><p>서로 다른 단서를 연결해 봐요.</p></div><div><span>03</span><strong>다 같이 문을 열어요</strong><p>한 명의 정답보다 우리의 협력이에요.</p></div></section>${c.warnings.length ? `<div class="data-notice">${c.warnings.map((x) => `<p>${esc(x)}</p>`).join("")}${b("정적 데이터 다시 읽기", "reload-data")}</div>` : ""}<p class="privacy-inline">학생 이름이나 개인정보를 입력하지 않아요. 현재 ${c.config?.activeRound?.acceptingResults ? "공식 회차가 열려 있어요." : "연습 모드로 자유롭게 참여할 수 있어요."}</p></main>`;
}
export function setup(c: ViewContext) {
  const matches = c.schools.filter(
    (s) => s.name.includes(c.schoolQuery) || s.schoolId.includes(c.schoolQuery),
  );
  return `<main id="main" class="narrow"><a class="back-link" href="#/">← 시작 화면</a><span class="eyebrow">시작하기 전에 · 1 / 2</span><h1>우리 모둠, 준비됐나요?</h1><p>학교 선택은 소속 인증이 아니에요. 학교 없이도 모든 퍼즐을 풀 수 있어요.</p><div class="surface">${c.schools.length ? `<h2>활동 학교 선택</h2><label for="school-search">등록 학교 검색</label><input id="school-search" data-input="school-query" value="${esc(c.schoolQuery)}" placeholder="등록된 학교 이름 찾기" autocomplete="off" /><div id="school-options" class="school-options">${schoolOptions(c, matches)}</div><p class="notice">${c.config?.activeRound?.acceptingResults ? esc(c.config.activeRound.label) + " · 결과 접수 중" : "연습 모드로 시작해요."}</p>` : `<h2>바로 시작할 수 있어요</h2><p>학교 선택이나 이름 입력 없이 모든 퍼즐을 즐길 수 있어요.</p>`}</div><div class="surface"><h2>편안하게 활동해요</h2><label class="check-label"><input type="checkbox" data-setting="setup-sound" ${c.setupSound ? "checked" : ""} /> 효과음 켜기 (기본 끄기)</label><label class="check-label"><input type="checkbox" data-setting="setup-reduced" ${c.setupReduced ? "checked" : ""} /> 움직임 줄이기</label><p>이야기와 모든 단서는 소리 없이도 읽을 수 있어요.</p></div>${lessonSetup(c)}${b("이야기와 조작 안내 보기 →", "setup-next", "", 'class="primary large"')}</main>`;
}
export function schoolOptions(
  c: ViewContext,
  matches: School[] = c.schools.filter(
    (s) => s.name.includes(c.schoolQuery) || s.schoolId.includes(c.schoolQuery),
  ),
) {
  return `${b(`학교 없이 체험 ${c.setupSchool === null ? "✓ 선택됨" : ""}`, "choose-school", "", `aria-pressed="${c.setupSchool === null}"`)}${matches.map((s) => b(`${esc(s.name)} ${c.setupSchool === s.schoolId ? "✓ 선택됨" : ""}`, "choose-school", s.schoolId, `aria-pressed="${c.setupSchool === s.schoolId}"`)).join("")}${!c.schools.length ? '<p class="muted">아직 등록된 학교가 없어요. 학교 없이 체험을 선택해 주세요.</p>' : !matches.length ? "<p>검색 결과가 없어요.</p>" : ""}`;
}
export function intro(c: ViewContext) {
  return `<main id="main" class="narrow"><span class="eyebrow">모험의 시작 · 2 / 2</span><h1>우정 열쇠가 사라졌어요!</h1><div class="story-characters">${["토끼", "곰", "여우", "다람쥐"].map((n) => animal(n, 80)).join("")}</div><div class="surface"><p>친구사랑 축제의 마지막 활동은 가상 교실 방탈출 챌린지!</p><p>교실의 장치를 풀면 다섯 개의 우정 조각을 얻을 수 있어요. 조각을 연결해 마지막 열쇠가 숨겨진 곳을 찾아요.</p><p><strong>진짜 교실 문은 잠그지 않아요.</strong> 언제든 쉬거나 어른에게 도움을 요청할 수 있어요.</p></div><div class="instructions"><div>${icon("note", 32)}<h2>둘러보기</h2><p>좌우 버튼으로 교실을 둘러봐요. 화면을 밀어도 좋아요.</p></div><div>${icon("bag", 32)}<h2>이동하기</h2><p>바닥 표시를 누르면 그곳으로 이동해요. 가운데로 언제든 돌아와요.</p></div><div>${icon("hint", 32)}<h2>살펴보기</h2><p>물건이나 이름을 눌러 살펴봐요. 못 찾겠으면 ‘다음’ 표시나 위쪽 ‘살펴보기’를 눌러요.</p></div></div><p>타이머는 아직 멈춰 있어요. 화면 줄이기 버튼으로 언제든 전체화면을 나갈 수 있어요. 역할을 돌아가며 맡아 봐요: 관찰하기 · 단서 읽기 · 이유 설명하기 · 기기 조작하기.</p>${b("전체화면으로 게임 시작 →", "start", "", 'class="primary large"')}</main>`;
}
export function play(c: ViewContext) {
  return renderPlay(c);
}
export function result(c: ViewContext) {
  const s = c.state!,
    reason = exportReason(s, c.config, c.schools);
  return `<main id="main" class="narrow result-main"><div class="result-header"><span class="pill">EP.01 · 모둠 활동 완료</span><div class="celebration">${icon("key", 76)}</div><h1>함께 열었어요!</h1><p>잘 듣고, 존중하고, 도우며 찾은 우리의 열쇠.</p><div class="final-score"><strong>${s.frozenScore}</strong><span> / 100점 · 확정 점수</span></div><p class="muted">점수는 퍼즐 해결 기록이며 학생 인성이나 학교폭력 수준을 평가하지 않아요.</p></div><div class="surface result-record"><h2>우리 모둠의 탐색 기록</h2><dl><div><dt>필수 퍼즐</dt><dd>${s.solvedPuzzleIds.map((id) => FRAGMENTS[PUZZLES.indexOf(id)]).join(" · ")} · ${s.solvedPuzzleIds.length * 16}점</dd></div><div><dt>추가 단서</dt><dd>${s.foundBonusIds.map((id) => ({ B1: "책장 그림", B2: "도구함 라벨", B3: "초대장", B4: "기호 잠금장치" })[id]).join(" · ") || "발견한 추가 단서 없음"} · ${s.foundBonusIds.length * 5}점</dd></div><div><dt>기기 내 활동 시간</dt><dd>${time(s.elapsedMs)} (순위에 영향 없음)</dd></div><div><dt>활동 학교</dt><dd>${esc(c.schools.find((x) => x.schoolId === s.schoolId)?.name ?? "학교 없이 체험")}</dd></div><div><dt>시작한 회차</dt><dd>${esc(s.roundId ?? "연습 모드")}</dd></div></dl></div><section class="surface reflection"><span class="eyebrow">함께 되돌아보기</span><h2>내가 해 보고 싶은 작은 실천</h2><p>한 문장을 골라 모둠에서 나눠 봐요. 실제 피해 경험을 이야기하거나 사과·용서할 필요는 없어요.</p><div class="reflection-choices">${REFLECTIONS.map((text, i) => b(`${c.reflection === i ? "✓ " : ""}${text}`, "reflect", String(i), `aria-pressed="${c.reflection === i}"`)).join("")}</div><p class="muted">성찰 선택은 이 화면에서만 사용해요. 결과 파일·공식 순위·개인 평가에 포함하지 않아요.</p></section>${pledgeView(c)}<section class="surface no-print"><h2>활동 결과 보관하기</h2><p>공식 순위는 운영자가 파일을 확인해 게시한 기록이에요. 이 기기의 점수가 자동으로 등록되지는 않아요.</p>${reason ? `<p class="notice">${esc(reason)}</p>` : ""}${b("공식 결과 파일 다운로드", "export", "", `class="primary" ${reason ? "disabled" : ""}`)}${b("현재 설정 다시 확인", "refresh-config")}${b("활동 기록 인쇄", "print")}<p>다운로드 파일에는 개인 정보, 활동 시각, 기기 ID, 성찰 선택, 힌트 이력을 넣지 않아요.</p></section><div class="no-print">${b("시작 화면으로", "home")}${b("새 게임", "new")}</div></main>`;
}
export function rankings(c: ViewContext) {
  const r = c.ranking,
    rows = r ? rankedRows(r, c.schools) : [];
  const current = c.config?.activeRound;
  const same = Boolean(current && r?.roundId === current.roundId);
  return `<main id="main" class="narrow wide"><a class="back-link" href="#/">← 시작 화면</a><span class="eyebrow">운영자가 확인한 게시본</span><h1>공식 학교 순위</h1><p>기기 안의 연습 점수와 별개예요. 힌트 사용과 활동 시간은 공동 순위에 영향을 주지 않아요.</p><div class="surface"><div class="ranking-heading"><span class="pill">${esc(same ? current!.label : (r?.roundId ?? "공식 회차 없음"))}</span><span>${same ? (current!.acceptingResults ? "결과 접수 중" : "회차 종료") : r?.roundId ? "지난 회차 · 종료" : "연습 모드"}</span></div><p class="muted">게시본 갱신일: ${r?.updatedAt ? esc(new Date(r.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })) : "아직 게시되지 않았어요"}</p>${rows.length ? `<div class="table-wrap"><table><caption>학교별 공식 결과 · 점수가 같으면 공동 순위</caption><thead><tr><th scope="col">공동 순위</th><th scope="col">학교</th><th scope="col">점수</th><th scope="col">추가 단서</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.rank}위</td><th scope="row">${esc(x.name)}</th><td><strong>${x.score}</strong>점</td><td>${x.bonusCount}/4</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">${icon("star", 52)}<h2>${r ? "아직 공식 기록이 없어요" : "공식 기록을 읽지 못했어요"}</h2><p>${r ? "새로운 우정의 기록을 기다리고 있어요." : "학교·순위 데이터의 연결을 확인하고 다시 읽어 주세요. 체험 게임은 계속할 수 있어요."}</p>${b("학교 없이 체험하기", "new", "", 'class="primary"')}</div>`}${b("정적 데이터 다시 읽기", "reload-data")}</div><p>점수는 학교의 학생 인성이나 학교폭력 발생 수준을 나타내지 않아요.</p></main>`;
}
export function teacher(c?: ViewContext) {
  return `<main id="main" class="narrow"><a class="back-link" href="#/">← 시작 화면</a><span class="eyebrow">교사용 안내 · 초등 3~6학년</span><h1>서로의 생각이 열쇠가 되는 40분</h1><p>모둠별 태블릿 또는 PC 한 대로 진행해요. 한 번의 게임은 약 20~25분이지만, 시간이 지나도 실패하지 않아요.</p><section class="surface"><h2>40분 수업 운영</h2><ol class="lesson-timeline"><li><strong>도입 · 5분</strong><p>“친구를 존중하는 행동은 무엇일까?” 이야기하고 가상 교실 활동임을 안내해요.</p></li><li><strong>게임 · 25분</strong><p>조사 → 단서 읽기 → 이유 나누기 → 조작을 함께 해요. 힌트는 세 단계로 제공되며 감점이 없어요.</p></li><li><strong>되돌아보기 · 5분</strong><p>실천 문장을 하나 고르고 가상 상황에서 어떤 선택을 했는지 나눠요.</p></li><li><strong>정리 · 5분</strong><p>다음에 해 볼 작은 실천을 정하고, 필요하면 이 앱의 활동 기록을 지워요.</p></li></ol></section><section class="surface"><h2>돌아가며 맡는 네 가지 역할</h2><div class="role-cards">${["관찰하기", "단서 읽기", "이유 설명하기", "기기 조작하기"].map((x, i) => `<div><span>0${i + 1}</span><strong>${x}</strong></div>`).join("")}</div><p>학생 이름을 역할에 연결하거나 저장하지 않아요. 한 퍼즐을 풀 때마다 역할을 바꿔 보세요.</p></section><section class="surface"><h2>편안하게 참여하는 약속</h2><p>실제 문은 잠그지 않아요. 실제 피해 경험이나 실제 친구 관계를 발표하도록 요구하지 않아요. 사과·용서·특정 친구와 친해지기는 완료 조건이 아니에요.</p><p>사진 전달을 멈춰도 이미 전달된 사진이 자동 삭제되지는 않는다는 점을 연결망 장치에서 이야기해 주세요. 도움이 필요할 때 연락할 수 있는 학교의 실제 지원 경로는 교사가 따로 안내해 주세요.</p><p>게임 점수는 퍼즐 해결 기록입니다. 학생의 인성이나 학교폭력 발생 수준을 비교·평가하는 데 사용하지 마세요.</p></section><section class="surface"><h2>공식 도전과 학교 결과</h2><p>공식 도전 전에 <strong>학교 대표 모둠을 정하고 그 모둠의 완료 결과 한 건</strong>을 제출하는 방식으로 운영해요. 학생 수·접속 수·재도전 수를 점수로 사용하지 않아요.</p><p>학교 선택은 소속 인증이 아니며, 파일 형식 검사는 실제 플레이를 증명하지 않아요. 운영자가 대표 모둠·회차·결과를 확인한 뒤 학교별 한 건만 게시해요. 같은 점수는 공동 순위예요.</p><p>현재 회차가 없으면 연습 모드예요. 공식 내보내기는 등록 학교, 탈출 완료, 접수 중인 회차, 시작할 때 고정한 버전과 회차 일치를 모두 확인해요.</p></section><section class="surface"><h2>저장 범위와 개인정보</h2><p>앱은 학생 이름·닉네임·학년반·번호·연락처·사진·음성·실제 피해 사연을 입력받거나 전송하지 않아요. 카메라·마이크·위치·연락처 권한이나 로그인은 필요하지 않아요. 광고·분석·추적 스크립트를 사용하지 않아요.</p><p>진행과 설정은 현재 기기와 브라우저에만 저장돼요. 다른 기기와 자동 동기화되지 않아요. 저장이 차단되어도 현재 활동은 계속할 수 있어요. 이어하기는 일시정지 상태에서 시작해요.</p><p>GitHub Pages 등 호스팅 제공자는 자체 정책에 따라 접속 기록을 남길 수 있어요. 앱이 그 기록까지 없다고 보장하지는 않아요.</p><p>공식 결과 파일은 로컬로 다운로드하며 자동 전송하지 않아요. 교사가 정한 경로로 운영자에게 전달해요. 성찰 선택은 파일이나 순위에 넣지 않아요.</p>${b("이 앱의 활동 지우기", "erase-confirm")}</section><section class="surface"><h2>조작과 접근성</h2><p>물건 목록으로 모든 장치에 접근할 수 있어요. Tab·Shift+Tab으로 이동하고 Enter·Space로 버튼을 눌러요. Escape로 조사 패널과 대화상자를 닫아요. 드래그나 소리는 필요하지 않아요.</p><p>일시정지, 다른 탭, 안내·결과 화면에서는 활동 시간이 멈춰요. 움직임 줄이기는 설정에서 바꿀 수 있어요.</p></section>${c ? lessonSetup(c) : ""}<section class="surface"><h2>기기와 역할 카드 준비</h2><a href="#/device-check">실제 휴대폰·태블릿 점검 열기 →</a><p>이 화면에서 정한 수업 설정은 다음 새 게임에 적용돼요.</p>${b("모둠 역할 카드 인쇄", "print-roles")}${b("새 게임 준비", "new")}</section></main>`;
}
export function toolsView(c: ViewContext) {
  const enabled = Boolean(c.config?.activeRound?.acceptingResults);
  return `<main id="main" class="narrow wide"><a class="back-link" href="#/">← 시작 화면</a><span class="eyebrow">운영자용 · 로컬에서만 처리</span><h1>결과 파일 집계</h1><p>운영자가 확인한 학교별 결과를 합쳐 새 공개 순위 파일을 만들어요. 원격 쓰기나 자동 업로드는 없어요.</p><div class="surface"><h2>1. JSON 파일 선택</h2><p>완료 결과 파일 또는 현재 회차의 기존 순위 파일을 선택해요. 한 번에 최대 100개, 파일마다 100KB 이하예요.</p>${!enabled ? '<p class="notice">현재 유효한 설정과 접수 중인 공식 회차가 없어 집계와 순위 생성이 비활성화되어 있어요.</p>' : `<p class="pill">${esc(c.config!.activeRound!.label)} · ${esc(c.config!.activeRound!.roundId)}</p>`}<label class="file-label" for="result-files">로컬 JSON 파일 선택</label><input id="result-files" type="file" accept=".json,application/json" multiple ${enabled && !c.importBusy ? "" : "disabled"} />${b("현재 설정 다시 확인", "refresh-config")}${b("집계 내용 초기화", "reset-import")}<p class="muted">파일 형식 검사는 실제 플레이를 증명하지 않아요. 대표 모둠과 결과를 따로 확인해 주세요. 지난 회차 자료를 현재 회차로 바꾸지 않아요.</p></div><div class="surface"><h2>2. 검증 결과와 충돌 처리</h2>${c.importBusy ? '<p role="status">파일을 읽고 검증하는 중이에요…</p>' : ""}<ul class="error-list" role="status">${c.importErrors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><ul class="import-messages">${c.aggregate.messages
    .slice(-100)
    .map((x) => `<li>${esc(x)}</li>`)
    .join(
      "",
    )}</ul>${c.aggregate.records.length ? `<p>서로 다른 학교 ${c.aggregate.records.length}곳의 결과가 있어요.</p>` : '<p class="muted">선택한 파일이 없어요. 예시 학교와 기록은 자동으로 만들지 않아요.</p>'}${c.aggregate.conflicts.map((x, i) => `<article class="conflict"><h3>${esc(c.schools.find((s) => s.schoolId === x.schoolId)?.name ?? x.schoolId)} · 결과 충돌</h3><p>${esc(x.name)} · 기존 ${x.existing.score}점 / 새 결과 ${x.incoming.score}점</p>${b(`기존 유지 ${x.choice === "keep" ? "✓" : ""}`, "conflict", `${i}:keep`, `aria-pressed="${x.choice === "keep"}"`)}${b(`새 결과 교체 ${x.choice === "replace" ? "✓" : ""}`, "conflict", `${i}:replace`, `aria-pressed="${x.choice === "replace"}"`)}</article>`).join("")}</div><div class="surface"><h2>3. 새 순위 파일 다운로드</h2><p>학교 ID·점수·추가 단서 수·탈출 완료만 포함해요. 갱신일은 게시본 생성 시각이에요.</p>${b("rankings.json 다운로드", "aggregate-download", "", `class="primary" ${enabled && !c.importBusy && !c.aggregate.conflicts.some((x) => x.choice === null) ? "" : "disabled"}`)}<p>다운로드한 파일을 운영자가 저장소의 <code>public/data/rankings.json</code>에 반영하고 정적 Pages 배포 절차를 진행해요. 이 화면에는 GitHub 쓰기 기능이 없어요.</p></div></main>`;
}
export function modalContent(c: ViewContext) {
  const s = c.state;
  switch (c.modal) {
    case "save-blocked":
      return `<h2 id="dialog-title">진행 기록을 보호하고 있어요</h2><p>다른 탭에서 이 게임을 진행 중이거나 저장 기록이 바뀌었어요. 이 탭에서는 덮어쓰지 않아요.</p><p>진행 중인 다른 탭을 닫은 뒤 다시 확인해 주세요.</p>${b("다른 탭을 닫았어요 · 다시 확인", "save-retry", "", 'class="primary"')}${b("시작 화면으로", "home")}`;
    case "team-puzzle":
      return c.learning ? teamPuzzle(c) : "";
    case "team":
      return `<h2 id="dialog-title">우리 모둠의 역할</h2>${teamSummary(c)}`;
    case "rotate":
      return `<div class="rotate-phone-art" aria-hidden="true"><span>▯</span><b>↷</b><span>▭</span></div><h2 id="dialog-title">휴대폰을 가로로 돌려 주세요</h2><p>가로로 돌리면 교실이 더 넓게 보이고 버튼을 누르기 편해요. 돌리면 이 안내는 저절로 닫혀요.</p><p class="muted">화면이 그대로라면 휴대폰의 화면 회전 잠금을 확인해요.</p>${b("세로로 계속하기", "close-modal", "", 'class="portrait-continue"')}`;
    case "reward":
      return `<h2 id="dialog-title">${esc(c.reward?.title)}</h2><div class="reward-piece">${icon("key", 70)}</div><p>${esc(c.reward?.text)}</p>${b(`${OBJECTS.find((o) => o.id === c.reward?.next)?.name ?? "다음 단서"} 살펴보기 →`, "follow-clue", c.reward?.next ?? "", 'class="primary"')}${b("교실로 돌아가기", "reward-room")}`;
    case "objects": {
      const target = s ? objective(s)[1] : null;
      const ordered = [
        ...OBJECTS.filter((o) => o.id === target),
        ...OBJECTS.filter((o) => o.id !== target),
      ];
      return `<h2 id="dialog-title">교실 물건 목록</h2><p>이름을 누르면 가까이 가서 살펴봐요. ‘다음’ 표시부터 찾아보세요.</p><div class="object-picker">${ordered
        .map((o) => {
          const next = o.id === target;
          const visited = s?.discoveredClueIds.includes(o.id);
          return b(
            `<span>${o.name}</span><small>${next ? "<strong>다음</strong> · " : visited ? "살펴봄 · " : ""}${visited ? "다시 보기" : "살펴보기"} →</small>`,
            "inspect",
            o.id,
            `class="${next ? "next-object" : ""}" aria-label="${o.name}${next ? " · 다음 물건" : ""} · ${visited ? "다시 살펴보기" : "살펴보기"}"`,
          );
        })
        .join("")}</div>`;
    }
    case "bag":
      return `<h2 id="dialog-title">가방</h2><p>아래 아이템 칸에서 도구를 선택하고 사용할 물건을 눌러요.</p>${!s?.inventory.length ? "<p>아직 아이템이 없어요. 사물함이나 공용 도구함을 살펴봐요.</p>" : s.inventory.map((id) => b(`${icon(id === "final-key" ? "key" : "bag")} ${id === "final-key" ? "마지막 열쇠" : id === "shared-lens" ? "공용 렌즈" : "허락받은 렌즈"} ${c.selected === id ? "✓ 선택됨" : ""}`, "select-item", id, 'class="bag-item"')).join("")}`;
    case "notes":
      return `<h2 id="dialog-title">단서 노트</h2>${teamSummary(c)}<p>조사한 내용은 패널을 닫아도 남아 있어요.</p>${
        CLUES.filter((x) => s?.discoveredClueIds.includes(x.id))
          .map(
            (x) =>
              `<article class="note-entry"><strong>${esc(x.short)}</strong><p>${esc(x.text)}</p><small>뒷면: ${esc(x.back)}</small></article>`,
          )
          .join("") || "<p>아직 발견한 메모 카드가 없어요.</p>"
      }<h3>조사한 물건</h3><ul>${OBJECTS.filter((o) =>
        s?.discoveredClueIds.includes(o.id),
      )
        .map((o) => `<li><strong>${o.name}</strong> · ${o.description}</li>`)
        .join("")}</ul>`;
    case "hint": {
      if (!s) return "";
      const id = hintTarget(c);
      const level = s.hints[id] ?? c.bonusHintLevel;
      return `<h2 id="dialog-title">${({ P1: "반쪽 메모", P2: "투명 렌즈", P3: "우정 공", P4: "도움 연결망", P5: "도움 지도", final: "마지막 조합", B1: "책장 그림", B2: "도구함 라벨", B3: "초대장", B4: "기호 잠금장치" } as Record<string, string>)[id]} 힌트</h2><p>힌트 사용은 점수와 순위에 영향을 주지 않아요.</p>${HINTS[
        id
      ]
        .slice(0, level)
        .map(
          (text, i) =>
            `<article class="hint-step"><strong>${i + 1}단계 · ${["살펴볼 위치", "연결 원리", "실제 해결 방법"][i]}</strong><p>${esc(text)}</p></article>`,
        )
        .join(
          "",
        )}${level < 3 ? b(`${level + 1}단계 힌트 보기`, "next-hint", id, 'class="primary"') : "<p>세 단계 힌트를 모두 확인했어요.</p>"}`;
    }
    case "pause":
      return `<h2 id="dialog-title">잠깐, 쉬어 가요</h2><p>진행은 그대로예요. 활동 시간도 멈춰 있어요.</p>${b("탐색 계속하기", "resume", "", 'class="primary"')}${b("저장하고 시작 화면으로", "save-home")}`;
    case "settings":
      return `<h2 id="dialog-title">활동 설정</h2><label class="check-label"><input type="checkbox" data-setting="sound" ${s?.settings.sound ? "checked" : ""} /> 효과음 켜기</label><label class="check-label"><input type="checkbox" data-setting="reduced" ${s?.settings.reducedMotion ? "checked" : ""} /> 움직임 줄이기</label><p>소리 없이도 모든 단서를 확인할 수 있어요. 움직임 줄이기를 켜면 교실 이동이 바로 전환돼요.</p>`;
    case "exit-confirm":
      return `<h2 id="dialog-title">우정 조각을 모두 모았어요!</h2><p>문을 열면 탈출 성공이에요. ${s ? score(s) : 0}점으로 완료해요.</p><p>추가 단서는 선택 활동이에요.${s?.foundBonusIds.length === 4 ? " 모두 찾았어요!" : ` 남은 ${4 - (s?.foundBonusIds.length ?? 0)}개를 풀지 않아도 성공이에요.`}</p>${b("문 열고 탈출하기 →", "escape-confirm", "", 'class="primary"')}${b("추가 단서 더 찾아보기", "close-modal")}`;
    case "erase":
      return `<h2 id="dialog-title">이 앱의 활동을 지울까요?</h2><p>현재 배포 경로에 저장한 진행과 설정만 지워요. 다른 앱의 저장은 지우지 않아요.</p>${b("취소", "close-modal")}${b("활동 지우기", "erase", "", 'class="danger"')}`;
    case "new-confirm":
      return `<h2 id="dialog-title">새 게임을 시작할까요?</h2><p>새 활동을 시작하면 이 브라우저에 저장된 이전 진행을 덮어써요.</p>${b("취소", "close-modal")}${b("새 게임 준비하기", "new-confirmed", "", 'class="primary"')}`;
    default:
      return "";
  }
}
