import type { Progress } from "./model";
import { type EpisodeId, episode, EPISODES } from "../content/episodes";
export type LessonOptions = {
  grade: "guided" | "standard";
  minutes: 15 | 25 | 40;
  hints: "suggest" | "request";
  cooperation: boolean;
  episode: EpisodeId;
};
export const DEFAULT_LESSON: LessonOptions = {
  grade: "standard",
  minutes: 25,
  hints: "suggest",
  cooperation: true,
  episode: "classroom",
};
export const ROLES = ["관찰", "읽기", "설명", "조작"] as const;
export const PLEDGES = [
  "친구의 말을 끝까지 듣고 물어볼게요.",
  "물건을 쓰기 전에 허락을 구할게요.",
  "함께하고 싶은 친구에게 자리를 나눌게요.",
  "사진을 보내기 전에 친구에게 확인할게요.",
  "도움이 필요하면 믿을 수 있는 어른에게 말할게요.",
];
export const STOPS = [
  "center",
  "middle",
  "front",
  "plant",
  "door",
  "basket",
  "tools",
  "lockers",
  "tablet",
  "desk",
  "back",
  "books",
];
export type ScenePose = { stop: string; yaw: number; pitch: number };
export type Experience = {
  version: 1;
  options: LessonOptions;
  roleShift: number;
  viewedRoles: number[];
  coopCode: string;
  coopSolved: boolean;
  pledge: number | null;
  view: {
    objectId: string | null;
    device: "main" | "bonus";
    selected: string | null;
    sceneMode: "2d" | "3d";
    pose: ScenePose | null;
  };
};
export function createExperience(
  options: LessonOptions = { ...DEFAULT_LESSON },
): Experience {
  return {
    version: 1,
    options: { ...options },
    roleShift: 0,
    viewedRoles: [],
    coopCode: "",
    coopSolved: false,
    pledge: null,
    view: {
      objectId: null,
      device: "main",
      selected: null,
      sceneMode: "3d",
      pose: null,
    },
  };
}
export function validateExperience(value: unknown): Experience {
  const v = value as Experience;
  if (
    !v ||
    v.version !== 1 ||
    !["guided", "standard"].includes(v.options?.grade) ||
    ![15, 25, 40].includes(v.options.minutes) ||
    !["suggest", "request"].includes(v.options.hints) ||
    typeof v.options.cooperation !== "boolean" ||
    !Object.hasOwn(EPISODES, v.options.episode)
  )
    throw Error("수업 설정을 복원할 수 없어요.");
  if (
    !Number.isInteger(v.roleShift) ||
    v.roleShift < 0 ||
    v.roleShift > 3 ||
    !Array.isArray(v.viewedRoles) ||
    new Set(v.viewedRoles).size !== v.viewedRoles.length ||
    v.viewedRoles.some((n) => !Number.isInteger(n) || n < 0 || n > 3) ||
    !/^\d{0,3}$/.test(v.coopCode) ||
    typeof v.coopSolved !== "boolean" ||
    (v.pledge !== null &&
      (!Number.isInteger(v.pledge) ||
        v.pledge < 0 ||
        v.pledge >= PLEDGES.length))
  )
    throw Error("모둠 기록 오류");
  const w = v.view;
  if (
    !w ||
    !["main", "bonus"].includes(w.device) ||
    !["2d", "3d"].includes(w.sceneMode) ||
    (w.objectId !== null && !/^O(0[1-9]|1[0-2])$/.test(w.objectId)) ||
    (w.selected !== null &&
      !["shared-lens", "borrowed-lens", "final-key"].includes(w.selected))
  )
    throw Error("화면 기록 오류");
  if (
    w.pose &&
    (!STOPS.includes(w.pose.stop) ||
      !Number.isFinite(w.pose.yaw) ||
      Math.abs(w.pose.yaw) > Math.PI + 0.001 ||
      !Number.isFinite(w.pose.pitch) ||
      Math.abs(w.pose.pitch) > 1.4)
  )
    throw Error("위치 기록 오류");
  if (
    v.coopSolved &&
    (v.coopCode !== cooperationAnswer(v) ||
      !v.viewedRoles.includes(0) ||
      !v.viewedRoles.includes(1))
  )
    throw Error("협동 기록 오류");
  return structuredClone(v);
}
export function cooperationAnswer(e: Experience) {
  const digits: Record<string, string> = { 별: "4", 하트: "2", 원: "6" };
  return episode(e.options.episode)
    .coopSequence.slice(0, e.options.grade === "guided" ? 2 : 3)
    .map((symbol) => digits[symbol])
    .join("");
}
export function checkCooperation(e: Experience) {
  return (
    e.viewedRoles.includes(0) &&
    e.viewedRoles.includes(1) &&
    e.coopCode === cooperationAnswer(e)
  );
}
export function roleAssignments(
  e: Experience,
  s: Pick<Progress, "solvedPuzzleIds">,
) {
  const turn = (s.solvedPuzzleIds.length + e.roleShift) % 4;
  return ROLES.map((role, i) => ({ role, student: ((i + turn) % 4) + 1 }));
}
export function isPracticeLesson(o: LessonOptions) {
  return o.grade === "guided" || o.cooperation || o.episode !== "classroom";
}
export function shouldSuggestHint(
  idleMs: number,
  mistakes: number,
  o: LessonOptions,
) {
  return (
    o.hints === "suggest" &&
    (mistakes >= 3 || idleMs >= (o.grade === "guided" ? 60000 : 90000))
  );
}
export function assistProgress(s: Progress, e: Experience) {
  if (e.options.grade !== "guided") return;
  if (
    s.discoveredClueIds.includes("P1-C1") &&
    !s.solvedPuzzleIds.includes("P1") &&
    !s.puzzles.p1.order.length
  )
    s.puzzles.p1.order = ["P1-C1"];
  if (s.puzzles.p2.lensUsed && !s.solvedPuzzleIds.includes("P2"))
    s.puzzles.p2.rotation = 0;
}
export function progressMarker(s: Progress) {
  return `${s.solvedPuzzleIds.length}:${s.foundBonusIds.length}:${s.finalCombined}:${s.finalKeyObtained}`;
}
export function practiceCard(e: Experience) {
  const pledge = PLEDGES[e.pledge ?? 0];
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>우리 모둠의 작은 실천</title><style>body{font-family:system-ui,'Malgun Gothic',sans-serif;background:#f8f6ee;color:#254e45;padding:32px}article{border:3px solid #6b8654;border-radius:24px;padding:36px;max-width:720px;margin:auto;background:#fffef8}h1{font-size:32px}p{font-size:26px;line-height:1.8}.small{font-size:16px}@media print{body{padding:0;background:white}article{break-inside:avoid}}</style><article><p class="small">${episode(e.options.episode).title} · 함께 정한 약속</p><h1>우리 모둠의 작은 실천</h1><p>${pledge}</p><p class="small">서로 실천한 순간을 발견하면 고마운 마음을 전해요.</p><p class="small">개인 이름·점수·학생 평가를 넣지 않은 모둠 활동 카드입니다.</p></article></html>`;
}
