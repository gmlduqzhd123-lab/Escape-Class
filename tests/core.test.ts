import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProgress,
  score,
  PRACTICE_CONFIG,
  PUZZLES,
  type Progress,
  type GameConfig,
  type School,
} from "../src/game/model";
import {
  inspect,
  takeLens,
  applyItem,
  solve,
  solveBonus,
  combine,
  escape,
  move,
  pickMemo,
  pickFragment,
  beginRequest,
} from "../src/game/engine";
import {
  runBall,
  solutionArrows,
  judgeP4,
  judgeP5,
  judgeP2,
  SUCCESS_PATH,
  toIndex,
  adjacent,
  extendPath,
  routeArrows,
  recoverLegacyPath,
  tapRoute,
} from "../src/puzzles/judges";
import { objective, hintTarget } from "../src/ui/experience";
import type { ViewContext } from "../src/ui/views";
import {
  validateProgress,
  loadProgress,
  saveProgress,
  eraseProgress,
  saveKey,
} from "../src/storage/progress";
import {
  validateConfig,
  validateResult,
  validateRanking,
  rankedRows,
} from "../src/ranking/validation";
import { exportReason, resultFile, emptyRanking } from "../src/ranking/service";
import {
  parseLocalFile,
  mergeEntry,
  resolveConflict,
  aggregateFile,
  type AggregateState,
} from "../src/tools/aggregate";

// Fictional fixtures only. They are never copied into public/data or the production bundle.
const schools: School[] = [1, 2, 3, 4].map((n) => ({
  schoolId: `FIXTURE-${n}`,
  name: `검증 전용 학교 ${n}`,
}));
const config: GameConfig = {
  ...PRACTICE_CONFIG,
  activeRound: {
    roundId: "fixture-round",
    label: "검증 전용 회차",
    acceptingResults: true,
  },
};
const fresh = () => {
  const s = createProgress(config, schools[0].schoolId);
  s.phase = "playing";
  return s;
};
function p1(s: Progress) {
  inspect(s, "O02");
  inspect(s, "O03");
  s.puzzles.p1.order = ["P1-C1", "P1-C3", "P1-C5"];
  assert.equal(solve(s, "P1").ok, true);
}
function p2(
  s: Progress,
  lens: "shared-lens" | "borrowed-lens" = "shared-lens",
) {
  p1(s);
  takeLens(s, lens);
  applyItem(s, lens, "O04");
  s.puzzles.p2.rotation = 0;
  s.puzzles.p2.code = "713";
  assert.equal(solve(s, "P2").ok, true);
}
function p3(s: Progress) {
  p2(s);
  s.puzzles.p3.arrows = solutionArrows();
  assert.equal(solve(s, "P3").ok, true);
}
function p4(s: Progress) {
  p3(s);
  s.puzzles.p4 = {
    "photo-1": false,
    "photo-2": false,
    "help-1": true,
    "help-2": true,
    "help-3": false,
  };
  assert.equal(solve(s, "P4").ok, true);
}
function all(s: Progress) {
  p4(s);
  move(s, "복도");
  move(s, "교무실");
  s.puzzles.p5.sentence = ["R0", "R1"];
  assert.equal(solve(s, "P5").ok, true);
}
function finish(s: Progress) {
  all(s);
  s.puzzles.final.order = ["F1", "F2", "F3", "F4", "F5"];
  s.puzzles.final.rotations = [0, 0, 0, 0, 0];
  assert.equal(combine(s).ok, true);
  inspect(s, "O11");
  assert.equal(escape(s, "final-key").ok, true);
}

