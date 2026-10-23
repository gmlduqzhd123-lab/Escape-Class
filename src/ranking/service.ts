import {
  PUZZLES,
  BONUSES,
  score,
  type Progress,
  type GameConfig,
  type School,
} from "../game/model";
import {
  validateConfig,
  validateSchools,
  validateRanking,
  type RankingFile,
  type ResultFile,
} from "./validation";
export const deploymentBase = () =>
  new URL(import.meta.env.BASE_URL, document.baseURI).pathname;
export const asset = (path: string) =>
  new URL(path, new URL(import.meta.env.BASE_URL, document.baseURI)).href;
export async function readJson(path: string) {
  const response = await fetch(asset(`data/${path}`), {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`읽기 실패 (${response.status})`);
  return response.json();
}
export async function readConfig() {
  return validateConfig(await readJson("game-config.json"));
}
export async function readSchools() {
  return validateSchools(await readJson("schools.json"));
}
export async function readRanking(config: GameConfig, schools: School[]) {
  return validateRanking(await readJson("rankings.json"), config, schools);
}
export function exportReason(
  s: Progress | null,
  config: GameConfig | null,
  schools: School[],
): string | null {
  if (
    !s ||
    s.phase !== "escaped" ||
    !s.exitUsed ||
    !s.finalCombined ||
    !s.finalKeyObtained ||
    !PUZZLES.every((p) => s.solvedPuzzleIds.includes(p)) ||
    s.frozenScore !== score(s)
  )
    return "열쇠를 출구에 사용해 탈출을 완료해야 해요.";
  if (!s.schoolId || !schools.some((x) => x.schoolId === s.schoolId))
    return "시작할 때 등록 학교를 선택한 기록이 필요해요.";
  if (!config) return "현재 설정을 읽지 못해 공식 내보내기를 사용할 수 없어요.";
  if (!config.activeRound?.acceptingResults)
    return "현재 접수 중인 공식 회차가 없어요. 연습 결과는 이 기기에서 확인하거나 인쇄할 수 있어요.";
  if (
    s.roundId !== config.activeRound.roundId ||
    s.episodeId !== config.episodeId ||
    s.difficultyId !== config.difficultyId ||
    s.contentVersion !== config.contentVersion
  )
    return "시작한 회차·콘텐츠가 현재 회차와 달라요. 현재 회차 참가에는 새 게임이 필요해요.";
  return null;
}
export function resultFile(
  s: Progress,
  config: GameConfig,
  schools: School[],
): ResultFile {
  const reason = exportReason(s, config, schools);
  if (reason) throw new Error(reason);
  return {
    schemaVersion: 1,
    recordType: "classroom-escape-result",
    episodeId: s.episodeId,
    roundId: s.roundId!,
    difficultyId: s.difficultyId,
    contentVersion: s.contentVersion,
    schoolId: s.schoolId!,
    solvedPuzzleIds: PUZZLES.filter((id) => s.solvedPuzzleIds.includes(id)),
    foundBonusIds: BONUSES.filter((id) => s.foundBonusIds.includes(id)),
    escaped: true,
  };
}
export function emptyRanking(config: GameConfig): RankingFile {
  return {
    schemaVersion: 1,
    episodeId: config.episodeId,
    roundId: config.activeRound?.roundId ?? null,
    difficultyId: config.difficultyId,
    contentVersion: config.contentVersion,
    updatedAt: null,
    records: [],
  };
}
