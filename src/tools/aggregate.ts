import type { GameConfig, School } from "../game/model";
import {
  currentRound,
  validateResult,
  validateRanking,
  type RankingFile,
  type RankingRow,
} from "../ranking/validation";
export const MAX_FILE_BYTES = 100 * 1024,
  MAX_FILES = 100;
export interface ImportEntry {
  name: string;
  row: RankingRow;
}
export interface Conflict {
  name: string;
  schoolId: string;
  existing: RankingRow;
  incoming: RankingRow;
  choice: null | "keep" | "replace";
}
export interface AggregateState {
  records: RankingRow[];
  conflicts: Conflict[];
  messages: string[];
}
export function parseLocalFile(
  text: string,
  bytes: number,
  config: GameConfig,
  schools: School[],
): RankingRow[] {
  currentRound(config);
  if (bytes > MAX_FILE_BYTES)
    throw new Error("파일 하나는 100KB 이하여야 해요.");
  const value = JSON.parse(text);
  if (value?.recordType === "classroom-escape-result") {
    const r = validateResult(value, config, schools);
    return [
      {
        schoolId: r.schoolId,
        score: 80 + 5 * r.foundBonusIds.length,
        bonusCount: r.foundBonusIds.length,
        escaped: true,
      },
    ];
  }
  return validateRanking(value, config, schools, true).records;
}
export function mergeEntry(state: AggregateState, entry: ImportEntry) {
  const old = state.records.find((r) => r.schoolId === entry.row.schoolId);
  if (!old) {
    state.records.push({ ...entry.row });
    state.messages.push(`${entry.name}: 추가했어요.`);
    return;
  }
  if (old.score === entry.row.score) {
    state.messages.push(`${entry.name}: 같은 결과 한 건만 유지해요.`);
    return;
  }
  if (
    state.conflicts.some(
      (c) =>
        c.schoolId === entry.row.schoolId &&
        c.incoming.score === entry.row.score,
    )
  ) {
    state.messages.push(`${entry.name}: 같은 충돌 후보 한 건만 유지해요.`);
    return;
  }
  state.conflicts.push({
    name: entry.name,
    schoolId: entry.row.schoolId,
    existing: { ...old },
    incoming: { ...entry.row },
    choice: null,
  });
}
export function resolveConflict(
  state: AggregateState,
  index: number,
  choice: "keep" | "replace",
) {
  const c = state.conflicts[index];
  if (!c) return;
  c.choice = choice;
  // Recompute in import order so every explicitly selected decision is reproducible.
}
export function aggregateFile(
  state: AggregateState,
  config: GameConfig,
  schools: School[],
): RankingFile {
  const roundId = currentRound(config);
  if (state.conflicts.some((c) => c.choice === null))
    throw new Error("모든 충돌에서 기존 유지 또는 새 결과 교체를 선택해요.");
  const records = state.records.map((r) => ({ ...r }));
  for (const c of state.conflicts)
    if (c.choice === "replace") {
      const i = records.findIndex((r) => r.schoolId === c.schoolId);
      records[i] = { ...c.incoming };
    }
  const file: RankingFile = {
    schemaVersion: 1,
    episodeId: config.episodeId,
    roundId,
    difficultyId: config.difficultyId,
    contentVersion: config.contentVersion,
    updatedAt: new Date().toISOString(),
    records: records.sort(
      (a, b) => b.score - a.score || a.schoolId.localeCompare(b.schoolId),
    ),
  };
  return validateRanking(file, config, schools, true);
}
