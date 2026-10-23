import {
  active,
  unlocked,
  score,
  PUZZLES,
  type Progress,
  type PuzzleId,
  type BonusId,
  type ItemId,
  type Place,
} from "./model";
import {
  judgeP1,
  judgeP2,
  runBall,
  judgeP4,
  judgeP5,
  judgeFinal,
  ADJACENCY,
} from "../puzzles/judges";
import { OBJECTS } from "../content/data";
export interface Outcome {
  ok: boolean;
  message: string;
}
const outcome = (ok: boolean, message: string): Outcome => ({ ok, message });
export function inspect(s: Progress, id: string) {
  if (!active(s) || !OBJECTS.some((o) => o.id === id)) return;
  const clues =
    id === "O02"
      ? ["P1-C1", "P1-C2", "P1-C4", "P1-C5"]
      : id === "O03"
        ? ["P1-C3"]
        : [];
  for (const c of [id, ...clues])
    if (!s.discoveredClueIds.includes(c)) s.discoveredClueIds.push(c);
  if (id === "O11" && s.finalCombined) {
    s.finalKeyObtained = true;
    if (!s.inventory.includes("final-key")) s.inventory.push("final-key");
  }
}
export function takeLens(s: Progress, item: ItemId) {
  if (
    active(s) &&
    ["borrowed-lens", "shared-lens"].includes(item) &&
    !s.inventory.includes(item)
  )
    s.inventory.push(item);
}
export function applyItem(
  s: Progress,
  item: ItemId | null,
  target: string,
): Outcome {
  if (!active(s) || !item || !s.inventory.includes(item))
    return outcome(false, "가방에서 사용할 아이템을 먼저 골라요.");
  if (target === "O04" && item !== "final-key" && unlocked(s, "P2")) {
    s.puzzles.p2.lensUsed = item;
    return outcome(
      true,
      "렌즈를 사용했어요. ▲ 위 표시를 맞추고 창의 숫자를 읽어요.",
    );
  }
  return outcome(
    false,
    item === "final-key"
      ? "열쇠는 출구에 사용해요. 아이템은 가방에 그대로 있어요."
      : "이곳에 쓰는 도구가 아니에요. 아이템은 가방에 그대로 있어요.",
  );
}
export function solve(s: Progress, id: PuzzleId): Outcome {
  if (!active(s) || !unlocked(s, id))
    return outcome(false, "앞의 우정 조각을 먼저 찾아요.");
  if (s.solvedPuzzleIds.includes(id))
    return outcome(true, "이미 찾은 조각이에요. 점수는 한 번만 반영돼요.");
  const judges = {
    P1: () => judgeP1(s),
    P2: () => judgeP2(s),
    P3: () => runBall(s.puzzles.p3.arrows).ok,
    P4: () => judgeP4(s.puzzles.p4),
    P5: () => judgeP5(s.puzzles.p5),
  };
  if (!judges[id]())
    return outcome(
      false,
      {
        P1: "토끼가 직접 전한 이야기를 더 찾아봐요. 시작·반원·삼각형·끝을 순서대로 연결해요.",
        P2: "허락된 렌즈를 사용하고 ▲ 위를 맞춘 뒤 세 창의 숫자를 입력해요.",
        P3: runBall(s.puzzles.p3.arrows).message,
        P4: "사진 전달 두 개는 차단하고, 도움은 친구를 거쳐 어른에게 이어져야 해요.",
        P5: "도움 가능한 장소에서 R0를 먼저 놓고 R1 또는 R2를 이어 놓아요.",
      }[id],
    );
  s.solvedPuzzleIds.push(id);
  if (id === "P5") s.phase = "finalReady";
  return outcome(
    true,
    `${id} 해결! 우정 조각과 16점을 얻었어요. 다음 장치를 살펴봐요.`,
  );
}
export function solveBonus(s: Progress, id: BonusId, answer: string): Outcome {
  if (!active(s) || (id === "B4" && !s.solvedPuzzleIds.includes("P5")))
    return outcome(false, "도움 지도를 먼저 완성해요.");
  if (s.foundBonusIds.includes(id))
    return outcome(true, "이미 찾은 추가 단서예요. 5점은 한 번만 반영돼요.");
  const expected = { B1: "하트", B2: "함께 쓰기", B3: "1,2,3", B4: "312" };
  if (answer !== expected[id])
    return outcome(false, "기호와 문장을 다시 살펴봐요.");
  s.foundBonusIds.push(id);
  return outcome(true, `${id} 추가 단서 발견! 5점을 얻었어요.`);
}
export function move(s: Progress, place: Place): Outcome {
  if (
    !active(s) ||
    !unlocked(s, "P5") ||
    !ADJACENCY[s.puzzles.p5.place].includes(place)
  )
    return outcome(false, "지도에서 연결된 장소로 이동해요.");
  s.puzzles.p5.place = place;
  return outcome(
    true,
    place === "담임 자리"
      ? "지금 자리에 없어요. 복도로 돌아가 다른 선생님을 찾아도 돼요."
      : `${place}에 도착했어요.`,
  );
}
export function combine(s: Progress): Outcome {
  if (!active(s) || !judgeFinal(s))
    return outcome(false, "다섯 조각을 칠판 순서대로 놓고 모두 0도로 맞춰요.");
  s.finalCombined = true;
  return outcome(true, "지도가 완성됐어요! 창가 / 둥근 / 화분 / 받침 / 아래");
}
export function canEscape(s: Progress, item: ItemId | null) {
  return (
    active(s) &&
    PUZZLES.every((p) => s.solvedPuzzleIds.includes(p)) &&
    s.finalCombined &&
    s.finalKeyObtained &&
    s.inventory.includes("final-key") &&
    item === "final-key"
  );
}
export function escape(s: Progress, item: ItemId | null): Outcome {
  if (!canEscape(s, item))
    return outcome(
      false,
      "완성된 지도로 열쇠를 찾고, 가방에서 열쇠를 선택해 출구에 사용해요.",
    );
  s.exitUsed = true;
  s.frozenScore = score(s);
  s.phase = "escaped";
  s.paused = false;
  return outcome(true, "우리의 우정으로 교실 탈출 성공!");
}
