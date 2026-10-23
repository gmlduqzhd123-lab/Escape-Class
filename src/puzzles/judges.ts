import type { Progress, Place } from "../game/model";
export const SUCCESS_PATH = [
  [1, 3],
  [1, 2],
  [1, 1],
  [2, 1],
  [3, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  [3, 5],
  [4, 5],
  [5, 5],
  [5, 4],
  [5, 3],
];
export const WALLS = [6, 8, 16, 18];
export const FRIENDS: Record<number, string> = {
  0: "토끼",
  2: "여우",
  22: "곰",
  24: "다람쥐",
};
export const toIndex = (x: number, y: number) => (y - 1) * 5 + x - 1;
export function adjacent(a: number, b: number) {
  return (
    Math.abs((a % 5) - (b % 5)) +
      Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) ===
    1
  );
}
export function routeArrows(path: number[]) {
  const arrows = Array(25).fill(0);
  path.slice(0, -1).forEach((cell, i) => {
    const next = path[i + 1];
    arrows[cell] =
      next === cell + 1 ? 0 : next === cell + 5 ? 1 : next === cell - 1 ? 2 : 3;
  });
  return arrows;
}
export function recoverLegacyPath(arrows: number[]) {
  const trace = runBall(arrows).path;
  const path: number[] = [];
  for (const cell of trace) {
    if (WALLS.includes(cell) || path.includes(cell)) break;
    path.push(cell);
  }
  return path.length ? path : [10];
}
export function extendPath(path: number[], cell: number) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 24 || WALLS.includes(cell))
    return { ok: false, message: "벽은 지나갈 수 없어요." };
  if (path.includes(cell))
    return {
      ok: false,
      message: "같은 칸은 두 번 지날 수 없어요. 한 칸 취소로 길을 고쳐요.",
    };
  if (path.at(-1) === 14 || !adjacent(path.at(-1)!, cell))
    return { ok: false, message: "공이 있는 칸의 바로 옆 칸을 눌러요." };
  return { ok: true, message: "" };
}
export function judgeP1(s: Progress) {
  return (
    ["P1-C1", "P1-C3", "P1-C5"].every((id) =>
      s.discoveredClueIds.includes(id),
    ) && s.puzzles.p1.order.join(",") === "P1-C1,P1-C3,P1-C5"
  );
}
export function judgeP2(s: Progress) {
  const p = s.puzzles.p2;
  return (
    s.solvedPuzzleIds.includes("P1") &&
    p.lensUsed !== null &&
    s.inventory.includes(p.lensUsed) &&
    p.rotation === 0 &&
    p.code === "713"
  );
}
export function lensWindows(rotation: number) {
  return [
    [1, 1],
    [3, 2],
    [2, 3],
  ].map(([x, y]) => {
    for (let i = 0; i < rotation / 90; i++) [x, y] = [4 - y, x];
    return [x, y];
  });
}
export function runBall(arrows: number[]) {
  const path: number[] = [];
  const visited = new Set<number>();
  const met = new Set<string>();
  let x = 1,
    y = 3;
  for (let n = 0; n < 26; n++) {
    if (x < 1 || x > 5 || y < 1 || y > 5)
      return {
        ok: false,
        path,
        met: [...met],
        message: `범위 이탈: (${x},${y})에서 놀이판 밖으로 나갔어요.`,
      };
    const i = toIndex(x, y);
    if (WALLS.includes(i))
      return {
        ok: false,
        path: [...path, i],
        met: [...met],
        message: `벽 충돌: (${x},${y})의 벽을 피해요.`,
      };
    if (visited.has(i))
      return {
        ok: false,
        path: [...path, i],
        met: [...met],
        message: `반복 경로: (${x},${y})를 다시 지났어요.`,
      };
    visited.add(i);
    path.push(i);
    if (FRIENDS[i]) met.add(FRIENDS[i]);
    if (i === 14) {
      const missing = Object.values(FRIENDS).filter((f) => !met.has(f));
      return {
        ok: missing.length === 0,
        path,
        met: [...met],
        message: missing.length
          ? `아직 공을 받지 못한 친구: ${missing.join(", ")}. 네 친구를 모두 만나요.`
          : "네 친구를 모두 만나 골대에 도착했어요!",
      };
    }
    const dir = arrows[i];
    if (!Number.isInteger(dir) || dir < 0 || dir > 3)
      return {
        ok: false,
        path,
        met: [...met],
        message: "화살표 방향을 확인해요.",
      };
    x += [1, 0, -1, 0][dir];
    y += [0, 1, 0, -1][dir];
  }
  return {
    ok: false,
    path,
    met: [...met],
    message: "최대 이동 수에 도달했어요.",
  };
}
export function solutionArrows() {
  const arrows = Array(25).fill(0);
  SUCCESS_PATH.slice(0, -1).forEach(([x, y], n) => {
    const [nx, ny] = SUCCESS_PATH[n + 1];
    arrows[toIndex(x, y)] = nx > x ? 0 : ny > y ? 1 : nx < x ? 2 : 3;
  });
  return arrows;
}
export function judgeP4(p: Progress["puzzles"]["p4"]) {
  return (
    !p["photo-1"] &&
    !p["photo-2"] &&
    p["help-1"] &&
    (p["help-2"] || p["help-3"])
  );
}
export const ADJACENCY: Record<Place, Place[]> = {
  교실: ["복도"],
  복도: ["교실", "담임 자리", "교무실", "상담실"],
  "담임 자리": ["복도"],
  교무실: ["복도"],
  상담실: ["복도"],
};
export function judgeP5(p: Progress["puzzles"]["p5"]) {
  return (
    ["교무실", "상담실"].includes(p.place) &&
    p.sentence[0] === "R0" &&
    (p.sentence.includes("R1") || p.sentence.includes("R2"))
  );
}
export function judgeFinal(s: Progress) {
  return (
    s.solvedPuzzleIds.length === 5 &&
    s.puzzles.final.order.join(",") === "F1,F2,F3,F4,F5" &&
    s.puzzles.final.rotations.every((x) => x === 0)
  );
}
