import { PUZZLES, BONUSES, type Progress } from "../game/model";
import { EPISODES, type EpisodeId } from "../content/episodes";
import { exact } from "../ranking/validation";

// A class board: each group saves one small card on its result screen, and the
// teacher opens all cards on one device to wrap up the lesson together. Cards
// carry a group number only (no names), stay on the devices, and never count
// towards the official ranking.
export const MAX_GROUP = 12;
export interface GroupCard {
  schemaVersion: 1;
  recordType: "classroom-escape-group";
  episodeId: EpisodeId;
  group: number;
  escaped: boolean;
  solved: number;
  bonus: number;
  hints: number;
  minutes: number;
}
export function groupCard(
  s: Progress,
  episodeId: EpisodeId,
  group: number,
): GroupCard {
  if (!Number.isInteger(group) || group < 1 || group > MAX_GROUP)
    throw new Error("모둠 번호를 1~12에서 골라요.");
  return {
    schemaVersion: 1,
    recordType: "classroom-escape-group",
    episodeId,
    group,
    escaped: s.exitUsed,
    solved: PUZZLES.filter((id) => s.solvedPuzzleIds.includes(id)).length,
    bonus: BONUSES.filter((id) => s.foundBonusIds.includes(id)).length,
    hints: Object.values(s.hints).reduce((a, b) => a + b, 0),
    minutes: Math.max(1, Math.round(s.elapsedMs / 60000)),
  };
}
export function validateGroupCard(value: unknown): GroupCard {
  const o = exact(value, [
    "schemaVersion",
    "recordType",
    "episodeId",
    "group",
    "escaped",
    "solved",
    "bonus",
    "hints",
    "minutes",
  ]);
  const int = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  if (
    o.schemaVersion !== 1 ||
    o.recordType !== "classroom-escape-group" ||
    !Object.hasOwn(EPISODES, o.episodeId as string) ||
    !int(o.group, 1, MAX_GROUP) ||
    typeof o.escaped !== "boolean" ||
    !int(o.solved, 0, PUZZLES.length) ||
    !int(o.bonus, 0, BONUSES.length) ||
    !int(o.hints, 0, 18) ||
    !int(o.minutes, 1, 600) ||
    (o.escaped && o.solved !== PUZZLES.length)
  )
    throw new Error("모둠 기록 카드 형식이 아니에요.");
  return o as unknown as GroupCard;
}
export interface ClassBoard {
  cards: GroupCard[];
  messages: string[];
}
/** Adds cards; a second card for the same group replaces the first, and says so. */
export function addGroupCards(
  board: ClassBoard,
  files: { name: string; text: string }[],
): ClassBoard {
  const cards = [...board.cards];
  const messages = [...board.messages];
  for (const file of files) {
    try {
      if (file.text.length > 4096) throw new Error("파일이 너무 커요.");
      const card = validateGroupCard(JSON.parse(file.text));
      const at = cards.findIndex((c) => c.group === card.group);
      if (at >= 0) {
        cards[at] = card;
        messages.push(`${card.group}모둠 카드를 새 카드로 바꿨어요.`);
      } else cards.push(card);
    } catch (e) {
      messages.push(
        `${file.name}: ${e instanceof Error && e.message.includes("모둠") ? e.message : "모둠 기록 카드 형식이 아니에요."}`,
      );
    }
  }
  cards.sort((a, b) => a.group - b.group);
  return { cards, messages };
}
/** Shared highlights: the whole class's effort, not a ranking of groups. */
export function boardSummary(cards: GroupCard[]) {
  return {
    groups: cards.length,
    escaped: cards.filter((c) => c.escaped).length,
    bonus: cards.reduce((n, c) => n + c.bonus, 0),
    noHints: cards.filter((c) => c.escaped && c.hints === 0).length,
  };
}
