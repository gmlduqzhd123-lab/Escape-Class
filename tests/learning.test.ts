import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExperience,
  validateExperience,
  cooperationAnswer,
  checkCooperation,
  roleAssignments,
  assistProgress,
  shouldSuggestHint,
  DEFAULT_LESSON,
  practiceCard,
  isPracticeLesson,
  createHintClock,
  cooperationLegend,
} from "../src/game/learning";
import { adaptEpisodeHtml, EPISODES } from "../src/content/episodes";
import { OBJECTS } from "../src/content/data";
import { rolesDocument } from "../src/ui/learning";
import { createProgress, PRACTICE_CONFIG } from "../src/game/model";
import { inspect, pickMemo, solve } from "../src/game/engine";
import { validateProgress } from "../src/storage/progress";
import {
  createSaveCoordinator,
  writeExperience,
  readExperience,
} from "../src/storage/session";
class MemoryStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
test("hint idle clock excludes dialog, pause and hidden intervals and resets after progress", () => {
  const clock = createHintClock();
  clock.update(0, true);
  clock.update(30000, false);
  assert.equal(clock.idleMs, 30000);
  clock.update(630000, true);
  assert.equal(clock.idleMs, 30000);
  clock.update(660000, true);
  assert.equal(
    shouldSuggestHint(clock.idleMs, 0, { ...DEFAULT_LESSON, grade: "guided" }),
    true,
  );
  clock.reset();
  assert.equal(clock.idleMs, 0);
  clock.update(670000, true);
  assert.equal(clock.idleMs, 10000);
});
test("every episode's printed and on-screen symbol dictionary matches its cooperative answer", () => {
  for (const id of Object.keys(EPISODES) as (keyof typeof EPISODES)[]) {
    for (const grade of ["guided", "standard"] as const) {
      const e = createExperience({ ...DEFAULT_LESSON, episode: id, grade });
      const pack = EPISODES[id];
      assert.equal(
        cooperationAnswer(e),
        pack.coopSequence
          .slice(0, grade === "guided" ? 2 : 3)
          .map((s) => pack.coopDigits[s])
          .join(""),
      );
      for (const entry of cooperationLegend(e).split(" · "))
        assert.ok(rolesDocument(e).includes(entry));
      assert.ok(rolesDocument(e).includes(pack.title));
    }
  }
});
test("cooperative code requires the observation and reading cards, not a guessed number alone", () => {
  const e = createExperience();
  e.coopCode = "426";
  assert.equal(checkCooperation(e), false);
  e.viewedRoles = [0];
  assert.equal(checkCooperation(e), false);
  e.viewedRoles = [0, 1];
  assert.equal(checkCooperation(e), true);
  e.coopSolved = true;
  assert.deepEqual(validateExperience(e), e);
});
test("episode packs and grade change the cooperative sequence without changing core scoring", () => {
  const e = createExperience({ ...DEFAULT_LESSON, episode: "library" });
  assert.equal(cooperationAnswer(e), "642");
  e.options.grade = "guided";
  assert.equal(cooperationAnswer(e), "64");
  assert.equal(isPracticeLesson(e.options), true);
  assert.equal(
    isPracticeLesson({
      ...DEFAULT_LESSON,
      cooperation: false,
      grade: "standard",
      episode: "classroom",
    }),
    false,
  );
});
test("roles rotate at puzzle completion and can be shifted without pupil names", () => {
  const e = createExperience(),
    s = createProgress(PRACTICE_CONFIG);
  assert.equal(roleAssignments(e, s)[3].student, 4);
  s.solvedPuzzleIds = ["P1"];
  assert.equal(roleAssignments(e, s)[3].student, 1);
  e.roleShift = 1;
  assert.equal(roleAssignments(e, s)[3].student, 2);
});
test("guided memo scaffolding preserves direct-speech discovery and the actual puzzle judge", () => {
  const e = createExperience({ ...DEFAULT_LESSON, grade: "guided" }),
    s = createProgress(PRACTICE_CONFIG);
  s.phase = "playing";
  inspect(s, "O02");
  assistProgress(s, e);
  assert.deepEqual(s.puzzles.p1.order, ["P1-C1"]);
  pickMemo(s, "P1-C3");
  assert.equal(s.puzzles.p1.order.includes("P1-C3"), false);
  inspect(s, "O03");
  pickMemo(s, "P1-C3");
  pickMemo(s, "P1-C5");
  assert.equal(solve(s, "P1").ok, true);
  assert.doesNotThrow(() => validateProgress(s));
});
test("hint proposals respect teacher choice, idle threshold and repeated mistakes", () => {
  assert.equal(shouldSuggestHint(89999, 0, DEFAULT_LESSON), false);
  assert.equal(shouldSuggestHint(90000, 0, DEFAULT_LESSON), true);
  assert.equal(shouldSuggestHint(0, 3, DEFAULT_LESSON), true);
  assert.equal(
    shouldSuggestHint(999999, 9, { ...DEFAULT_LESSON, hints: "request" }),
    false,
  );
  assert.equal(
    shouldSuggestHint(60000, 0, { ...DEFAULT_LESSON, grade: "guided" }),
    true,
  );
});
test("experience validation rejects forged cooperation, unknown items and unsafe camera pose", () => {
  const e = createExperience();
  for (const mutation of [
    (v: typeof e) => (v.coopSolved = true),
    (v: typeof e) => (v.view.selected = "unknown"),
    (v: typeof e) => (v.view.pose = { stop: "outside", yaw: 0, pitch: 0 }),
    (v: typeof e) =>
      (v.view.pose = { stop: "center", yaw: Infinity, pitch: 0 }),
  ]) {
    const copy = structuredClone(e);
    mutation(copy);
    assert.throws(() => validateExperience(copy));
  }
});
test("old progress stays canonical while a matching sidecar restores lesson and inspection", () => {
  const storage = new MemoryStore(),
    key = "game",
    s = createProgress(PRACTICE_CONFIG),
    e = createExperience();
  e.view.objectId = "O02";
  e.view.panelScroll = 487;
  e.view.pose = { stop: "door", yaw: 0.3, pitch: -0.1 };
  storage.setItem(key, JSON.stringify(s));
  writeExperience(storage, key, e);
  assert.deepEqual(readExperience(storage, key), e);
  assert.doesNotThrow(() =>
    validateProgress(JSON.parse(storage.getItem(key)!)),
  );
  storage.setItem(key, JSON.stringify({ ...s, elapsedMs: 100 }));
  assert.equal(readExperience(storage, key), null);
});
test("legacy or malformed scroll offsets never discard valid puzzle context", () => {
  const e = createExperience();
  e.view.objectId = "O06";
  e.view.device = "bonus";
  e.view.panelScroll = 320;
  assert.equal(validateExperience(e).view.panelScroll, 320);
  for (const offset of [undefined, -1, Infinity, NaN, 100001, "320"]) {
    const input = structuredClone(e) as any;
    if (offset === undefined) delete input.view.panelScroll;
    else input.view.panelScroll = offset;
    const restored = validateExperience(input);
    assert.equal(restored.view.panelScroll, 0);
    assert.equal(restored.view.objectId, "O06");
    assert.equal(restored.view.device, "bonus");
  }
});
test("external legacy writes block this writer before it can overwrite a newer save", async () => {
  const storage = new MemoryStore();
  storage.setItem("game", "first");
  let conflicts = 0;
  const c = createSaveCoordinator(storage, "game", () => conflicts++);
  await c.acquire();
  assert.equal(c.writable(), true);
  storage.setItem("game", "newer from another tab");
  assert.equal(c.writable(), false);
  assert.equal(conflicts, 1);
  assert.equal(storage.getItem("game"), "newer from another tab");
  assert.equal(await c.acquire(), true);
  assert.equal(c.writable(), true);
});
test("browser lock permits one writer, then permits handoff after that tab closes", async () => {
  const held = new Set<string>();
  const locks = {
    async request(
      name: string,
      _options: unknown,
      callback: (lock: unknown) => Promise<void> | void,
    ) {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };
  const storage = new MemoryStore(),
    a = createSaveCoordinator(storage, "game", () => {}, locks),
    b = createSaveCoordinator(storage, "game", () => {}, locks);
  assert.equal(await a.acquire(), true);
  assert.equal(await b.acquire(), false);
  assert.equal(b.writable(), false);
  a.release();
  await new Promise(setImmediate);
  assert.equal(await b.acquire(), true);
  b.release();
});
test("blocked storage remains a playable no-save mode rather than throwing at startup", async () => {
  const bad = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  const c = createSaveCoordinator(bad, "game", () => {});
  assert.equal(await c.acquire(), true);
  assert.equal(c.writable(), true);
});
test("library rendering preserves object IDs/actions and changes authored story and names", () => {
  const html =
    '<button data-action="inspect" data-value="O02">게시판</button><h1>사라진 우정 열쇠</h1><p>함께 만들고 싶어. 만드는 방법을 먼저 알려 주면 좋겠어.</p>';
  const changed = adaptEpisodeHtml(html, "library", OBJECTS);
  assert.match(changed, /독서 게시판/);
  assert.match(changed, /함께 읽고/);
  assert.match(changed, /data-value="O02"/);
  assert.match(changed, /data-action="inspect"/);
  assert.equal(Object.keys(EPISODES.library.objects).length, 12);
  assert.equal(
    adaptEpisodeHtml(
      "가상 교실 방탈출이에요. 우정 조각 다섯 개를 모아요.",
      "library",
      OBJECTS,
    ),
    "가상 도서관 방탈출이에요. 책갈피 조각 다섯 개를 모아요.",
  );
  assert.equal(
    adaptEpisodeHtml(
      "바구니 옆에서 우정 조각 · 그림 책상 암호판 · ← 교실로",
      "library",
      OBJECTS,
    ),
    "반납함 옆에서 책갈피 조각 · 독서대 암호판 · ← 도서관으로",
  );
});
test("pledge export contains the chosen practice and no names, scores or script", () => {
  const e = createExperience();
  e.pledge = 2;
  const html = practiceCard(e);
  assert.match(html, /함께하고 싶은 친구에게 자리를 나눌게요/);
  assert.doesNotMatch(html, /schoolId|roundId|100점|<script/);
});
