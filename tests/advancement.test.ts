import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExperience,
  validateExperience,
  isPracticeLesson,
  cooperationAnswer,
  cooperationLegend,
  practiceCard,
} from "../src/game/learning";
import { rolesDocument, lessonMaterialsDocument } from "../src/ui/learning";
import {
  defaultLessonPack,
  validateLessonPack,
  parseLessonPack,
  digit,
  inputDigit,
  displayCode,
  orderCards,
  diagnose,
  mapLocation,
} from "../src/game/advancement";
import { createProgress, PRACTICE_CONFIG } from "../src/game/model";
import { judgeP2 } from "../src/puzzles/judges";
import {
  tutorial,
  spaceMap,
  friendTalk,
  teacherProgress,
  customizeHtml,
  gymTeams,
  learningHints,
} from "../src/ui/advancement";
import { adaptEpisodeHtml, EPISODES } from "../src/content/episodes";
import { OBJECTS, HINTS, REFLECTIONS } from "../src/content/data";
import { PLEDGES } from "../src/game/learning";
import type { ViewContext } from "../src/ui/views";
import { STOPS } from "../src/game/learning";
import { inspect, pickMemo, solve } from "../src/game/engine";
test("all episode maps retain visited marks on the next target across investigation, solving and saved restore", () => {
  for (const episode of Object.keys(EPISODES) as (keyof typeof EPISODES)[]) {
    const c = {
      state: createProgress(PRACTICE_CONFIG),
      learning: createExperience({ ...createExperience().options, episode }),
      sceneMode: "3d",
      objectId: null,
    } as ViewContext;
    c.state!.phase = "playing";
    const row = (id: string) =>
      spaceMap(c).match(
        new RegExp(`<button[^>]*data-value="${id}"[^>]*>(.*?)</button>`),
      )![1];
    assert.match(row("O02"), /★ 다음 물건/);
    assert.doesNotMatch(row("O02"), /✓/);
    inspect(c.state!, "O02");
    assert.match(row("O02"), /✓ 살펴봄/);
    assert.match(row("O03"), /★ 다음 물건/);
    inspect(c.state!, "O03");
    assert.match(row("O02"), /★ 다음 물건 · ✓ 살펴봄/);
    assert.match(row("O03"), /✓ 살펴봄/);
    const html = spaceMap(c);
    c.state = JSON.parse(JSON.stringify(c.state));
    c.learning = validateExperience(JSON.parse(JSON.stringify(c.learning)));
    assert.equal(spaceMap(c), html);
    for (const id of ["P1-C1", "P1-C3", "P1-C5"]) pickMemo(c.state!, id);
    assert.equal(solve(c.state!, "P1").ok, true);
    assert.match(row("O06"), /★ 다음 물건/);
    assert.doesNotMatch(row("O02"), /★/);
    assert.match(row("O02"), /✓ 살펴봄/);
    for (const object of OBJECTS) inspect(c.state!, object.id);
    for (const object of OBJECTS) assert.match(row(object.id), /✓ 살펴봄/);
    assert.match(row("O06"), /★ 다음 물건 · ✓ 살펴봄/);
  }
});
test("map follows each saved arrival stop and restores window and back positions on continue", () => {
  for (const episode of Object.keys(EPISODES) as (keyof typeof EPISODES)[]) {
    const e = createExperience({ ...createExperience().options, episode });
    for (const stop of STOPS) {
      e.view.pose = { stop, yaw: 0.8, pitch: -0.1 };
      const point = mapLocation(e);
      assert.ok(point.x > 2 && point.x < 98 && point.y > 2 && point.y < 98);
      assert.doesNotMatch(point.label, /undefined/);
      assert.deepEqual(
        mapLocation(validateExperience(JSON.parse(JSON.stringify(e)))),
        point,
      );
    }
    const c = { learning: e, sceneMode: "3d", objectId: "O02" } as ViewContext;
    e.view.pose = { stop: "plant", yaw: 1.2, pitch: 0 };
    assert.deepEqual(mapLocation(e), { x: 14, y: 18, label: "창가" });
    assert.match(spaceMap(c), /class="map-current-position" x="14" y="18"/);
    assert.match(spaceMap(c), /현재: 창가/);
    e.view.pose.stop = "back";
    assert.deepEqual(mapLocation(e), {
      x: 50,
      y: 90,
      label: `${EPISODES[episode].room} 뒤편`,
    });
    assert.match(spaceMap(c), /class="map-current-position" x="50" y="90"/);
    e.view.pose = null;
    assert.equal(mapLocation(e).label, `${EPISODES[episode].room} 가운데`);
    c.sceneMode = "2d";
    assert.match(spaceMap(c), /현재: 게시판/);
    assert.match(spaceMap(c), /class="map-current-position" x="65" y="26"/);
  }
});
test("old sidecars migrate new learning fields without changing existing progress", () => {
  const e = createExperience();
  const old = structuredClone(e) as any;
  delete old.extras;
  assert.deepEqual(validateExperience(old).extras, {
    seed: 0,
    conversation: null,
    tutorialDone: false,
    custom: null,
  });
  assert.deepEqual(old.options, e.options);
});
test("all shifted digits are reversible and saved variant keeps the same real puzzle answer", () => {
  for (const episode of Object.keys(EPISODES) as (keyof typeof EPISODES)[])
    for (let seed = 1; seed <= 9; seed++) {
      const e = createExperience({
        grade: "standard",
        minutes: 25,
        hints: "suggest",
        cooperation: true,
        episode,
        variation: true,
      });
      e.extras.seed = seed;
      assert.equal(
        new Set(Array.from({ length: 10 }, (_, i) => digit(e, i))).size,
        10,
      );
      assert.equal(
        displayCode(validateExperience(e), "713"),
        displayCode(e, "713"),
      );
      const s = createProgress(PRACTICE_CONFIG);
      s.solvedPuzzleIds = ["P1"];
      s.inventory = ["shared-lens"];
      s.puzzles.p2 = {
        lensUsed: "shared-lens",
        rotation: 0,
        code: displayCode(e, "713")
          .split("")
          .map((x) => inputDigit(e, x))
          .join(""),
      };
      assert.equal(judgeP2(s), true);
      assert.equal(isPracticeLesson(e.options), true);
    }
});
test("a new variation avoids the preceding seed and filtering selected cards preserves order", () => {
  const options = {
    grade: "standard",
    minutes: 25,
    hints: "suggest",
    cooperation: false,
    episode: "classroom",
    variation: true,
  } as const;
  for (let previous = 1; previous <= 9; previous++)
    assert.notEqual(
      createExperience({ ...options }, previous).extras.seed,
      previous,
    );
  const e = createExperience({ ...options });
  const cards = ["A", "B", "C", "D", "E"];
  const sorted = orderCards(cards, e);
  assert.deepEqual(
    orderCards(
      cards.filter((x) => x !== "C"),
      e,
    ),
    sorted.filter((x) => x !== "C"),
  );
});
test("variation cooperation dictionary and code describe the same symbols", () => {
  for (const episode of Object.keys(EPISODES) as (keyof typeof EPISODES)[]) {
    const e = createExperience({
      grade: "standard",
      minutes: 25,
      hints: "suggest",
      cooperation: true,
      episode,
      variation: true,
    });
    const legend = Object.fromEntries(
      cooperationLegend(e)
        .split(" · ")
        .map((x) => x.split("=")),
    );
    assert.equal(
      cooperationAnswer(e),
      EPISODES[episode].coopSequence.map((x) => legend[x]).join(""),
    );
  }
});
test("teacher files strictly validate structure and limits; editing always means practice", () => {
  const p = defaultLessonPack("gym");
  assert.deepEqual(parseLessonPack(JSON.stringify(p)), p);
  for (const bad of [
    { ...p, url: "https://example.test" },
    { ...p, title: "" },
    { ...p, intro: "x".repeat(301) },
    { ...p, episode: "unknown" },
    { ...p, hints: { ...p.hints, other: "x" } },
  ])
    assert.throws(() => validateLessonPack(bad));
  assert.throws(() => parseLessonPack(" ".repeat(17000)));
  assert.equal(
    isPracticeLesson({
      grade: "standard",
      minutes: 25,
      hints: "request",
      cooperation: false,
      episode: "classroom",
      authored: true,
    }),
    true,
  );
  const e = createExperience();
  e.options.authored = true;
  assert.throws(() => validateExperience(e));
  e.extras.custom = defaultLessonPack();
  assert.doesNotThrow(() => validateExperience(e));
});
test("custom text is escaped in lesson HTML and textarea controls", () => {
  const p = defaultLessonPack();
  p.title = "<img src=x onerror=alert(1)>";
  p.speech = "</textarea><script>alert(1)</script>";
  const html = customizeHtml(
    `<h1>${EPISODES.classroom.title}</h1><p>${defaultLessonPack().speech}</p>`,
    p,
    "classroom",
  );
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script/);
  const e = createExperience();
  e.options.authored = true;
  e.extras.custom = p;
  assert.doesNotMatch(practiceCard(e), /<img|<script/);
  assert.doesNotMatch(rolesDocument(e), /<img|<script/);
});
test("diagnostics distinguish missing clue, incorrect lens orientation and missing route friends", () => {
  const s = createProgress(PRACTICE_CONFIG),
    e = createExperience();
  assert.match(diagnose(s, e, "O02"), /직접 한 말/);
  s.puzzles.p2.lensUsed = "shared-lens";
  assert.match(diagnose(s, e, "O04"), /위로 돌려/);
  s.puzzles.p2.rotation = 0;
  assert.match(diagnose(s, e, "O04"), /7 · 1 · 3/);
  assert.match(diagnose(s, e, "O07"), /토끼/);
  s.puzzles.p3.path = [10, 5, 0, 1, 2, 7, 12, 17, 22, 23, 24];
  assert.match(diagnose(s, e, "O07"), /모두 만났/);
});
test("gym supplies distinct team puzzle, matching help and all twelve landmarks", () => {
  const c = {
    state: createProgress(PRACTICE_CONFIG),
    learning: createExperience({
      grade: "standard",
      minutes: 25,
      hints: "suggest",
      cooperation: true,
      episode: "gym",
    }),
    objectId: "O08",
  } as ViewContext;
  assert.match(gymTeams(c), /토끼·여우/);
  assert.match(gymTeams(c), /data-action="gym-team"/);
  assert.doesNotMatch(learningHints(c, "P4").join(), /사진/);
  assert.equal(Object.keys(EPISODES.gym.objects).length, 12);
  assert.equal(displayCode(c.learning, "713"), "591");
  const html = adaptEpisodeHtml(
    '<button data-action="inspect" data-value="O08">교실 태블릿</button>',
    "gym",
    OBJECTS,
  );
  assert.match(html, /공정한 팀 계획판/);
  assert.match(html, /data-value="O08"/);
  assert.match(
    adaptEpisodeHtml(
      "사진은 멈추고, 도움은 어른에게 이어 줘요.",
      "gym",
      OBJECTS,
    ),
    /공정한 팀/,
  );
  const map = adaptEpisodeHtml(spaceMap(c), "gym", OBJECTS);
  assert.match(map, /차례 게시판/);
  assert.doesNotMatch(map, /차례 차례|운동 운동/);
});
test("library and gym text keeps no classroom wording or doubled words", () => {
  const classroom = [
    "우리의 우정으로 교실 탈출 성공!",
    "창가 둥근 화분 받침 아래를 살펴봐요.",
    "네 친구를 모두 만나는 공의 길을 만들어요.",
    ...OBJECTS.map((o) => o.description),
    ...Object.values(HINTS).flat(),
  ].join("\n");
  for (const id of ["library", "gym"] as const) {
    const text = adaptEpisodeHtml(classroom, id, OBJECTS);
    assert.doesNotMatch(text, /교실|우정|공놀이|바구니|공 옆 칸/);
    // Only the gym swaps the photo/help network puzzle for team picking.
    if (id === "gym") assert.doesNotMatch(text, /사진 전달망/);
    assert.doesNotMatch(text, /(\S+) \1/, "a word repeats");
    assert.match(text, new RegExp(`${EPISODES[id].room} 탈출 성공`));
  }
});
test("printed materials follow the episode, lesson length and a preset seed", () => {
  for (const minutes of [15, 25, 40] as const) {
    const e = createExperience({
      ...createExperience().options,
      episode: "library",
      minutes,
    });
    const html = adaptEpisodeHtml(
      lessonMaterialsDocument(e),
      "library",
      OBJECTS,
    );
    assert.match(html, new RegExp(`${minutes}분 수업 흐름`));
    assert.match(html, /가상 도서관 활동/);
    assert.equal(/정리 ·/.test(html), minutes !== 15);
  }
  const options = { ...createExperience().options, variation: true };
  for (const seed of [2, 5, 9])
    assert.equal(createExperience(options, seed, seed).extras.seed, seed);
  const gym = adaptEpisodeHtml(
    [...PLEDGES, ...REFLECTIONS].join("\n"),
    "gym",
    OBJECTS,
  );
  assert.doesNotMatch(gym, /사진/);
  assert.match(
    adaptEpisodeHtml("놀이 방법을 알려 줄게", "library", OBJECTS),
    /읽는 방법/,
  );
});
test("bonus hints are not diagnosed as the object's required puzzle", () => {
  const s = createProgress(PRACTICE_CONFIG);
  const e = createExperience();
  assert.match(diagnose(s, e, "O02", "B3"), /추가 단서/);
  assert.match(diagnose(s, e, "O12", "B4"), /추가 단서/);
  assert.doesNotMatch(diagnose(s, e, "O02", "P1"), /추가 단서/);
});
test("each episode shows its own picture-mode drawing", async () => {
  const { existsSync } = await import("node:fs");
  const picture =
    '<img src="/x/assets/classroom.svg" alt="나무 책상과 햇살이 비치는 교실. 물건을 눌러 살펴볼 수 있어요.">';
  assert.equal(adaptEpisodeHtml(picture, "classroom", OBJECTS), picture);
  for (const id of ["library", "gym"] as const) {
    const html = adaptEpisodeHtml(picture, id, OBJECTS);
    assert.match(html, new RegExp(`assets/${id}\\.svg`));
    assert.match(html, new RegExp(EPISODES[id].room));
    assert.doesNotMatch(html, /교실/);
    assert.ok(existsSync(`public/assets/${id}.svg`));
  }
});
test("learning views preserve the game state and expose optional controls", () => {
  const c = {
    state: createProgress(PRACTICE_CONFIG),
    learning: createExperience(),
    objectId: "O02",
    tutorialStep: 0,
  } as ViewContext;
  const before = structuredClone(c);
  assert.match(tutorial(c), /demo-object/);
  assert.match(spaceMap(c), /다음 물건/);
  assert.match(friendTalk(c), /talk-choice/);
  assert.match(teacherProgress(c), /도움 0단계/);
  assert.deepEqual(c, before);
});
