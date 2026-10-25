import { test } from "node:test";
import assert from "node:assert/strict";
import { createProgress, PRACTICE_CONFIG, score } from "../src/game/model";
import {
  createExperience,
  DEFAULT_LESSON,
  EASY_LESSON,
  validateExperience,
  cooperationAnswer,
  assistProgress,
} from "../src/game/learning";
import {
  GUIDED_ROUTE,
  nextGuidedRoute,
  useEasyMode,
  guidedNetwork,
} from "../src/game/guidance";
import { routeArrows, runBall, adjacent, WALLS } from "../src/puzzles/judges";
import { inspect, pickMemo, solve } from "../src/game/engine";
import { objectContent } from "../src/ui/panels";
import { gymTeams } from "../src/ui/advancement";
import type { ViewContext } from "../src/ui/views";

test("easy memo shows one discovered next choice and repairs old out-of-order guided saves", () => {
  for (const episode of ["classroom", "library", "gym"] as const) {
    const s = createProgress(PRACTICE_CONFIG),
      e = createExperience({ ...EASY_LESSON, episode });
    s.phase = "playing";
    inspect(s, "O02");
    assistProgress(s, e);
    const c = {
      state: s,
      learning: e,
      objectId: "O02",
      device: "main",
    } as unknown as ViewContext;
    const html = () => objectContent(s, "O02", null, [], 0, false, c);
    assert.doesNotMatch(html(), /data-action="memo-pick"/);
    inspect(s, "O03");
    assert.match(html(), /data-value="P1-C3"/);
    assert.doesNotMatch(html(), /data-value="P1-C5"/);
    s.puzzles.p1.order = ["P1-C1", "P1-C5"];
    assistProgress(s, e);
    assert.deepEqual(s.puzzles.p1.order, ["P1-C1"]);
    pickMemo(s, "P1-C3");
    assert.match(html(), /data-value="P1-C5"/);
    pickMemo(s, "P1-C5");
    assert.equal(solve(s, "P1").ok, true);
  }
});

test("easy start and in-progress conversion preserve earned puzzles and valid saved cooperation", () => {
  assert.equal(EASY_LESSON.grade, "guided");
  assert.equal(EASY_LESSON.cooperation, false);
  assert.equal(DEFAULT_LESSON.grade, "standard");
  const s = createProgress(PRACTICE_CONFIG),
    e = createExperience();
  s.phase = "playing";
  s.roundId = "old-official-round";
  inspect(s, "O02");
  s.puzzles.p1.order = ["P1-C1", "P1-C4", "P1-C5"];
  e.coopSolved = true;
  e.viewedRoles = [0, 1];
  e.coopCode = cooperationAnswer(e);
  assert.doesNotThrow(() => validateExperience(e));
  assert.equal(useEasyMode(s, e), true);
  assert.deepEqual(s.puzzles.p1.order, ["P1-C1"]);
  assert.equal(s.roundId, null);
  assert.ok(s.discoveredClueIds.includes("O02"));
  assert.doesNotThrow(() => validateExperience(JSON.parse(JSON.stringify(e))));
  s.solvedPuzzleIds = ["P1", "P2"];
  s.inventory = ["shared-lens"];
  const before = score(s);
  useEasyMode(s, e);
  assert.equal(score(s), before);
  assert.deepEqual(s.inventory, ["shared-lens"]);
  s.phase = "escaped";
  assert.equal(useEasyMode(s, e), false);
});
test("guided route help reaches each friend and passes the real route judge, including recovery", () => {
  for (const start of [[10, 5, 0], [10, 11, 12], [10]]) {
    let path = start;
    for (let i = 0; i < 8 && path.join() !== GUIDED_ROUTE.join(); i++) {
      path = nextGuidedRoute(path);
      assert.equal(new Set(path).size, path.length);
      assert.ok(path.every((cell) => !WALLS.includes(cell)));
      for (let n = 1; n < path.length; n++)
        assert.ok(adjacent(path[n - 1], path[n]));
    }
    assert.equal(runBall(routeArrows(path)).ok, true);
    assert.deepEqual(nextGuidedRoute(path), path);
  }
});
test("easy network still requires stopping photos before reaching an adult and keeps the original judge", () => {
  const s = createProgress(PRACTICE_CONFIG),
    e = createExperience({ ...EASY_LESSON });
  s.phase = "playing";
  assert.equal(guidedNetwork(s, e, "photo"), false);
  s.solvedPuzzleIds = ["P1", "P2", "P3"];
  assert.equal(guidedNetwork(s, e, "help"), false);
  assert.equal(guidedNetwork(s, e, "photo"), true);
  assert.equal(solve(s, "P4").ok, false);
  assert.equal(guidedNetwork(s, e, "help"), true);
  assert.equal(solve(s, "P4").ok, true);
  assert.equal(guidedNetwork(s, e, "photo"), false);
});
test("guided panels simplify choices while standard panels retain their existing controls", () => {
  const s = createProgress(PRACTICE_CONFIG);
  s.phase = "playing";
  s.solvedPuzzleIds = ["P1", "P2", "P3"];
  const c = {
    state: s,
    learning: createExperience({ ...EASY_LESSON }),
    objectId: "O08",
    device: "main",
    ballPath: [],
    ballIndex: 0,
    running: false,
  } as unknown as ViewContext;
  assert.match(
    objectContent(s, "O08", null, [], 0, false, c),
    /data-action="guided-photo"/,
  );
  assert.match(
    objectContent(s, "O07", null, [], 0, false, c),
    /data-action="guided-route"/,
  );
  c.learning!.options.grade = "standard";
  assert.doesNotMatch(
    objectContent(s, "O08", null, [], 0, false, c),
    /data-action="guided-photo"/,
  );
  assert.match(
    objectContent(s, "O08", null, [], 0, false, c),
    /data-action="switch"/,
  );
  c.learning!.options.grade = "guided";
  c.learning!.options.episode = "gym";
  assert.equal((gymTeams(c).match(/data-action="gym-team"/g) ?? []).length, 2);
  c.learning!.options.grade = "standard";
  assert.equal((gymTeams(c).match(/data-action="gym-team"/g) ?? []).length, 3);
});
