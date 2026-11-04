import { test } from "node:test";
import assert from "node:assert/strict";
import { createProgress, PRACTICE_CONFIG } from "../src/game/model";
import {
  groupCard,
  validateGroupCard,
  addGroupCards,
  boardSummary,
} from "../src/tools/classboard";

const finished = () => {
  const s = createProgress(PRACTICE_CONFIG);
  s.phase = "escaped";
  s.exitUsed = true;
  s.solvedPuzzleIds = ["P1", "P2", "P3", "P4", "P5"];
  s.foundBonusIds = ["B1", "B3"];
  s.hints.P2 = 2;
  s.elapsedMs = 21.4 * 60000;
  return s;
};
test("a group card holds a number and counts only, no names", () => {
  const card = groupCard(finished(), "cafeteria", 3);
  assert.deepEqual(card, {
    schemaVersion: 1,
    recordType: "classroom-escape-group",
    episodeId: "cafeteria",
    group: 3,
    escaped: true,
    solved: 5,
    bonus: 2,
    hints: 2,
    minutes: 21,
  });
  assert.deepEqual(validateGroupCard(structuredClone(card)), card);
  assert.throws(() => groupCard(finished(), "classroom", 13));
  for (const bad of [
    { ...card, studentName: "x" },
    { ...card, group: 0 },
    { ...card, episodeId: "moon" },
    { ...card, escaped: true, solved: 3 },
    { ...card, hints: -1 },
  ])
    assert.throws(() => validateGroupCard(bad));
});
test("the board keeps one card per group and reports bad files", () => {
  const a = groupCard(finished(), "classroom", 2);
  const b = { ...groupCard(finished(), "classroom", 1), hints: 0 };
  const again = { ...a, minutes: 30 };
  let board = addGroupCards({ cards: [], messages: [] }, [
    { name: "a.json", text: JSON.stringify(a) },
    { name: "b.json", text: JSON.stringify(b) },
    { name: "broken.json", text: "{" },
  ]);
  board = addGroupCards(board, [
    { name: "a2.json", text: JSON.stringify(again) },
  ]);
  assert.deepEqual(
    board.cards.map((c) => [c.group, c.minutes]),
    [
      [1, 21],
      [2, 30],
    ],
  );
  assert.match(board.messages.join(), /broken\.json/);
  assert.match(board.messages.join(), /2모둠 카드를 새 카드로/);
  assert.deepEqual(boardSummary(board.cards), {
    groups: 2,
    escaped: 2,
    bonus: 4,
    noHints: 1,
  });
});
