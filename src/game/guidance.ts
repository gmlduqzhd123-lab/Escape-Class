import { active, unlocked, type Progress } from "./model";
import { assistProgress, type Experience } from "./learning";
import { FRIENDS } from "../puzzles/judges";

export const GUIDED_ROUTE = [10, 5, 0, 1, 2, 7, 12, 17, 22, 23, 24, 19, 14];
export function nextGuidedRoute(path: number[]) {
  let shared = 0;
  while (shared < path.length && path[shared] === GUIDED_ROUTE[shared])
    shared++;
  let end = Math.max(1, shared);
  while (end < GUIDED_ROUTE.length) {
    const cell = GUIDED_ROUTE[end++];
    if (Object.hasOwn(FRIENDS, cell) || cell === 14) break;
  }
  return GUIDED_ROUTE.slice(0, end);
}
export function useEasyMode(s: Progress, e: Experience) {
  if (s.phase === "escaped") return false;
  e.options = {
    ...e.options,
    grade: "guided",
    cooperation: false,
    hints: "suggest",
  };
  e.coopSolved = false;
  e.coopCode = "";
  s.roundId = null;
  if (!s.solvedPuzzleIds.includes("P1"))
    s.puzzles.p1.order = s.discoveredClueIds.includes("P1-C1") ? ["P1-C1"] : [];
  assistProgress(s, e);
  return true;
}
export function guidedNetwork(
  s: Progress,
  e: Experience,
  choice: "photo" | "help",
) {
  if (
    !active(s) ||
    e.options.grade !== "guided" ||
    e.options.episode === "gym" ||
    !unlocked(s, "P4") ||
    s.solvedPuzzleIds.includes("P4")
  )
    return false;
  if (choice === "photo") {
    s.puzzles.p4["photo-1"] = false;
    s.puzzles.p4["photo-2"] = false;
  } else {
    if (s.puzzles.p4["photo-1"] || s.puzzles.p4["photo-2"]) return false;
    s.puzzles.p4["help-1"] = true;
    s.puzzles.p4["help-2"] = true;
    s.puzzles.p4["help-3"] = false;
  }
  return true;
}
