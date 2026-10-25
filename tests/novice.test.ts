import { test } from "node:test";
import assert from "node:assert/strict";
import { createExperience } from "../src/game/learning";
import { createProgress, PRACTICE_CONFIG } from "../src/game/model";
import { teamPuzzle, lessonSetup } from "../src/ui/learning";
import { hintTarget } from "../src/ui/experience";
import {
  modalContent,
  setup,
  continueLabel,
  type ViewContext,
} from "../src/ui/views";
import { objectContent } from "../src/ui/panels";

function fixture() {
  const state = createProgress(PRACTICE_CONFIG);
  state.solvedPuzzleIds = ["P1"];
  return {
    state,
    learning: createExperience(),
    roleCard: 0,
    objectId: "O06",
    device: "main",
    modal: "hint",
    bonusHintLevel: 0,
  } as ViewContext;
}
test("continue label identifies the saved episode and keeps unsaved games simple", () => {
  const c = fixture();
  c.saved = true;
  c.warnings = [];
  c.learning!.options.episode = "library";
  const html = continueLabel(c);
  assert.match(html, /EP\.02 · 도서관/);
  c.learning!.options.episode = "classroom";
  assert.match(continueLabel(c), /EP\.01 · 교실/);
  c.saved = false;
  assert.equal(continueLabel(c), "이어하기");
});
test("library help map shows the library but keeps canonical movement values", () => {
  const c = fixture();
  c.learning!.options.episode = "library";
  c.state!.solvedPuzzleIds = ["P1", "P2", "P3", "P4"];
  const html = objectContent(c.state!, "O09", null, [], -1, false, c);
  assert.match(html, /지금 도서관에 있어요/);
  assert.match(html, /<strong>도서관<\/strong>/);
  assert.match(html, /data-action="move" data-value="교실"/);
  c.learning!.options.episode = "classroom";
  assert.match(
    objectContent(c.state!, "O09", null, [], -1, false, c),
    /지금 교실에 있어요/,
  );
});
test("cooperation shows actual rotated seat numbers and withholds the keypad during reading", () => {
  const c = fixture();
  c.learning!.viewedRoles = [0];
  const html = teamPuzzle(c);
  assert.match(html, /2번 친구 · 관찰 단서/);
  assert.match(html, /3번 친구 · 읽기 단서/);
  assert.match(html, /다음: 숫자 단서 읽기/);
  assert.doesNotMatch(html, /data-action="coop-code"/);
  assert.match(html, /<details[^>]+data-disclosure="coop-extras"/);
});
test("cooperation keypad becomes available after both clues and remains available for restored saves", () => {
  const c = fixture();
  c.roleCard = null;
  c.learning!.viewedRoles = [0];
  assert.doesNotMatch(teamPuzzle(c), /data-action="coop-code"/);
  c.learning!.viewedRoles = [0, 1];
  c.learning!.coopCode = "42";
  const html = teamPuzzle(c);
  assert.match(html, /data-action="coop-code"/);
  assert.match(html, /42_/);
  assert.match(html, /1번 조작 친구/);
});
test("optional explanation cards can still be read after the cooperative box is open", () => {
  const c = fixture();
  c.learning!.coopSolved = true;
  c.roleCard = 2;
  assert.match(teamPuzzle(c), /두 친구의 설명을 연결하고/);
  assert.match(teamPuzzle(c), /렌즈 찾으러 가기/);
});
test("a cooperative lock directs help to the missing cooperation step rather than the later lens puzzle", () => {
  const c = fixture();
  assert.equal(hintTarget(c), "cooperation");
  assert.match(modalContent(c), /두 단서 차례로 읽기/);
  c.device = "bonus";
  assert.equal(hintTarget(c), "B2");
  c.device = "main";
  c.learning!.coopSolved = true;
  assert.equal(hintTarget(c), "P2");
});
test("student setup keeps the current lesson visible while teacher choices start collapsed", () => {
  const c = fixture();
  c.lessonDraft = {
    ...c.learning!.options,
    grade: "guided",
    minutes: 15,
    episode: "library",
  };
  const html = lessonSetup(c, true);
  assert.match(html, /수업 설정 바꾸기 · 차근차근 · 15분 · EP.02/);
  assert.match(html, /<details[^>]*data-disclosure="lesson-settings">/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
});

test("compact guest preparation preserves school choice when a registry is present", () => {
  const c: ViewContext = {
    ...fixture(),
    schools: [],
    schoolQuery: "",
    setupSchool: null,
  };
  const guest = setup(c);
  assert.doesNotMatch(guest, /id="school-search"/);
  assert.match(guest, /학교 선택이나 이름 입력 없이 바로 시작/);
  c.schools = [{ schoolId: "KR-E-DEMO", name: "예시초등학교" }];
  c.setupSchool = "KR-E-DEMO";
  const registered = setup(c);
  assert.match(registered, /id="school-search"/);
  assert.match(registered, /학교 선택은 소속 인증이 아니에요/);
  assert.match(registered, /학교 없이 체험/);
  assert.match(registered, /예시초등학교 ✓ 선택됨/);
  assert.match(registered, /data-action="setup-next"/);
});
