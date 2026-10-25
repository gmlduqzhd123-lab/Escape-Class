export const PUZZLES = ["P1", "P2", "P3", "P4", "P5"] as const;
export const BONUSES = ["B1", "B2", "B3", "B4"] as const;
export const CARDS = ["P1-C1", "P1-C2", "P1-C3", "P1-C4", "P1-C5"] as const;
export const ITEMS = ["borrowed-lens", "shared-lens", "final-key"] as const;
export type PuzzleId = (typeof PUZZLES)[number];
export type BonusId = (typeof BONUSES)[number];
export type ItemId = (typeof ITEMS)[number];
export type Place = "교실" | "복도" | "담임 자리" | "교무실" | "상담실";
export interface GameConfig {
  schemaVersion: 1;
  episodeId: "ep01";
  difficultyId: "standard";
  contentVersion: "ep01-1.0.0";
  activeRound: null | {
    roundId: string;
    label: string;
    acceptingResults: boolean;
  };
}
export interface School {
  schoolId: string;
  name: string;
}
export interface Progress {
  schemaVersion: 1;
  episodeId: string;
  difficultyId: string;
  contentVersion: string;
  roundId: string | null;
  schoolId: string | null;
  phase: "intro" | "playing" | "finalReady" | "escaped";
  paused: boolean;
  solvedPuzzleIds: PuzzleId[];
  foundBonusIds: BonusId[];
  discoveredClueIds: string[];
  inventory: ItemId[];
  puzzles: {
    p1: { order: string[]; flipped: string[] };
    p2: {
      lensUsed: "borrowed-lens" | "shared-lens" | null;
      rotation: number;
      code: string;
    };
    p3: { arrows: number[]; path: number[] };
    p4: {
      "photo-1": boolean;
      "photo-2": boolean;
      "help-1": boolean;
      "help-2": boolean;
      "help-3": boolean;
    };
    p5: { place: Place; sentence: string[] };
    final: { order: string[]; rotations: number[] };
    b3: string[];
    b4: string;
  };
  finalCombined: boolean;
  finalKeyObtained: boolean;
  exitUsed: boolean;
  frozenScore: number | null;
  elapsedMs: number;
  settings: { sound: boolean; reducedMotion: boolean };
  hints: Record<string, number>;
}
export const PRACTICE_CONFIG: GameConfig = {
  schemaVersion: 1,
  episodeId: "ep01",
  difficultyId: "standard",
  contentVersion: "ep01-1.0.0",
  activeRound: null,
};
export function createProgress(
  config: GameConfig,
  schoolId: string | null = null,
): Progress {
  return {
    schemaVersion: 1,
    episodeId: config.episodeId,
    difficultyId: config.difficultyId,
    contentVersion: config.contentVersion,
    roundId: config.activeRound?.acceptingResults
      ? config.activeRound.roundId
      : null,
    schoolId,
    phase: "intro",
    paused: false,
    solvedPuzzleIds: [],
    foundBonusIds: [],
    discoveredClueIds: [],
    inventory: [],
    puzzles: {
      p1: { order: [], flipped: [] },
      p2: { lensUsed: null, rotation: 90, code: "" },
      p3: { arrows: Array(25).fill(0), path: [10] },
      p4: {
        "photo-1": true,
        "photo-2": true,
        "help-1": false,
        "help-2": false,
        "help-3": false,
      },
      p5: { place: "교실", sentence: [] },
      final: { order: [], rotations: [90, 180, 270, 90, 180] },
      b3: [],
      b4: "",
    },
    finalCombined: false,
    finalKeyObtained: false,
    exitUsed: false,
    frozenScore: null,
    elapsedMs: 0,
    settings: { sound: false, reducedMotion: true },
    hints: { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, final: 0 },
  };
}
export function score(
  s: Pick<Progress, "solvedPuzzleIds" | "foundBonusIds">,
): number {
  return (
    new Set(s.solvedPuzzleIds.filter((x) => PUZZLES.includes(x))).size * 16 +
    new Set(s.foundBonusIds.filter((x) => BONUSES.includes(x))).size * 5
  );
}
export function active(s: Progress) {
  return !s.paused && (s.phase === "playing" || s.phase === "finalReady");
}
export function unlocked(s: Progress, id: PuzzleId) {
  const n = PUZZLES.indexOf(id);
  return PUZZLES.slice(0, n).every((p) => s.solvedPuzzleIds.includes(p));
}