test("AC01·AC02: practice without school; registered choice fixed at new game", () => {
  const s = createProgress(PRACTICE_CONFIG);
  assert.equal(s.schoolId, null);
  assert.equal(s.roundId, null);
  assert.equal(fresh().schoolId, "FIXTURE-1");
  assert.equal(fresh().roundId, "fixture-round");
});
test("AC03: P1 requires discovery and direct speech order; reward once", () => {
  const s = fresh();
  s.puzzles.p1.order = ["P1-C1", "P1-C3", "P1-C5"];
  assert.equal(solve(s, "P1").ok, false);
  inspect(s, "O02");
  assert.equal(solve(s, "P1").ok, false);
  inspect(s, "O03");
  assert.equal(solve(s, "P1").ok, true);
  assert.equal(score(s), 16);
  solve(s, "P1");
  assert.equal(score(s), 16);
  assert.equal(s.solvedPuzzleIds.length, 1);
});
test("AC03: guesses cannot replace direct speech", () => {
  const s = fresh();
  inspect(s, "O02");
  inspect(s, "O03");
  s.puzzles.p1.order = ["P1-C1", "P1-C2", "P1-C5"];
  assert.equal(solve(s, "P1").ok, false);
});
test("AC04: either permitted lens earns identical reward", () => {
  for (const lens of ["shared-lens", "borrowed-lens"] as const) {
    const s = fresh();
    p2(s, lens);
    assert.equal(score(s), 32);
    assert.equal(
      validateProgress(s, config, schools).inventory.includes(lens),
      true,
    );
  }
});
test("AC05: numeric answer alone, unaligned lens, or no inventory rejected", () => {
  const s = fresh();
  p1(s);
  s.puzzles.p2.code = "713";
  assert.equal(solve(s, "P2").ok, false);
  takeLens(s, "shared-lens");
  applyItem(s, "shared-lens", "O04");
  assert.equal(judgeP2(s), false);
  s.puzzles.p2.rotation = 0;
  assert.equal(judgeP2(s), true);
  s.inventory = [];
  assert.equal(judgeP2(s), false);
});
test("wrong tool application preserves inventory", () => {
  const s = fresh();
  takeLens(s, "shared-lens");
  assert.equal(applyItem(s, "shared-lens", "O11").ok, false);
  assert.deepEqual(s.inventory, ["shared-lens"]);
});
test("AC06: path simulation visits every friend and reaches goal", () => {
  const result = runBall(solutionArrows());
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.path,
    SUCCESS_PATH.map(([x, y]) => toIndex(x, y)),
  );
  assert.equal(result.met.length, 4);
});
test("AC06: unused arrows can vary; evaluator simulates visits rather than matching board state", () => {
  const arrows = solutionArrows();
  const used = new Set(SUCCESS_PATH.map(([x, y]) => toIndex(x, y)));
  for (let i = 0; i < 25; i++) if (!used.has(i)) arrows[i] = 3;
  assert.equal(runBall(arrows).ok, true);
  assert.notDeepEqual(arrows, solutionArrows());
});
test("AC07: missing friends, wall, repeated tile, out of range all fail", () => {
  assert.match(runBall(Array(25).fill(0)).message, /공을 받지/);
  const wall = Array(25).fill(0);
  wall[10] = 3;
  assert.match(runBall(wall).message, /벽 충돌/);
  const loop = Array(25).fill(0);
  loop[11] = 2;
  assert.match(runBall(loop).message, /반복/);
  const out = Array(25).fill(0);
  out[10] = 2;
  assert.match(runBall(out).message, /범위 이탈/);
});
test("AC08·AC09: photo block requires help route; all three adult options valid", () => {
  const p = {
    "photo-1": false,
    "photo-2": false,
    "help-1": true,
    "help-2": false,
    "help-3": false,
  };
  assert.equal(judgeP4(p), false);
  for (const adults of [
    [true, false],
    [false, true],
    [true, true],
  ])
    assert.equal(
      judgeP4({ ...p, "help-2": adults[0], "help-3": adults[1] }),
      true,
    );
  assert.equal(judgeP4({ ...p, "help-1": false, "help-2": true }), false);
  assert.equal(judgeP4({ ...p, "photo-2": true, "help-2": true }), false);
});
test("AC10: absent teacher optional; either available adult and R1/R2 order valid", () => {
  for (const absent of [true, false])
    for (const place of ["교무실", "상담실"] as const) {
      const s = fresh();
      p4(s);
      move(s, "복도");
      if (absent) {
        move(s, "담임 자리");
        s.puzzles.p5.sentence = ["R0", "R1"];
        assert.equal(solve(s, "P5").ok, false);
        move(s, "복도");
      }
      move(s, place);
      s.puzzles.p5.sentence = ["R0", "R2", "R1"];
      assert.equal(solve(s, "P5").ok, true);
      assert.equal(score(s), 80);
    }
  assert.equal(judgeP5({ place: "교무실", sentence: ["R1", "R0"] }), false);
});
test("AC11·AC12: repeated solve/bonus cannot accumulate scores", () => {
  const s = fresh();
  all(s);
  for (let i = 0; i < 5; i++) {
    solve(s, "P5");
    solveBonus(s, "B1", "하트");
  }
  assert.equal(score(s), 85);
  assert.equal(s.solvedPuzzleIds.length, 5);
  assert.equal(s.foundBonusIds.length, 1);
});
test("AC13·AC14: 80 or 100 points before exit is not escaped/exportable", () => {
  const s = fresh();
  all(s);
  assert.equal(score(s), 80);
  assert.equal(s.phase, "finalReady");
  for (const [id, ans] of [
    ["B1", "하트"],
    ["B2", "함께 쓰기"],
    ["B3", "1,2,3"],
    ["B4", "312"],
  ] as const)
    solveBonus(s, id, ans);
  assert.equal(score(s), 100);
  assert.ok(exportReason(s, config, schools));
  assert.throws(() => resultFile(s, config, schools));
});
test("AC15: final assembly then plant inspection then key use required", () => {
  const s = fresh();
  inspect(s, "O11");
  assert.equal(s.finalKeyObtained, false);
  all(s);
  assert.equal(combine(s).ok, false);
  s.puzzles.final.order = ["F1", "F2", "F3", "F4", "F5"];
  s.puzzles.final.rotations.fill(0);
  combine(s);
  assert.equal(escape(s, "final-key").ok, false);
  inspect(s, "O11");
  assert.equal(escape(s, "shared-lens").ok, false);
  assert.equal(escape(s, "final-key").ok, true);
  assert.equal(s.phase, "escaped");
  assert.equal(validateProgress(s, config, schools).frozenScore, 80);
});
test("AC16: escaped score and progress frozen under engine actions", () => {
  const s = fresh();
  finish(s);
  solveBonus(s, "B1", "하트");
  takeLens(s, "borrowed-lens");
  inspect(s, "O10");
  solve(s, "P1");
  assert.equal(s.frozenScore, 80);
  assert.equal(score(s), 80);
  assert.equal(s.inventory.includes("borrowed-lens"), false);
});
test("AC17·AC19: restoration pauses and deletion uses only namespaced key", () => {
  const data = new Map<string, string>([["other-app", "keep"]]);
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const s = fresh();
  p1(s);
  const key = saveKey("/repo/");
  saveProgress(storage, key, s);
  const loaded = loadProgress(storage, key, config, schools);
  assert.equal(loaded.state?.paused, true);
  assert.equal(score(loaded.state!), 16);
  eraseProgress(storage, key);
  assert.equal(data.get("other-app"), "keep");
  assert.equal(key, "classroom-escape:/repo/:progress:v1");
});
test("a save whose school left the list continues as practice", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const s = fresh();
  p1(s);
  s.schoolId = "REMOVED-SCHOOL";
  saveProgress(storage, "k", s);
  const loaded = loadProgress(storage, "k", config, schools);
  assert.equal(loaded.error, null);
  assert.equal(loaded.state?.schoolId, null);
  assert.equal(score(loaded.state!), 16);
  assert.match(loaded.notice ?? "", /연습 모드/);
  const known = { ...s, schoolId: schools[0].schoolId };
  saveProgress(storage, "k", known);
  assert.equal(loadProgress(storage, "k", config, schools).notice, undefined);
});
test("AC18: blocked storage failure is contained; game remains playable", () => {
  const s = fresh();
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
  assert.equal(saveProgress(bad, "x", s), false);
  assert.ok(loadProgress(bad, "x").error);
  p1(s);
  assert.equal(score(s), 16);
});
test("save rejects duplicate, forged phase, invalid dependency/type/unknown field", () => {
  const s = fresh();
  for (const change of [
    { phase: "escaped" },
    { elapsedMs: "12" },
    { solvedPuzzleIds: ["P1", "P1"] },
    { inventory: ["final-key"] },
    { studentName: "private" },
  ])
    assert.throws(() => validateProgress({ ...s, ...change }, config, schools));
});
function resultFixture() {
  const s = fresh();
  finish(s);
  s.foundBonusIds = ["B1", "B3"];
  s.frozenScore = 90;
  return resultFile(s, config, schools);
}
test("save rejects locked-device manipulation and keeps partial bonus input", () => {
  for (const change of [
    (s: Progress) => {
      s.puzzles.p2.code = "713";
    },
    (s: Progress) => {
      s.puzzles.p3.arrows[10] = 3;
    },
    (s: Progress) => {
      s.puzzles.p4["photo-1"] = false;
    },
    (s: Progress) => {
      s.puzzles.p5.place = "교무실";
    },
    (s: Progress) => {
      s.puzzles.final.rotations[0] = 0;
    },
    (s: Progress) => {
      s.puzzles.b4 = "31";
    },
  ]) {
    const s = fresh();
    change(s);
    assert.throws(() => validateProgress(s, config, schools));
  }
  const s = fresh();
  all(s);
  s.puzzles.b4 = "31";
  assert.equal(validateProgress(s, config, schools).puzzles.b4, "31");
});
test("AC20·AC21: strict result schema and recalculated 90 points", () => {
  const r = resultFixture();
  assert.equal(validateResult(r, config, schools).foundBonusIds.length, 2);
  assert.equal(
    parseLocalFile(JSON.stringify(r), 100, config, schools)[0].score,
    90,
  );
  for (const change of [
    { contentVersion: "bad" },
    { foundBonusIds: ["B1", "B1"] },
    { solvedPuzzleIds: ["P1", "P2", "P3", "P4", "P4"] },
    { studentName: "private" },
    { escaped: false },
  ])
    assert.throws(() => validateResult({ ...r, ...change }, config, schools));
  assert.throws(() =>
    parseLocalFile(JSON.stringify(r), 102401, config, schools),
  );
});
test("AC22: duplicates collapse and conflicting school requires explicit decision", () => {
  const state: AggregateState = { records: [], conflicts: [], messages: [] };
  const row = {
    schoolId: "FIXTURE-1",
    score: 90,
    bonusCount: 2,
    escaped: true as const,
  };
  mergeEntry(state, { name: "one", row });
  mergeEntry(state, { name: "same", row });
  assert.equal(state.records.length, 1);
  mergeEntry(state, {
    name: "different",
    row: { ...row, score: 95, bonusCount: 3 },
  });
  assert.equal(state.conflicts.length, 1);
  assert.throws(() => aggregateFile(state, config, schools));
  resolveConflict(state, 0, "keep");
  assert.equal(aggregateFile(state, config, schools).records[0].score, 90);
  resolveConflict(state, 0, "replace");
  assert.equal(aggregateFile(state, config, schools).records[0].score, 95);
  // A second candidate for the same school: one replace wins, the other reverts to keep.
  mergeEntry(state, {
    name: "lower",
    row: { ...row, score: 80, bonusCount: 0 },
  });
  assert.equal(state.conflicts.length, 2);
  resolveConflict(state, 1, "replace");
  assert.deepEqual(
    state.conflicts.map((c) => c.choice),
    ["keep", "replace"],
  );
  assert.equal(aggregateFile(state, config, schools).records[0].score, 80);
  state.conflicts[0].choice = "replace";
  assert.throws(() => aggregateFile(state, config, schools));
});
test("AC23: competition ranking 100,95,95,90 → 1,2,2,4", () => {
  const file = {
    ...emptyRanking(config),
    updatedAt: "2026-10-23T00:00:00.000Z",
    records: schools.map((s, i) => ({
      schoolId: s.schoolId,
      score: [100, 95, 95, 90][i],
      bonusCount: [4, 3, 3, 2][i],
      escaped: true as const,
    })),
  };
  assert.deepEqual(
    rankedRows(validateRanking(file, config, schools), schools).map(
      (r) => r.rank,
    ),
    [1, 2, 2, 4],
  );
});
test("AC24: production schools and rankings intentionally empty", async () => {
  const fs = await import("node:fs/promises");
  const list = JSON.parse(
    await fs.readFile(
      new URL("../public/data/schools.json", import.meta.url),
      "utf8",
    ),
  );
  const ranks = JSON.parse(
    await fs.readFile(
      new URL("../public/data/rankings.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(list, []);
  assert.deepEqual(ranks.records, []);
});
test("AC31: every next puzzle checks prerequisites even with correct local control values", () => {
  const s = fresh();
  takeLens(s, "shared-lens");
  s.puzzles.p2 = { lensUsed: "shared-lens", rotation: 0, code: "713" };
  s.puzzles.p3.arrows = solutionArrows();
  s.puzzles.p4 = {
    "photo-1": false,
    "photo-2": false,
    "help-1": true,
    "help-2": true,
    "help-3": false,
  };
  s.puzzles.p5 = { place: "교무실", sentence: ["R0", "R1"] };
  for (const id of ["P2", "P3", "P4", "P5"] as const)
    assert.equal(solve(s, id).ok, false);
  assert.equal(combine(s).ok, false);
  assert.equal(solveBonus(s, "B4", "312").ok, false);
  assert.equal(score(s), 0);
});
test("AC33: previous round can resume but cannot become current official result", () => {
  const s = fresh();
  finish(s);
  s.roundId = "previous-round";
  assert.equal(validateProgress(s, config, schools).roundId, "previous-round");
  assert.match(exportReason(s, config, schools)!, /달라요/);
  assert.throws(() =>
    validateResult(
      { ...resultFixture(), roundId: "previous-round" },
      config,
      schools,
    ),
  );
});
test("AC34: no round, closed round, or missing config disallows export and aggregate", () => {
  const s = fresh();
  finish(s);
  for (const cfg of [
    PRACTICE_CONFIG,
    {
      ...config,
      activeRound: { ...config.activeRound!, acceptingResults: false },
    },
    null,
  ]) {
    assert.ok(exportReason(s, cfg, schools));
    assert.throws(() =>
      aggregateFile(
        { records: [], conflicts: [], messages: [] },
        cfg!,
        schools,
      ),
    );
  }
  assert.throws(() =>
    validateConfig({
      ...config,
      activeRound: { roundId: "", label: "x", acceptingResults: true },
    }),
  );
});
test("AC35·AC36: ranking has its own strict schema; reject bonus overflow and school duplicates", () => {
  const valid = {
    ...emptyRanking(config),
    updatedAt: "2026-10-23T00:00:00.000Z",
    records: [
      { schoolId: "FIXTURE-1", score: 90, bonusCount: 2, escaped: true },
    ],
  };
  assert.equal(validateRanking(valid, config, schools, true).records.length, 1);
  assert.equal(
    parseLocalFile(JSON.stringify(valid), 100, config, schools)[0].score,
    90,
  );
  for (const records of [
    [{ ...valid.records[0], bonusCount: 100, score: 580 }],
    [valid.records[0], valid.records[0]],
    [{ ...valid.records[0], solvedPuzzleIds: PUZZLES }],
    [{ ...valid.records[0], score: 100 }],
  ])
    assert.throws(() =>
      validateRanking({ ...valid, records }, config, schools, true),
    );
  assert.throws(() =>
    validateRanking({ ...valid, roundId: null }, config, schools),
  );
});
test("closed last-round leaderboard is readable but cannot be aggregated", () => {
  const closed = {
    ...config,
    activeRound: { ...config.activeRound!, acceptingResults: false },
  };
  const f = { ...emptyRanking(closed), records: [] };
  assert.ok(validateRanking(f, closed, schools));
  assert.throws(() => validateRanking(f, closed, schools, true));
});

test("route controls reject row wrapping, walls, repeated cells and jumps", () => {
  assert.equal(adjacent(4, 5), false);
  assert.equal(extendPath([10], 5).ok, true);
  for (const cell of [6, 10, 0, 25, NaN, 2.5])
    assert.equal(extendPath([10], cell).ok, false);
  assert.equal(extendPath([10, 11, 12, 13, 14], 19).ok, false);
});
test("selected route drives the existing ball judge and meets every friend", () => {
  const path = SUCCESS_PATH.map(([x, y]) => toIndex(x, y));
  for (let i = 1; i < path.length; i++)
    assert.equal(extendPath(path.slice(0, i), path[i]).ok, true);
  const result = runBall(routeArrows(path));
  assert.equal(result.ok, true);
  assert.deepEqual(result.path, path);
  assert.equal(result.met.length, 4);
  assert.equal(runBall(routeArrows([10, 11, 12, 13, 14])).ok, false);
});
test("partial route restores exactly; inconsistent or impossible path is rejected", () => {
  const s = fresh();
  p2(s);
  s.puzzles.p3.path = [10, 5, 0];
  s.puzzles.p3.arrows = routeArrows(s.puzzles.p3.path);
  assert.deepEqual(
    validateProgress(s, config, schools).puzzles.p3.path,
    [10, 5, 0],
  );
  for (const path of [
    [10, 0],
    [10, 11, 6],
    [10, 5, 10],
    [10, 11, 12, 13, 14, 19],
  ]) {
    const invalid = structuredClone(s);
    invalid.puzzles.p3.path = path;
    assert.throws(() => validateProgress(invalid, config, schools));
  }
  s.puzzles.p3.arrows[10] = 0;
  assert.throws(() => validateProgress(s, config, schools));
});
test("legacy arrow-only saves migrate without mutating the supplied data", () => {
  for (const stage of ["locked", "partial", "completed", "escaped"]) {
    const s = fresh();
    if (stage === "partial") {
      p2(s);
      s.puzzles.p3.arrows = routeArrows([10, 5, 0]);
    }
    if (stage === "completed") p3(s);
    if (stage === "escaped") finish(s);
    const old = structuredClone(s) as any;
    delete old.puzzles.p3.path;
    const migrated = validateProgress(old, config, schools);
    assert.equal(Object.hasOwn(old.puzzles.p3, "path"), false);
    assert.deepEqual(migrated.solvedPuzzleIds, s.solvedPuzzleIds);
    assert.equal(migrated.phase, s.phase);
    assert.deepEqual(
      migrated.puzzles.p3.path,
      stage === "locked" ? [10] : recoverLegacyPath(s.puzzles.p3.arrows),
    );
  }
});
test("legacy invalid routes are truncated at walls or a repeated cell", () => {
  const arrows = Array(25).fill(0);
  arrows[10] = 3;
  arrows[5] = 0;
  assert.deepEqual(recoverLegacyPath(arrows), [10, 5]);
  arrows[5] = 1;
  assert.deepEqual(recoverLegacyPath(arrows), [10, 5]);
});
test("current objective follows discovery, tool use and the hidden key", () => {
  const s = fresh();
  assert.equal(objective(s)[1], "O02");
  inspect(s, "O02");
  assert.equal(objective(s)[1], "O03");
  inspect(s, "O03");
  assert.equal(objective(s)[1], "O02");
  p1(s);
  assert.equal(objective(s)[1], "O06");
  takeLens(s, "shared-lens");
  assert.equal(objective(s)[1], "O04");
  const end = fresh();
  all(end);
  assert.equal(objective(end)[1], "O12");
  end.puzzles.final.order = ["F1", "F2", "F3", "F4", "F5"];
  end.puzzles.final.rotations = [0, 0, 0, 0, 0];
  combine(end);
  assert.equal(objective(end)[1], "O11");
  inspect(end, "O11");
  assert.equal(objective(end)[1], "O12");
});
test("hints follow the inspected device, including optional bonus devices", () => {
  for (const [objectId, device, expected] of [
    ["O04", "main", "P2"],
    ["O08", "main", "P4"],
    ["O09", "main", "P5"],
    ["O02", "bonus", "B3"],
    ["O06", "bonus", "B2"],
    ["O12", "bonus", "B4"],
    ["O10", "main", "B1"],
  ])
    assert.equal(
      hintTarget({ state: fresh(), objectId, device } as ViewContext),
      expected,
    );
});

test("direct memo placement retains discovery, capacity and completion gates", () => {
  const s = fresh();
  assert.equal(pickMemo(s, "P1-C1"), false);
  inspect(s, "O02");
  assert.equal(pickMemo(s, "P1-C3"), false);
  inspect(s, "O03");
  for (const id of ["P1-C1", "P1-C3", "P1-C5"])
    assert.equal(pickMemo(s, id), true);
  assert.equal(pickMemo(s, "P1-C2"), false);
  assert.equal(solve(s, "P1").ok, true);
  assert.equal(pickMemo(s, "P1-C4"), false);
  assert.equal(score(s), 16);
});
test("memo mistakes can be removed and corrected without choosing a separate home", () => {
  const s = fresh();
  inspect(s, "O02");
  inspect(s, "O03");
  for (const id of ["P1-C1", "P1-C2", "P1-C5"]) pickMemo(s, id);
  assert.equal(solve(s, "P1").ok, false);
  s.puzzles.p1.order.splice(1);
  for (const id of ["P1-C3", "P1-C5"]) pickMemo(s, id);
  assert.equal(solve(s, "P1").ok, true);
  assert.deepEqual(validateProgress(s, config, schools).puzzles.p1.order, [
    "P1-C1",
    "P1-C3",
    "P1-C5",
  ]);
});
test("tapping a visited route cell rewinds; invalid new steps do not mutate the path", () => {
  const path = [10, 5, 0, 1, 2];
  assert.deepEqual(tapRoute(path, 0), [10, 5, 0]);
  assert.deepEqual(tapRoute(path, 10), [10]);
  assert.deepEqual(tapRoute(path, 7), [10, 5, 0, 1, 2, 7]);
  assert.equal(tapRoute(path, 24), null);
  assert.equal(tapRoute(path, 6), null);
  assert.deepEqual(path, [10, 5, 0, 1, 2]);
});
test("direct fragments seat upright and still require the correct order and hidden key", () => {
  const s = fresh();
  assert.equal(pickFragment(s, "F1"), false);
  all(s);
  for (const id of ["F2", "F1", "F3", "F4", "F5"])
    assert.equal(pickFragment(s, id), true);
  assert.equal(combine(s).ok, false);
  s.puzzles.final.order = [];
  for (const id of ["F1", "F2", "F3", "F4", "F5"]) pickFragment(s, id);
  assert.equal(combine(s).ok, true);
  assert.equal(escape(s, "final-key").ok, false);
  inspect(s, "O11");
  assert.equal(escape(s, "final-key").ok, true);
  assert.equal(pickFragment(s, "F1"), false);
});
test("old seated pieces are aligned on inspection without changing their order", () => {
  const s = fresh();
  all(s);
  s.puzzles.final.order = ["F1", "F2", "F3"];
  const old = structuredClone(s);
  inspect(s, "O12");
  assert.deepEqual(s.puzzles.final.order, old.puzzles.final.order);
  assert.deepEqual(s.puzzles.final.rotations, [0, 0, 0, 0, 0]);
  assert.equal(s.finalCombined, false);
  assert.equal(score(s), 80);
  assert.ok(validateProgress(s, config, schools));
});
test("a help conversation starts at either available adult and accepts either comfortable choice", () => {
  const locked = fresh();
  assert.equal(beginRequest(locked), false);
  for (const place of ["교무실", "상담실"] as const)
    for (const choice of ["R1", "R2"]) {
      const s = fresh();
      p4(s);
      assert.equal(beginRequest(s), false);
      move(s, "복도");
      move(s, place);
      s.puzzles.p5.sentence = ["R1", "R0"];
      assert.equal(beginRequest(s), true);
      assert.deepEqual(s.puzzles.p5.sentence, ["R0"]);
      s.puzzles.p5.sentence.push(choice);
      assert.equal(solve(s, "P5").ok, true);
      assert.equal(beginRequest(s), false);
      assert.ok(validateProgress(s, config, schools));
    }
});
test("paused and escaped progress cannot be changed by the simplified controls", () => {
  const s = fresh();
  inspect(s, "O02");
  s.paused = true;
  assert.equal(pickMemo(s, "P1-C1"), false);
  assert.equal(pickFragment(s, "F1"), false);
  assert.equal(beginRequest(s), false);
  const end = fresh();
  finish(end);
  const before = structuredClone(end);
  pickMemo(end, "P1-C2");
  pickFragment(end, "F1");
  beginRequest(end);
  inspect(end, "O12");
  assert.deepEqual(end, before);
});
