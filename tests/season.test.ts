import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExperience,
  validateExperience,
  lessonForRound,
  isPracticeLesson,
  cooperationLegend,
  DEFAULT_LESSON,
  EASY_LESSON,
} from "../src/game/learning";
import { displayCode, inputDigit, orderCards } from "../src/game/advancement";
import { validateConfig } from "../src/ranking/validation";

const OFFICIAL = {
  ...DEFAULT_LESSON,
  cooperation: false,
  hints: "request" as const,
};
const round = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  episodeId: "ep01",
  difficultyId: "standard",
  contentVersion: "ep01-1.0.0",
  activeRound: {
    roundId: "r",
    label: "회차",
    acceptingResults: true,
    ...extra,
  },
});

test("a round may name a season challenge from 1 to 9", () => {
  assert.equal(validateConfig(round({ season: 3 })).activeRound?.season, 3);
  assert.equal(validateConfig(round()).activeRound?.season, undefined);
  for (const bad of [0, 10, 2.5, "3", null])
    assert.throws(() => validateConfig(round({ season: bad })));
});
test("official games take the round's season; practice keeps its own codes", () => {
  const official = createExperience(lessonForRound(OFFICIAL, 4));
  assert.equal(official.options.season, 4);
  assert.equal(official.extras.seed, 4);
  assert.equal(isPracticeLesson(official.options), false);
  // The lens code the class sees changes with the season, and still maps back.
  assert.equal(displayCode(official, "713"), "157");
  assert.equal(
    displayCode(official, "713")
      .split("")
      .map((n) => inputDigit(official, n))
      .join(""),
    "713",
  );
  // Every school in the round gets the same card order, and seasons differ.
  const cards = ["P1-C1", "P1-C2", "P1-C3", "P1-C4", "P1-C5"];
  assert.deepEqual(
    orderCards(cards, official),
    orderCards(cards, createExperience(lessonForRound(OFFICIAL, 4))),
  );
  const orders = new Set(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      orderCards(cards, createExperience(lessonForRound(OFFICIAL, n))).join(),
    ),
  );
  assert.ok(orders.size > 1);
  assert.match(cooperationLegend(official), /별=8/);
  // Practice ignores the season; no season leaves official codes unchanged.
  assert.equal(lessonForRound(EASY_LESSON, 4).season, undefined);
  assert.equal(lessonForRound(OFFICIAL, undefined).season, undefined);
  assert.equal(displayCode(createExperience(OFFICIAL), "713"), "713");
  // A later round without a season clears an old one from the draft.
  assert.equal(
    lessonForRound({ ...OFFICIAL, season: 4 }, undefined).season,
    undefined,
  );
});
test("a saved season game restores and a tampered seed is refused", () => {
  const e = createExperience(lessonForRound(OFFICIAL, 6));
  assert.equal(validateExperience(structuredClone(e)).extras.seed, 6);
  assert.throws(() =>
    validateExperience({ ...e, extras: { ...e.extras, seed: 2 } }),
  );
  assert.throws(() =>
    validateExperience({ ...e, options: { ...e.options, season: 12 } }),
  );
});
