import type { ViewContext } from "../ui/views";
import type { ClassroomScene } from "../scene/classroom";
import { guidedNetwork, nextGuidedRoute } from "../game/guidance";
import { inputDigit } from "../game/advancement";
import { assistProgress } from "../game/learning";
import { unlocked, type ItemId, type Place } from "../game/model";
import {
  inspect,
  takeLens,
  applyItem,
  solveBonus,
  move,
  canEscape,
  escape,
  pickMemo,
  pickFragment,
  beginRequest,
  type Outcome,
} from "../game/engine";
import { routeArrows, tapRoute, judgeP2 } from "../puzzles/judges";
import { stopSpeaking } from "../ui/speech";

// Every action a player takes inside the room: opening objects, operating the
// five devices and the bonus clues, moving on the map and leaving through the
// exit. main.ts keeps the app shell (routes, dialogs, saving, the 3D scene) and
// hands these actions here once a game is active on #/play.
export interface PlayHost {
  c: ViewContext;
  root: HTMLElement;
  say: (message: string) => void;
  render: (focusKey?: string) => void;
  persist: () => void;
  finishPuzzle: (id: "P1" | "P2" | "P3" | "P4" | "P5") => void;
  checkDevice: () => void;
  openModal: (name: string) => void;
  go: (path: string) => void;
  outcome: (o: Outcome) => void;
  run: () => Promise<void>;
  handle: (action: string, value: string) => Promise<void>;
  player: { play: (kind: "ok" | "piece" | "escape") => void };
  fullscreen: { exit: () => Promise<void> };
  scene: () => ClassroomScene | null;
  setPendingPlace: (place: string) => void;
  setPendingOperation: (objectId: string) => void;
  panelReturnFocus: () => string;
  setPanelReturnFocus: (focus: string) => void;
}
export async function playAction(
  action: string,
  value: string,
  host: PlayHost,
) {
  const { c, root } = host;
  const s = c.state!;
  const scene = host.scene();
  switch (action) {
    case "guided-route":
      if (
        c.learning?.options.grade !== "guided" ||
        c.objectId !== "O07" ||
        !unlocked(s, "P3") ||
        s.solvedPuzzleIds.includes("P3") ||
        c.running
      )
        return;
      s.puzzles.p3.path = nextGuidedRoute(s.puzzles.p3.path);
      s.puzzles.p3.arrows = routeArrows(s.puzzles.p3.path);
      break;
    case "guided-photo":
    case "guided-help":
      if (
        !c.learning ||
        c.objectId !== "O08" ||
        !guidedNetwork(
          s,
          c.learning,
          action === "guided-photo" ? "photo" : "help",
        )
      )
        return;
      break;
    case "gym-team":
      if (
        c.learning?.options.episode !== "gym" ||
        !unlocked(s, "P4") ||
        s.solvedPuzzleIds.includes("P4")
      )
        return;
      if (value === "0")
        s.puzzles.p4 = {
          "photo-1": false,
          "photo-2": false,
          "help-1": true,
          "help-2": true,
          "help-3": false,
        };
      else {
        host.say(
          value === "1"
            ? "토끼가 두 팀에 들어가고 다람쥐가 빠졌어요. 네 친구가 한 번씩 들어가게 골라요."
            : "여우가 두 팀에 들어가고 토끼가 빠졌어요. 빠진 친구를 확인해요.",
        );
        return;
      }
      break;
    case "go-place":
      if (!["front", "plant", "back", "center"].includes(value)) return;
      c.modal = null;
      c.objectId = null;
      host.setPendingPlace(value);
      host.render();
      host.persist();
      return;
    case "inspect":
      if (c.sceneMode === "3d" && scene) {
        c.modal = null;
        c.reward = null;
        c.objectId = null;
        host.render();
        scene.focusObject(value);
        return;
      }
    case "operate-device":
      if (action === "operate-device") {
        if (!["O04", "O06", "O12"].includes(value)) return;
        if (
          value === "O06" &&
          c.learning?.options.cooperation &&
          !c.learning.coopSolved
        ) {
          host.openModal("team-puzzle");
          return;
        }
        c.objectId = null;
        c.modal = null;
        host.setPendingOperation(value);
        host.render();
        host.persist();
        return;
      }
    // The accessible 2D view uses the same investigation rules.
    case "inspect-direct": {
      host.setPanelReturnFocus("inspect:" + value);
      c.modal = null;
      c.held = null;
      c.device = "main";
      c.bonusHintLevel = 0;
      inspect(s, value);
      if (c.learning) {
        assistProgress(s, c.learning);
        if (
          c.learning.options.grade === "guided" &&
          value === "O07" &&
          unlocked(s, "P3") &&
          s.puzzles.p3.path.length === 1 &&
          !s.solvedPuzzleIds.includes("P3")
        ) {
          s.puzzles.p3.path = [10, 5, 0];
          s.puzzles.p3.arrows = routeArrows(s.puzzles.p3.path);
        }
      }
      // A new object starts fresh; the previous panel's reading stops.
      if (c.objectId !== value) stopSpeaking();
      c.objectId = value;
      if (
        c.selected === "final-key" &&
        value === "O12" &&
        canEscape(s, c.selected)
      ) {
        host.persist();
        host.openModal("exit-confirm");
        return;
      }
      const selected = c.selected;
      const applied = selected ? applyItem(s, selected, value) : null;
      if (applied?.ok) c.selected = null;
      if (c.learning) assistProgress(s, c.learning);
      host.persist();
      host.render();
      document.getElementById("panel-title")?.focus({ preventScroll: true });
      root.scrollTop = 0;
      window.scrollTo(0, 0);
      if (applied) host.say(applied.message);
      host.checkDevice();
      return;
    }
    case "close-panel":
      stopSpeaking();
      c.objectId = null;
      c.held = null;
      c.device = "main";
      host.persist();
      host.render(host.panelReturnFocus());
      root.scrollTop = 0;
      window.scrollTo(0, 0);
      return;
    case "device":
      if (value === "bonus" && c.learning?.options.minutes === 15) {
        host.say("15분 활동은 필수 다섯 퍼즐에 집중해요.");
        return;
      }
      c.device = value === "bonus" ? "bonus" : "main";
      c.held = null;
      c.bonusHintLevel = 0;
      host.persist();
      host.render();
      return;
    case "memo-pick":
      if (c.objectId === "O02" && c.device === "main") pickMemo(s, value);
      break;
    case "memo-remove":
      if (
        c.objectId === "O02" &&
        !s.solvedPuzzleIds.includes("P1") &&
        /^\d$/.test(value)
      )
        s.puzzles.p1.order.splice(Number(value), 1);
      break;
    case "fragment-pick":
      if (c.objectId === "O12" && c.device === "main") pickFragment(s, value);
      break;
    case "fragment-remove":
      if (c.objectId === "O12" && !s.finalCombined && /^\d$/.test(value))
        s.puzzles.final.order.splice(Number(value), 1);
      break;
    case "lens-desk": {
      const lens = s.inventory.find((id) => id.endsWith("lens"));
      if (lens) {
        c.selected = lens;
        await host.handle("inspect", "O04");
      }
      return;
    }
    case "place-lens": {
      if (c.objectId !== "O04") return;
      const lens = s.inventory.find((id) => id.endsWith("lens")) ?? null;
      const result = applyItem(s, lens, "O04");
      if (result.ok) c.selected = null;
      if (c.learning) assistProgress(s, c.learning);
      host.outcome(result);
      return;
    }
    case "key-exit":
      if (s.finalKeyObtained) {
        c.selected = "final-key";
        await host.handle("inspect", "O12");
      }
      return;
    case "sentence-start":
      if (c.objectId === "O09") beginRequest(s);
      break;
    case "bonus-code":
      if (
        c.objectId === "O12" &&
        c.device === "bonus" &&
        s.solvedPuzzleIds.includes("P5") &&
        !s.foundBonusIds.includes("B4")
      ) {
        if (value === "지우기") s.puzzles.b4 = "";
        else if (/^\d$/.test(value))
          s.puzzles.b4 =
            (s.puzzles.b4.length === 3 ? "" : s.puzzles.b4) + value;
        if (s.puzzles.b4.length === 3) {
          host.outcome(solveBonus(s, "B4", s.puzzles.b4));
          return;
        }
      }
      break;
    case "hold":
      if (
        (c.objectId === "O02" &&
          s.discoveredClueIds.includes(value) &&
          !s.solvedPuzzleIds.includes("P1")) ||
        (c.objectId === "O12" &&
          s.solvedPuzzleIds.length === 5 &&
          !s.finalCombined &&
          /^F[1-5]$/.test(value))
      )
        c.held = c.held === value ? null : value;
      host.render();
      document
        .querySelector<HTMLButtonElement>(
          `[data-action="${c.objectId === "O02" ? "p1-slot" : "fragment-slot"}"]:not(:disabled)`,
        )
        ?.focus();
      return;
    case "p1-slot": {
      if (s.solvedPuzzleIds.includes("P1")) return;
      const index = Number(value),
        order = s.puzzles.p1.order;
      if (
        c.held &&
        s.discoveredClueIds.includes(c.held) &&
        !order.includes(c.held) &&
        index >= 0 &&
        index <= order.length &&
        index < 3
      ) {
        order[index] = c.held;
        c.held = null;
      } else if (!c.held && order[index]) c.held = order.splice(index, 1)[0];
      break;
    }
    case "select-item":
      if (s.inventory.includes(value as ItemId)) {
        c.selected = c.selected === value ? null : (value as ItemId);
        c.modal = null;
        host.persist();
        host.render("select-item:" + value);
        host.say(
          c.selected
            ? "도구를 골랐어요. 사용할 물건을 눌러요."
            : "도구 선택을 해제했어요.",
        );
      }
      return;
    case "deselect":
      c.selected = null;
      host.render();
      return;
    case "take":
      if (c.learning?.options.cooperation && !c.learning.coopSolved) {
        host.openModal("team-puzzle");
        return;
      }
      takeLens(s, value as ItemId);
      if (s.inventory.includes(value as ItemId)) c.selected = value as ItemId;
      host.persist();
      host.render();
      host.say("렌즈를 아래 아이템 칸에 넣었어요.");
      return;
    case "apply": {
      const result = applyItem(s, c.selected, value);
      if (result.ok) c.selected = null;
      if (c.learning) assistProgress(s, c.learning);
      host.outcome(result);
      return;
    }
    case "flip":
      if (
        !s.solvedPuzzleIds.includes("P1") &&
        s.discoveredClueIds.includes(value)
      ) {
        const i = s.puzzles.p1.flipped.indexOf(value);
        i < 0
          ? s.puzzles.p1.flipped.push(value)
          : s.puzzles.p1.flipped.splice(i, 1);
      }
      break;
    case "lens-rotate":
      if (
        !s.solvedPuzzleIds.includes("P2") &&
        unlocked(s, "P2") &&
        s.puzzles.p2.lensUsed
      )
        s.puzzles.p2.rotation = (s.puzzles.p2.rotation + 90) % 360;
      break;
    case "code":
      if (
        !s.solvedPuzzleIds.includes("P2") &&
        unlocked(s, "P2") &&
        s.puzzles.p2.lensUsed &&
        s.puzzles.p2.rotation === 0
      ) {
        if (value === "지우기") s.puzzles.p2.code = "";
        else if (/^\d$/.test(value)) {
          if (s.puzzles.p2.code.length === 3) s.puzzles.p2.code = "";
          s.puzzles.p2.code += inputDigit(c.learning, value);
        }
        if (s.puzzles.p2.code.length === 3 && !judgeP2(s))
          host.say(
            "잠금장치가 열리지 않았어요. 창 번호 순서로 다시 읽어 봐요.",
          );
      }
      break;
    case "path-step":
      if (
        !s.solvedPuzzleIds.includes("P3") &&
        unlocked(s, "P3") &&
        !c.running
      ) {
        const next = tapRoute(s.puzzles.p3.path, Number(value));
        if (!next) {
          host.say("빛나는 이웃 칸을 누르거나, 지나온 칸을 눌러 길을 고쳐요.");
          return;
        }
        s.puzzles.p3.path = next;
        s.puzzles.p3.arrows = routeArrows(s.puzzles.p3.path);
        c.ballPath = [];
        c.ballIndex = -1;
      }
      break;
    case "path-undo":
    case "path-reset":
      if (
        !s.solvedPuzzleIds.includes("P3") &&
        unlocked(s, "P3") &&
        !c.running
      ) {
        s.puzzles.p3.path =
          action === "path-reset"
            ? [10]
            : s.puzzles.p3.path.slice(
                0,
                Math.max(1, s.puzzles.p3.path.length - 1),
              );
        s.puzzles.p3.arrows = routeArrows(s.puzzles.p3.path);
        c.ballPath = [];
        c.ballIndex = -1;
      }
      break;
    case "ball-run":
      await host.run();
      return;
    case "switch":
      if (
        !s.solvedPuzzleIds.includes("P4") &&
        unlocked(s, "P4") &&
        Object.hasOwn(s.puzzles.p4, value)
      ) {
        const k = value as keyof typeof s.puzzles.p4;
        s.puzzles.p4[k] = !s.puzzles.p4[k];
      }
      break;
    case "move":
      if (!s.solvedPuzzleIds.includes("P5")) {
        host.outcome(move(s, value as Place));
        const dialog = document.querySelector<HTMLElement>(".npc-dialog h4");
        if (dialog) {
          dialog.focus({ preventScroll: true });
          dialog.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      }
      return;
    case "sentence-add":
      if (
        !s.solvedPuzzleIds.includes("P5") &&
        unlocked(s, "P5") &&
        ["교무실", "상담실"].includes(s.puzzles.p5.place) &&
        s.puzzles.p5.sentence[0] === "R0" &&
        ["R1", "R2"].includes(value) &&
        !s.puzzles.p5.sentence.includes(value)
      )
        s.puzzles.p5.sentence.push(value);
      break;
    case "sentence-remove":
      if (!s.solvedPuzzleIds.includes("P5"))
        s.puzzles.p5.sentence.splice(Number(value), 1);
      break;
    case "fragment-slot": {
      if (s.solvedPuzzleIds.length !== 5 || s.finalCombined) return;
      const index = Number(value),
        order = s.puzzles.final.order;
      if (
        c.held &&
        /^F[1-5]$/.test(c.held) &&
        !order.includes(c.held) &&
        index >= 0 &&
        index <= order.length &&
        index < 5
      ) {
        order[index] = c.held;
        c.held = null;
      } else if (!c.held && order[index]) {
        const n = Number(order[index].slice(1)) - 1;
        s.puzzles.final.rotations[n] =
          (s.puzzles.final.rotations[n] + 90) % 360;
      }
      break;
    }
    case "fragment-reset":
      if (!s.finalCombined) {
        s.puzzles.final.order = [];
        c.held = null;
      }
      break;
    case "use-exit":
      if (canEscape(s, c.selected)) host.openModal("exit-confirm");
      else host.say("열쇠를 아래 아이템 칸에서 고른 뒤 출구에 사용해요.");
      return;
    case "escape-confirm": {
      const result = escape(s, c.selected);
      c.modal = null;
      host.persist();
      if (result.ok) {
        void host.fullscreen.exit();
        host.go("/result");
        host.player.play("escape");
      }
      host.render();
      host.say(result.message);
      return;
    }
    case "bonus": {
      const colon = value.indexOf(":"),
        id = value.slice(0, colon);
      if (["B1", "B2", "B3", "B4"].includes(id))
        host.outcome(solveBonus(s, id as any, value.slice(colon + 1)));
      return;
    }
    case "invite-add":
      if (
        !s.foundBonusIds.includes("B3") &&
        ["1", "2", "3"].includes(value) &&
        !s.puzzles.b3.includes(value)
      )
        s.puzzles.b3.push(value);
      break;
    case "invite-remove":
      if (!s.foundBonusIds.includes("B3"))
        s.puzzles.b3.splice(Number(value), 1);
      break;
    case "next-hint":
      if (Object.hasOwn(s.hints, value) && s.hints[value] < 3) s.hints[value]++;
      else if (/^B[1-4]$/.test(value))
        c.bonusHintLevel = Math.min(3, c.bonusHintLevel + 1);
      break;
  }
  host.persist();
  host.render();
  if (action === "memo-pick" && !c.modal && !s.solvedPuzzleIds.includes("P1")) {
    const next = root.querySelector<HTMLButtonElement>(
      '[data-action="memo-pick"]:not(:disabled)',
    );
    next?.focus({ preventScroll: true });
  }
  if (
    (action === "path-step" || action === "guided-route") &&
    s.puzzles.p3.path.at(-1) === 14 &&
    !s.solvedPuzzleIds.includes("P3") &&
    c.objectId === "O07" &&
    c.device === "main" &&
    matchMedia(
      "(orientation: landscape) and (max-height: 600px) and (max-width: 1000px)",
    ).matches
  ) {
    const runButton = root.querySelector<HTMLButtonElement>(
      '[data-action="ball-run"]:not(:disabled)',
    );
    runButton?.focus({ preventScroll: true });
    runButton?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  if (action === "next-hint") {
    const step = document.querySelector<HTMLElement>(
      "#game-dialog .hint-step:last-of-type",
    );
    if (step) {
      step.focus({ preventScroll: true });
      step.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }
  if (c.objectId === "O04" && judgeP2(s)) host.finishPuzzle("P2");
  host.checkDevice();
  if (action === "sentence-start")
    document
      .querySelector<HTMLElement>(".npc-dialog h4")
      ?.focus({ preventScroll: true });
}
