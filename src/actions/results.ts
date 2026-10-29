import type { ViewContext } from "../ui/views";
import {
  parseLocalFile,
  mergeEntry,
  resolveConflict,
  aggregateFile,
  MAX_FILES,
} from "../tools/aggregate";
import { download } from "../ui/files";

// The operator's result-file aggregation on #/tools/results. Selected files stay
// on this device; a changed round or school list discards a half-built aggregate.
export interface ResultsHost {
  c: ViewContext;
  data: () => Promise<void>;
  say: (message: string) => void;
  render: () => void;
}
export function createResultsTools(host: ResultsHost) {
  const { c } = host;
  let toolContext = "";
  const contextId = () => JSON.stringify([c.config, c.schools]);
  function reset() {
    c.aggregate = { records: [], conflicts: [], messages: [] };
    c.importErrors = [];
    toolContext = contextId();
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length || c.importBusy) return;
    if (files.length > MAX_FILES) {
      host.say("한 번에 최대 100개 파일을 선택해요.");
      return;
    }
    const old = contextId();
    await host.data();
    if (old !== contextId()) {
      reset();
      host.render();
      host.say("설정이 바뀌었어요. 파일을 다시 선택해 주세요.");
      return;
    }
    if (!c.config?.activeRound?.acceptingResults) {
      host.say("접수 중인 공식 회차가 필요해요.");
      return;
    }
    if (!toolContext) toolContext = contextId();
    c.importBusy = true;
    host.render();
    for (const file of files) {
      try {
        if (file.size > 100 * 1024) throw new Error("100KB를 초과했어요.");
        const rows = parseLocalFile(
          await file.text(),
          file.size,
          c.config,
          c.schools,
        );
        for (const row of rows)
          mergeEntry(c.aggregate, { name: file.name, row });
      } catch (e) {
        c.importErrors.push(
          `${file.name}: ${e instanceof Error ? e.message : "파일 오류"}`,
        );
      }
    }
    c.importBusy = false;
    host.render();
    host.say("선택한 파일의 검증을 마쳤어요. 오류 파일은 반영하지 않았어요.");
  }
  async function action(action: string, value: string): Promise<boolean> {
    switch (action) {
      case "conflict": {
        const [index, choice] = value.split(":");
        if (choice === "keep" || choice === "replace")
          resolveConflict(c.aggregate, Number(index), choice);
        host.render();
        return true;
      }
      case "reset-import":
        reset();
        host.render();
        return true;
      case "aggregate-download": {
        const previous = toolContext;
        await host.data();
        if (previous && previous !== contextId()) {
          reset();
          host.render();
          host.say("설정이 바뀌었어요. 현재 회차 파일을 다시 선택해 주세요.");
          return true;
        }
        try {
          if (!c.config) throw new Error("유효한 현재 설정이 필요해요.");
          download(
            aggregateFile(c.aggregate, c.config, c.schools),
            "rankings.json",
          );
          host.say(
            "새 순위 파일을 로컬로 저장했어요. 운영자가 확인한 뒤 저장소에 반영해 주세요.",
          );
        } catch (e) {
          host.say(e instanceof Error ? e.message : "순위 생성 오류");
        }
        host.render();
        return true;
      }
    }
    return false;
  }
  return { contextId, reset, importFiles, action };
}
