import {
  PUZZLES,
  BONUSES,
  CARDS,
  ITEMS,
  PRACTICE_CONFIG,
  score,
  unlocked,
  type Progress,
  type GameConfig,
  type School,
} from "../game/model";
import { assert, exact, ids, nonempty, object } from "../ranking/validation";
import { OBJECTS } from "../content/data";
import {
  judgeP1,
  judgeP2,
  runBall,
  judgeP4,
  judgeP5,
  judgeFinal,
  recoverLegacyPath,
  adjacent,
  WALLS,
} from "../puzzles/judges";
export const saveKey = (base: string) => `classroom-escape:${base}:progress:v1`;
export const SAVE_WARNING =
  "현재 기기에서 이어하기 저장을 사용할 수 없어요. 지금 활동은 계속할 수 있어요.";
export function validateProgress(
  v: unknown,
  config: GameConfig = PRACTICE_CONFIG,
  schools: School[] | null = null,
): Progress {
  const o = exact(structuredClone(v), [
    "schemaVersion",
    "episodeId",
    "difficultyId",
    "contentVersion",
    "roundId",
    "schoolId",
    "phase",
    "paused",
    "solvedPuzzleIds",
    "foundBonusIds",
    "discoveredClueIds",
    "inventory",
    "puzzles",
    "finalCombined",
    "finalKeyObtained",
    "exitUsed",
    "frozenScore",
    "elapsedMs",
    "settings",
    "hints",
  ]);
  assert(
    o.schemaVersion === 1 &&
      o.episodeId === config.episodeId &&
      o.difficultyId === config.difficultyId &&
      o.contentVersion === config.contentVersion,
    "저장된 콘텐츠 버전이 호환되지 않아요.",
  );
  assert(o.roundId === null || nonempty(o.roundId), "저장 회차 ID 오류예요.");
  assert(
    o.schoolId === null ||
      (nonempty(o.schoolId) &&
        (schools === null || schools.some((s) => s.schoolId === o.schoolId))),
    "저장 학교가 목록에 없어요.",
  );
  assert(
    ["intro", "playing", "finalReady", "escaped"].includes(o.phase as string) &&
      typeof o.paused === "boolean",
    "저장 진행 단계 오류예요.",
  );
  ids(o.solvedPuzzleIds, PUZZLES, "완료 퍼즐");
  ids(o.foundBonusIds, BONUSES, "추가 단서");
  ids(o.discoveredClueIds, [...OBJECTS.map((x) => x.id), ...CARDS], "단서");
  ids(o.inventory, ITEMS, "가방");
  const p = exact(o.puzzles, [
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "final",
    "b3",
    "b4",
  ]);
  const p1 = exact(p.p1, ["order", "flipped"]);
  ids(p1.order, CARDS, "카드 순서");
  ids(p1.flipped, CARDS, "뒤집은 카드");
  assert((p1.order as string[]).length <= 3, "P1 배치는 세 장까지예요.");
  const p2 = exact(p.p2, ["lensUsed", "rotation", "code"]);
  assert(
    p2.lensUsed === null ||
      ["borrowed-lens", "shared-lens"].includes(p2.lensUsed as string),
    "렌즈 ID 오류예요.",
  );
  assert(
    [0, 90, 180, 270].includes(p2.rotation as number) &&
      typeof p2.code === "string" &&
      /^\d{0,3}$/.test(p2.code),
    "암호판 조작 값 오류예요.",
  );
  // Old saves keep their arrows and completion record; only the route UI is derived.
  const legacy = object(p.p3);
  if (
    !Object.hasOwn(legacy, "path") &&
    Array.isArray(legacy.arrows) &&
    legacy.arrows.length === 25 &&
    legacy.arrows.every((x) => Number.isInteger(x) && x >= 0 && x <= 3)
  )
    legacy.path = (o.solvedPuzzleIds as string[]).includes("P2")
      ? recoverLegacyPath(legacy.arrows as number[])
      : [10];
  const p3 = exact(p.p3, ["arrows", "path"]);
  assert(
    Array.isArray(p3.arrows) &&
      p3.arrows.length === 25 &&
      p3.arrows.every((x) => Number.isInteger(x) && x >= 0 && x <= 3),
    "화살표 배열 오류예요.",
  );
  assert(
    Array.isArray(p3.path) &&
      p3.path.length >= 1 &&
      p3.path.length <= 25 &&
      p3.path[0] === 10 &&
      new Set(p3.path).size === p3.path.length &&
      p3.path.every(
        (cell, i, path) =>
          Number.isInteger(cell) &&
          cell >= 0 &&
          cell < 25 &&
          !WALLS.includes(cell) &&
          (i === 0 || adjacent(path[i - 1], cell)) &&
          (cell !== 14 || i === path.length - 1),
      ),
    "공 경로의 칸·순서 오류예요.",
  );
  assert(
    (p3.path as number[]).slice(0, -1).every((cell, i) => {
      const next = (p3.path as number[])[i + 1];
      return (
        (p3.arrows as number[])[cell] ===
        (next === cell + 1
          ? 0
          : next === cell + 5
            ? 1
            : next === cell - 1
              ? 2
              : 3)
      );
    }),
    "공 경로와 화살표가 일치하지 않아요.",
  );
  const p4 = exact(p.p4, ["photo-1", "photo-2", "help-1", "help-2", "help-3"]);
  assert(
    Object.values(p4).every((x) => typeof x === "boolean"),
    "스위치 값 오류예요.",
  );
  const p5 = exact(p.p5, ["place", "sentence"]);
  assert(
    ["교실", "복도", "담임 자리", "교무실", "상담실"].includes(
      p5.place as string,
    ),
    "지도 장소 오류예요.",
  );
  ids(p5.sentence, ["R0", "R1", "R2"], "문장");
  const f = exact(p.final, ["order", "rotations"]);
  ids(f.order, ["F1", "F2", "F3", "F4", "F5"], "조각 순서");
  assert(
    Array.isArray(f.rotations) &&
      f.rotations.length === 5 &&
      f.rotations.every((x) => [0, 90, 180, 270].includes(x)),
    "조각 회전 오류예요.",
  );
  ids(p.b3, ["1", "2", "3"], "초대장");
  assert(
    typeof p.b4 === "string" && /^\d{0,3}$/.test(p.b4),
    "출구 기호 입력 오류예요.",
  );
  for (const b of ["finalCombined", "finalKeyObtained", "exitUsed"])
    assert(typeof o[b] === "boolean", "저장 상태 값 오류예요.");
  assert(
    typeof o.elapsedMs === "number" &&
      Number.isFinite(o.elapsedMs) &&
      o.elapsedMs >= 0 &&
      o.elapsedMs <= 31536000000,
    "활동 시간 오류예요.",
  );
  const settings = exact(o.settings, ["sound", "reducedMotion"]);
  assert(
    typeof settings.sound === "boolean" &&
      typeof settings.reducedMotion === "boolean",
    "설정 값 오류예요.",
  );
  const hints = exact(o.hints, ["P1", "P2", "P3", "P4", "P5", "final"]);
  assert(
    Object.values(hints).every(
      (x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 3,
    ),
    "힌트 값 오류예요.",
  );
  const s = o as unknown as Progress;
  assert(
    s.solvedPuzzleIds.every((id, i) => id === PUZZLES[i]),
    "선행 퍼즐 완료 기록이 없어요.",
  );
  assert(
    s.puzzles.p1.order.every((id) => s.discoveredClueIds.includes(id)) &&
      s.puzzles.p1.flipped.every((id) => s.discoveredClueIds.includes(id)),
    "발견하지 않은 카드를 조작한 저장이에요.",
  );
  assert(
    s.puzzles.p2.lensUsed === null ||
      (s.inventory.includes(s.puzzles.p2.lensUsed) && unlocked(s, "P2")),
    "렌즈 보유·해금 조건 오류예요.",
  );
  assert(
    unlocked(s, "P2") ||
      (s.puzzles.p2.lensUsed === null &&
        s.puzzles.p2.rotation === 90 &&
        s.puzzles.p2.code === ""),
    "잠긴 암호판을 조작한 저장이에요.",
  );
  assert(
    unlocked(s, "P3") ||
      (s.puzzles.p3.arrows.every((x) => x === 0) &&
        s.puzzles.p3.path.join(",") === "10"),
    "잠긴 놀이판을 조작한 저장이에요.",
  );
  assert(
    unlocked(s, "P4") ||
      (s.puzzles.p4["photo-1"] &&
        s.puzzles.p4["photo-2"] &&
        !s.puzzles.p4["help-1"] &&
        !s.puzzles.p4["help-2"] &&
        !s.puzzles.p4["help-3"]),
    "잠긴 연결망을 조작한 저장이에요.",
  );
  assert(
    unlocked(s, "P5") ||
      (s.puzzles.p5.place === "교실" && s.puzzles.p5.sentence.length === 0),
    "잠긴 지도를 이동한 저장이에요.",
  );
  assert(
    s.solvedPuzzleIds.length === 5 ||
      (s.puzzles.final.order.length === 0 &&
        s.puzzles.final.rotations.every(
          (x, i) => x === [90, 180, 270, 90, 180][i],
        ) &&
        s.puzzles.b4 === ""),
    "마지막 장치의 해금 조건 오류예요.",
  );
  const judges = [
    () => judgeP1(s),
    () => judgeP2(s),
    () => runBall(s.puzzles.p3.arrows).ok,
    () => judgeP4(s.puzzles.p4),
    () => judgeP5(s.puzzles.p5),
  ];
  assert(
    s.solvedPuzzleIds.every((_, i) => judges[i]()),
    "완료한 퍼즐의 조작 상태와 판정이 일치하지 않아요.",
  );
  assert(!s.finalCombined || judgeFinal(s), "최종 조합의 선행 조건 오류예요.");
  assert(
    s.finalKeyObtained === s.inventory.includes("final-key") &&
      (!s.finalKeyObtained ||
        (s.finalCombined && s.discoveredClueIds.includes("O11"))),
    "마지막 열쇠 획득 조건 오류예요.",
  );
  assert(
    !s.foundBonusIds.includes("B4") || s.solvedPuzzleIds.includes("P5"),
    "B4 해금 조건 오류예요.",
  );
  assert(
    s.puzzles.final.order.length === 0 || s.solvedPuzzleIds.length === 5,
    "조각 조합판 해금 조건 오류예요.",
  );
  assert(
    s.phase !== "intro" ||
      (s.solvedPuzzleIds.length === 0 &&
        s.foundBonusIds.length === 0 &&
        s.inventory.length === 0 &&
        s.discoveredClueIds.length === 0),
    "시작 안내의 상태 오류예요.",
  );
  assert(
    (s.solvedPuzzleIds.length === 5) ===
      (s.phase === "finalReady" || s.phase === "escaped"),
    "진행 단계와 조각 수가 맞지 않아요.",
  );
  assert(
    s.exitUsed === (s.phase === "escaped"),
    "phase만으로 탈출 완료를 만들 수 없어요.",
  );
  assert(
    !s.exitUsed ||
      (s.finalCombined &&
        s.finalKeyObtained &&
        s.frozenScore === score(s) &&
        !s.paused),
    "출구 사용·확정 점수 조건 오류예요.",
  );
  assert(
    s.exitUsed || s.frozenScore === null,
    "탈출 전 점수가 확정되어 있어요.",
  );
  return structuredClone(s);
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function saveProgress(storage: StorageLike, key: string, s: Progress) {
  try {
    storage.setItem(key, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
export const SCHOOL_REMOVED_NOTICE =
  "선택했던 학교가 학교 목록에서 빠져서, 이어하기 기록을 연습 모드로 바꿨어요. 진행 상황은 그대로 남아 있어요.";
export function loadProgress(
  storage: StorageLike,
  key: string,
  config?: GameConfig,
  schools?: School[] | null,
): { state: Progress | null; error: string | null; notice?: string } {
  try {
    const raw = storage.getItem(key);
    if (!raw) return { state: null, error: null };
    assert(raw.length <= 100000, "저장 파일이 너무 커요.");
    const parsed = JSON.parse(raw);
    // A school removed from the list keeps its progress as practice instead of losing it.
    let notice: string | undefined;
    if (
      schools &&
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.schoolId === "string" &&
      !schools.some((s) => s.schoolId === parsed.schoolId)
    ) {
      parsed.schoolId = null;
      notice = SCHOOL_REMOVED_NOTICE;
    }
    const state = validateProgress(parsed, config, schools);
    if (state.phase !== "escaped") state.paused = true;
    return notice ? { state, error: null, notice } : { state, error: null };
  } catch (e) {
    return {
      state: null,
      error: e instanceof Error ? e.message : "이어하기 저장을 읽지 못했어요.",
    };
  }
}
export function eraseProgress(storage: StorageLike, key: string) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
