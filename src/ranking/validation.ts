import { PUZZLES, BONUSES, type GameConfig, type School } from "../game/model";
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function object(value: unknown): Record<string, unknown> {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "JSON 객체가 필요해요.",
  );
  return value as Record<string, unknown>;
}
export function exact(value: unknown, keys: string[]) {
  const o = object(value);
  assert(
    Object.keys(o).length === keys.length &&
      keys.every((k) => Object.hasOwn(o, k)),
    "허용되지 않은 필드 또는 빠진 필드가 있어요.",
  );
  return o;
}
export function nonempty(v: unknown, max = 120): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
export function ids(
  v: unknown,
  allowed: readonly string[],
  label: string,
): string[] {
  assert(
    Array.isArray(v) &&
      v.every((x) => typeof x === "string" && allowed.includes(x)),
    `${label}: 허용되지 않은 ID예요.`,
  );
  assert(new Set(v).size === v.length, `${label}: 중복 ID가 있어요.`);
  return v;
}
export function validateConfig(v: unknown): GameConfig {
  const o = exact(v, [
    "schemaVersion",
    "episodeId",
    "difficultyId",
    "contentVersion",
    "activeRound",
  ]);
  assert(
    o.schemaVersion === 1 &&
      o.episodeId === "ep01" &&
      o.difficultyId === "standard" &&
      o.contentVersion === "ep01-1.0.0",
    "지원하지 않는 설정·콘텐츠 버전이에요.",
  );
  if (o.activeRound !== null) {
    const r = exact(o.activeRound, ["roundId", "label", "acceptingResults"]);
    assert(
      nonempty(r.roundId) &&
        nonempty(r.label) &&
        typeof r.acceptingResults === "boolean",
      "공식 회차 설정이 올바르지 않아요.",
    );
  }
  return o as unknown as GameConfig;
}
export function validateSchools(v: unknown): School[] {
  assert(
    Array.isArray(v) && v.length <= 100000,
    "학교 목록은 배열이어야 해요.",
  );
  const seen = new Set<string>();
  for (const row of v) {
    const r = exact(row, ["schoolId", "name"]);
    assert(
      nonempty(r.schoolId) && nonempty(r.name),
      "학교 ID와 이름을 확인해요.",
    );
    assert(!seen.has(r.schoolId), "중복 학교 ID예요.");
    seen.add(r.schoolId);
  }
  return v as School[];
}
export interface ResultFile {
  schemaVersion: 1;
  recordType: "classroom-escape-result";
  episodeId: string;
  roundId: string;
  difficultyId: string;
  contentVersion: string;
  schoolId: string;
  solvedPuzzleIds: string[];
  foundBonusIds: string[];
  escaped: true;
}
export interface RankingRow {
  schoolId: string;
  score: number;
  bonusCount: number;
  escaped: true;
}
export interface RankingFile {
  schemaVersion: 1;
  episodeId: string;
  roundId: string | null;
  difficultyId: string;
  contentVersion: string;
  updatedAt: string | null;
  records: RankingRow[];
}
function matching(o: Record<string, unknown>, config: GameConfig) {
  assert(
    o.schemaVersion === 1 &&
      o.episodeId === config.episodeId &&
      o.difficultyId === config.difficultyId &&
      o.contentVersion === config.contentVersion,
    "스키마·에피소드·난이도·콘텐츠 버전이 일치하지 않아요.",
  );
}
export function currentRound(config: GameConfig | null): string {
  assert(
    config?.activeRound?.acceptingResults,
    "접수 중인 공식 회차와 유효한 설정이 필요해요.",
  );
  return config.activeRound.roundId;
}
export function validateResult(
  v: unknown,
  config: GameConfig,
  schools: School[],
): ResultFile {
  const o = exact(v, [
    "schemaVersion",
    "recordType",
    "episodeId",
    "roundId",
    "difficultyId",
    "contentVersion",
    "schoolId",
    "solvedPuzzleIds",
    "foundBonusIds",
    "escaped",
  ]);
  matching(o, config);
  assert(
    o.recordType === "classroom-escape-result" && o.escaped === true,
    "탈출 완료 결과 파일이 아니에요.",
  );
  assert(o.roundId === currentRound(config), "현재 접수 회차와 다른 결과예요.");
  assert(
    schools.some((s) => s.schoolId === o.schoolId),
    "등록되지 않은 학교예요.",
  );
  assert(
    ids(o.solvedPuzzleIds, PUZZLES, "완료 퍼즐").length === 5,
    "P1~P5를 모두 정확히 한 번 포함해야 해요.",
  );
  ids(o.foundBonusIds, BONUSES, "추가 단서");
  return o as unknown as ResultFile;
}
export function validateRanking(
  v: unknown,
  config: GameConfig,
  schools: School[],
  forAggregation = false,
): RankingFile {
  const o = exact(v, [
    "schemaVersion",
    "episodeId",
    "roundId",
    "difficultyId",
    "contentVersion",
    "updatedAt",
    "records",
  ]);
  matching(o, config);
  assert(o.roundId === null || nonempty(o.roundId), "순위 회차 ID를 확인해요.");
  assert(
    o.updatedAt === null ||
      (typeof o.updatedAt === "string" &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(o.updatedAt) &&
        Number.isFinite(Date.parse(o.updatedAt))),
    "게시본 생성 시각을 확인해요.",
  );
  assert(
    Array.isArray(o.records) && o.records.length <= schools.length,
    "순위 행 개수를 확인해요.",
  );
  assert(
    o.roundId !== null || o.records.length === 0,
    "연습 순위에는 공식 기록이 있을 수 없어요.",
  );
  assert(
    o.records.length === 0 || o.updatedAt !== null,
    "공식 기록에는 게시본 갱신일이 필요해요.",
  );
  if (forAggregation)
    assert(
      o.roundId === currentRound(config),
      "현재 회차의 순위 파일만 합칠 수 있어요.",
    );
  const seen = new Set();
  for (const row of o.records) {
    const r = exact(row, ["schoolId", "score", "bonusCount", "escaped"]);
    assert(
      schools.some((s) => s.schoolId === r.schoolId),
      "등록되지 않은 학교예요.",
    );
    assert(!seen.has(r.schoolId), "같은 학교의 순위가 중복돼요.");
    seen.add(r.schoolId);
    assert(
      Number.isInteger(r.bonusCount) &&
        (r.bonusCount as number) >= 0 &&
        (r.bonusCount as number) <= 4,
      "bonusCount는 0~4 정수여야 해요.",
    );
    assert(
      Number.isInteger(r.score) &&
        r.score === 80 + 5 * (r.bonusCount as number) &&
        r.escaped === true,
      "점수 또는 탈출 상태가 올바르지 않아요.",
    );
  }
  return o as unknown as RankingFile;
}
export function rankedRows(file: RankingFile, schools: School[]) {
  const rows = file.records
    .map((r) => ({
      ...r,
      name: schools.find((s) => s.schoolId === r.schoolId)?.name ?? r.schoolId,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ko"));
  return rows.map((r, i) => ({
    ...r,
    rank: rows.findIndex((x) => x.score === r.score) + 1,
  }));
}
