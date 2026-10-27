import "./style.css";
import "./ui/experience.css";

// 홈 화면 설치·오프라인 열기 (배포판에서만)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () =>
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) =>
        registration.active?.postMessage({ type: "AUTO_PREPARE" }),
      )
      .catch(() => {}),
  );
}
import "./ui/immersive.css";
import "./ui/touch.css";
import "./ui/learning.css";
import "./ui/exploration.css";
import "./ui/phone-landscape.css";
import "./ui/advancement.css";
import "./ui/clarity.css";
import { guidedNetwork, nextGuidedRoute, useEasyMode } from "./game/guidance";
import { EASY_LESSON } from "./game/learning";
import {
  editor,
  teacherProgress,
  offlineSection,
  customizeHtml,
} from "./ui/advancement";
import {
  defaultLessonPack,
  parseLessonPack,
  validateLessonPack,
  inputDigit,
  digit,
} from "./game/advancement";
import { prepareOffline } from "./offline";
import {
  createExperience,
  createHintClock,
  DEFAULT_LESSON,
  assistProgress,
  checkCooperation,
  cooperationAnswer,
  isPracticeLesson,
  progressMarker,
  roleAssignments,
  shouldSuggestHint,
  practiceCard,
  type LessonOptions,
} from "./game/learning";
import {
  createSaveCoordinator,
  readExperience,
  writeExperience,
  experienceKey,
} from "./storage/session";
import { adaptEpisodeHtml, episode, EPISODES } from "./content/episodes";
import {
  deviceView,
  DEVICE_CHECKS,
  rolesDocument,
  lessonMaterialsDocument,
} from "./ui/learning";
import { updateFeedback, watchStickyHeaders } from "./ui/visibility";
import { createFullscreenController } from "./ui/fullscreen";
import type { ClassroomScene } from "./scene/classroom";
import fontUrl from "./assets/classroom-font.woff2?url";
import {
  createProgress,
  PRACTICE_CONFIG,
  PUZZLES,
  active,
  unlocked,
  score,
  type PuzzleId,
  type ItemId,
  type Place,
} from "./game/model";
import {
  inspect,
  takeLens,
  applyItem,
  solve,
  solveBonus,
  move,
  combine,
  canEscape,
  escape,
  pickMemo,
  pickFragment,
  beginRequest,
  type Outcome,
} from "./game/engine";
import {
  runBall,
  routeArrows,
  extendPath,
  tapRoute,
  judgeP1,
  judgeP2,
  judgeP4,
  judgeP5,
  judgeFinal,
} from "./puzzles/judges";
import { FRAGMENTS, OBJECTS } from "./content/data";
import {
  saveKey,
  loadProgress,
  saveProgress,
  eraseProgress,
  SAVE_WARNING,
  validateProgress,
} from "./storage/progress";
import {
  asset,
  deploymentBase,
  readConfig,
  readSchools,
  readRanking,
  exportReason,
  resultFile,
} from "./ranking/service";
import {
  parseLocalFile,
  mergeEntry,
  resolveConflict,
  aggregateFile,
  MAX_FILES,
} from "./tools/aggregate";
import {
  header,
  footer,
  home,
  setup,
  schoolOptions,
  intro,
  landscapeStart,
  play,
  result,
  rankings,
  teacher,
  toolsView,
  modalShell,
  type ViewContext,
} from "./ui/views";
import { button as b, esc, time } from "./ui/helpers";
import { objective } from "./ui/experience";

const root = document.querySelector<HTMLDivElement>("#app")!;
const key = saveKey(deploymentBase());
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
const c: ViewContext = {
  learning: null,
  lessonDraft: { ...EASY_LESSON },
  roleCard: null,
  hintSuggested: false,
  deviceAudit: {
    device: "기기 선택",
    checks: [],
    taps: 0,
    swipes: 0,
    multi: 0,
    touchSeen: false,
  },
  sceneMode: "3d",
  sceneFailed: false,
  immersive: false,
  held: null,
  device: "main",
  bonusHintLevel: 0,
  reward: null,
  state: null,
  config: null,
  schools: [],
  ranking: null,
  warnings: [],
  saved: false,
  storageWarning: !storage,
  objectId: null,
  selected: null,
  modal: null,
  schoolQuery: "",
  setupSchool: null,
  setupSound: false,
  setupReduced: true,
  ballPath: [],
  ballIndex: -1,
  running: false,
  reflection: null,
  aggregate: { records: [], conflicts: [], messages: [] },
  importErrors: [],
  importBusy: false,
  toast: "",
  loading: true,
  loadError: false,
};
let dialogReturnFocus = "";
let panelReturnFocus = "";
let toastTimeout: ReturnType<typeof setTimeout>;
let announceTimeout: ReturnType<typeof setTimeout>;
const announcer = Object.assign(document.createElement("div"), {
  id: "announcer",
  className: "sr-only",
});
announcer.setAttribute("role", "status");
announcer.setAttribute("aria-live", "polite");
document.body.append(announcer);
let toolContext = "";
const phonePortrait = matchMedia(
  "(max-width: 600px) and (orientation: portrait), (max-width: 1024px) and (orientation: portrait) and (any-pointer: coarse)",
);
const hintClock = createHintClock();
let mistakes = 0,
  lastMarker = "";
let poseTimer: ReturnType<typeof setTimeout>;
let saveBlocked = false;
const saveCoordinator = createSaveCoordinator(
  storage,
  key,
  () => {
    saveBlocked = true;
    if (c.state) c.state.paused = true;
    c.running = false;
    c.modal = "save-blocked";
    queueMicrotask(() => render());
  },
  navigator.locks,
);
const route = () => location.hash.replace(/^#/, "") || "/";
let classroom: ClassroomScene | null = null;
let sceneHost: HTMLElement | null = null;
let sceneLoading = false;
let sceneGeneration = 0;
let sceneLoadTimer: ReturnType<typeof setTimeout> | undefined;
let clearScrollCue = () => {};
let clearStickyHeaders = () => {};
const fullscreen = createFullscreenController(root, () => {
  c.immersive =
    document.fullscreenElement === root ||
    root.classList.contains("immersive-fallback");
  document
    .querySelectorAll<HTMLElement>('[data-action="fullscreen"]')
    .forEach((el) => {
      el.textContent = c.immersive ? "화면 줄이기" : "전체화면";
      el.setAttribute("aria-pressed", String(c.immersive));
    });
  // Fullscreen may finish after a temporary hidden/orientation state skipped loading.
  mountScene();
  classroom?.resize();
});
let pendingSceneOperation: string | null = null;
let pendingScenePlace: string | null = null;
function runPendingSceneOperation() {
  if (!classroom || c.objectId || c.modal) return;
  if (pendingScenePlace) {
    const place = pendingScenePlace;
    pendingScenePlace = null;
    classroom.moveToPlace(place);
  }
  if (!pendingSceneOperation) return;
  const id = pendingSceneOperation;
  pendingSceneOperation = null;
  classroom.operateObject(id);
}
function disposeScene() {
  clearTimeout(poseTimer);
  clearTimeout(sceneLoadTimer);
  sceneLoadTimer = undefined;
  pendingSceneOperation = null;
  pendingScenePlace = null;
  sceneGeneration++;
  classroom?.dispose();
  classroom = null;
  sceneHost = null;
  sceneLoading = false;
}
function syncScene() {
  const s = c.state;
  if (s)
    classroom?.setState({
      objectiveId: objective(s)[1],
      solvedPuzzleIds: s.solvedPuzzleIds,
      finalCombined: s.finalCombined,
      finalKeyObtained: s.finalKeyObtained,
      drawerOpen: s.solvedPuzzleIds.includes("P1"),
      toolTaken: s.inventory.some((id) => id.endsWith("lens")),
      exitUsed: s.exitUsed,
      active:
        active(s) &&
        route() === "/play" &&
        !c.objectId &&
        !c.modal &&
        !phonePortrait.matches &&
        c.sceneMode === "3d" &&
        !document.hidden,
      reducedMotion: s.settings.reducedMotion,
    });
}
function failScene() {
  disposeScene();
  c.sceneMode = "2d";
  c.sceneFailed = true;
  render();
  say("입체 화면 대신 그림 교실로 이어갈게요. 모은 단서는 그대로예요.");
}
function mountScene() {
  const slot = document.getElementById("classroom-scene");
  if (!slot || c.sceneMode !== "3d") {
    clearTimeout(sceneLoadTimer);
    sceneLoadTimer = undefined;
    syncScene();
    return;
  }
  // Keep the existing canvas attached behind dialogs. Rendering can be paused
  // without replacing the room with a loading placeholder.
  if (sceneHost && sceneHost !== slot) slot.replaceWith(sceneHost);
  else sceneHost = slot;
  if (
    phonePortrait.matches ||
    c.modal ||
    !c.state ||
    !active(c.state) ||
    document.hidden
  ) {
    clearTimeout(sceneLoadTimer);
    sceneLoadTimer = undefined;
    syncScene();
    return;
  }
  if (classroom) {
    syncScene();
    classroom.resize();
    runPendingSceneOperation();
    return;
  }
  if (!sceneLoadTimer) {
    const generation = sceneGeneration;
    sceneLoadTimer = setTimeout(() => {
      sceneLoadTimer = undefined;
      if (generation === sceneGeneration && !classroom) failScene();
    }, 12000);
  }
  if (sceneLoading) return;
  sceneLoading = true;
  const generation = sceneGeneration;
  void import("./scene/classroom")
    .then(async ({ createClassroomScene }) => {
      // Canvas text must use the same loaded Korean font as the interface.
      await document.fonts.load("700 32px Classroom").catch(() => {});
      if (generation !== sceneGeneration || !sceneHost) return;
      if (
        phonePortrait.matches ||
        c.modal ||
        !c.state ||
        !active(c.state) ||
        !sceneHost.isConnected ||
        document.hidden
      ) {
        sceneLoading = false;
        clearTimeout(sceneLoadTimer);
        sceneLoadTimer = undefined;
        return;
      }
      classroom = createClassroomScene(sceneHost, {
        cipherDigits: [7, 2, 9, 4, 6, 1, 8, 3, 5].map((n) =>
          digit(c.learning, n),
        ),
        episodeId: c.learning?.options.episode ?? "classroom",
        initialPose: c.learning?.view.pose ?? null,
        onPoseChange: (pose) => {
          if (
            !c.learning ||
            JSON.stringify(c.learning.view.pose) === JSON.stringify(pose)
          )
            return;
          c.learning.view.pose = pose;
          clearTimeout(poseTimer);
          poseTimer = setTimeout(() => {
            if (c.state && route() === "/play" && !saveBlocked) persist();
          }, 600);
        },
        onInspect: (id) => {
          void handle("inspect-direct", id);
        },
        onFailure: () => {
          queueMicrotask(failScene);
        },
        reducedMotion: c.state?.settings.reducedMotion ?? false,
      });
      sceneLoading = false;
      clearTimeout(sceneLoadTimer);
      sceneLoadTimer = undefined;
      syncScene();
      classroom.resize();
      runPendingSceneOperation();
    })
    .catch(() => {
      if (generation === sceneGeneration) failScene();
    });
}
const go = (path: string) => {
  location.hash = path;
};
const contextId = () => JSON.stringify([c.config, c.schools]);
let lastTime = performance.now(),
  clockActive = false,
  lastPersist = performance.now();
function tick() {
  const now = performance.now();
  if (clockActive && c.state) c.state.elapsedMs += Math.max(0, now - lastTime);
  lastTime = now;
  clockActive = Boolean(
    c.state &&
    active(c.state) &&
    route() === "/play" &&
    c.modal !== "tutorial" &&
    !document.hidden &&
    !phonePortrait.matches,
  );
  hintClock.update(now, clockActive && !c.modal && !c.running);
  const timer = document.getElementById("timer");
  if (timer && c.state) timer.textContent = time(c.state.elapsedMs);
}
function persist() {
  if (!c.state) return;
  if (!saveCoordinator.writable()) {
    saveBlocked = true;
    c.modal = "save-blocked";
    return;
  }
  if (c.learning) {
    const panel = root.querySelector<HTMLElement>(".zoom-device");
    const sameView =
      c.learning.view.objectId === c.objectId &&
      c.learning.view.device === c.device;
    const panelScroll =
      route() === "/play" && !c.state.paused && !phonePortrait.matches
        ? panel?.dataset.device === `${c.objectId}:${c.device}`
          ? Math.max(root.scrollTop, window.scrollY)
          : 0
        : sameView
          ? c.learning.view.panelScroll
          : 0;
    c.learning.view = {
      ...c.learning.view,
      objectId: c.objectId,
      device: c.device,
      selected: c.selected,
      sceneMode: c.sceneMode,
      panelScroll,
    };
    const marker = progressMarker(c.state);
    if (marker !== lastMarker) {
      hintClock.reset();
      mistakes = 0;
      c.hintSuggested = false;
      lastMarker = marker;
    }
  }
  if (!storage || !saveProgress(storage, key, c.state)) c.storageWarning = true;
  else {
    saveCoordinator.wrote();
    c.saved = true;
    if (c.learning)
      try {
        writeExperience(storage, key, c.learning);
      } catch {
        c.storageWarning = true;
      }
  }
}
function say(message: string) {
  if (/열리지|다시|아니에요|기호가 이어지지/.test(message)) mistakes++;
  c.toast = message;
  const displayMessage = adaptEpisodeHtml(
    message,
    c.learning?.options.episode ?? "classroom",
    OBJECTS,
  );
  updateFeedback(root, displayMessage);
  // Write after the current render settles so screen readers notice the change.
  announcer.textContent = "";
  clearTimeout(announceTimeout);
  announceTimeout = setTimeout(() => {
    announcer.textContent = displayMessage;
  }, 80);
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = displayMessage;
    toast.hidden = false;
  }
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    c.toast = "";
    updateFeedback(root, "");
    const t = document.getElementById("toast");
    if (t) t.hidden = true;
  }, 6500);
}
let audio: AudioContext | null = null;
/** Short synthesized notes; no extra audio files, and only when sound is on. */
function notes(freqs: number[], step: number) {
  try {
    audio ??= new AudioContext();
    const start = audio.currentTime + 0.05;
    freqs.forEach((freq, i) => {
      const osc = audio!.createOscillator(),
        gain = audio!.createGain(),
        at = start + i * step;
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + step * 1.8);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + step * 2);
    });
  } catch {
    // Audio is optional; every cue is also shown on screen.
  }
}
function sound(kind: "ok" | "piece" | "escape" = "ok") {
  if (!c.state?.settings.sound) return;
  if (kind === "ok")
    void new Audio(asset("assets/chime.wav")).play().catch(() => {});
  // A friendship piece rises; escaping plays a short bright fanfare.
  if (kind === "piece") notes([523.25, 659.25, 783.99], 0.11);
  if (kind === "escape") notes([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.13);
}
function outcome(o: Outcome) {
  persist();
  render();
  say(o.message);
  if (o.ok) sound();
}
function findFocus(value: string) {
  return [...document.querySelectorAll<HTMLElement>("[data-focus]")].find(
    (el) => el.dataset.focus === value,
  );
}
function render(focusKey?: string) {
  clearStickyHeaders();
  clearScrollCue();
  clearScrollCue = () => {};
  const expanded = new Set(
    [
      ...root.querySelectorAll<HTMLDetailsElement>(
        "details[data-disclosure][open]",
      ),
    ].map((el) => el.dataset.disclosure),
  );
  if (saveBlocked && route() === "/play") c.modal = "save-blocked";
  const a = document.activeElement as HTMLElement | null;
  const focus = focusKey ?? a?.dataset.focus;
  const scroll = window.scrollY;
  const appScroll = root.scrollTop;
  const previousDialog =
    document.querySelector<HTMLDialogElement>("#game-dialog");
  const dialogScroll =
    previousDialog?.dataset.kind === c.modal ? previousDialog.scrollTop : 0;
  const previousDevice = document.querySelector<HTMLElement>(".zoom-device");
  const deviceKey = previousDevice?.dataset.device;
  const deviceScroll = previousDevice?.scrollTop ?? 0;
  const previousMemo =
    previousDevice?.querySelector<HTMLElement>(".memo-board");
  const memoViewport = `${innerWidth}x${innerHeight}`;
  const previousMemoHeight =
    previousMemo?.dataset.layoutViewport === memoViewport
      ? previousMemo.getBoundingClientRect().height
      : 0;
  const current = route();
  const pack = episode(
    current === "/setup"
      ? (c.lessonDraft?.episode ?? "classroom")
      : (c.learning?.options.episode ?? "classroom"),
  );
  document.title = `교실 탈출 · ${c.learning?.extras.custom?.title ?? pack.title}`;
  const landscapeBlocked =
    current === "/play" &&
    c.state &&
    c.state.phase !== "escaped" &&
    phonePortrait.matches;
  let content = "";
  if (c.loading)
    content =
      '<main id="main" class="narrow loading"><div class="loader"></div><h1>교실 문을 여는 중이에요</h1><p>게임 데이터와 꼭 필요한 자산을 확인하고 있어요.</p></main>';
  else if (c.loadError)
    content = `<main id="main" class="narrow"><h1>교실을 준비하지 못했어요</h1><p>필수 그림·글꼴·소리를 읽지 못했어요. 연결을 확인하고 다시 시도해 주세요.</p>${b("다시 준비하기", "retry", "", 'class="primary"')}</main>`;
  else if (landscapeBlocked) content = landscapeStart();
  else if (current === "/setup") content = setup(c);
  else if (current === "/intro" && c.state?.phase === "intro")
    content = intro(c);
  else if (
    current === "/play" &&
    c.state &&
    c.state.phase !== "intro" &&
    c.state.phase !== "escaped"
  )
    content = play(c);
  else if (current === "/result" && c.state?.phase === "escaped")
    content = result(c);
  else if (current === "/rankings") content = rankings(c);
  else if (current === "/teacher")
    content = teacher(c).replace(
      "</main>",
      `<section class="surface"><h2>교사용 도구</h2><p><a href="#/lesson-editor">수업 이야기 편집·파일 불러오기 →</a></p>${b("이 기기의 진행 확인", "teacher-progress")}</section>${offlineSection(c)}</main>`,
    );
  else if (current === "/lesson-editor") content = editor(c);
  else if (current === "/progress") content = teacherProgress(c);
  else if (current === "/device-check") content = deviceView(c.deviceAudit!);
  else if (current === "/tools/results") content = toolsView(c);
  else content = home(c);
  document.documentElement.classList.toggle(
    "reduce-motion",
    c.state?.settings.reducedMotion ?? c.setupReduced,
  );
  document.body.classList.toggle("in-game", current === "/play");
  root.classList.toggle(
    "has-start-screen",
    ["/", "/setup", "/intro"].includes(current),
  );
  sceneHost?.remove();
  // Keep the one live region alive across re-renders (innerHTML would discard it).
  document.body.append(announcer);
  const markup = `<a class="skip-link" href="#main">본문으로 바로가기</a>${header(c)}${c.storageWarning ? `<p class="storage-warning" role="status">${SAVE_WARNING}</p>` : ""}${content}${footer()}<div id="toast" class="toast" ${c.toast ? "" : "hidden"}>${esc(c.toast)}</div>${c.modal && !landscapeBlocked ? `<dialog id="game-dialog" data-kind="${esc(c.modal)}" aria-labelledby="dialog-title">${modalShell(c)}</dialog>` : ""}`;
  root.innerHTML = ["/", "/play", "/intro", "/result"].includes(current)
    ? customizeHtml(
        adaptEpisodeHtml(
          markup,
          c.learning?.options.episode ?? "classroom",
          OBJECTS,
        ),
        c.learning?.extras.custom,
        c.learning?.options.episode ?? "classroom",
      )
    : markup;
  root.classList.toggle(
    "has-device-panel",
    !!root.querySelector(".zoom-device"),
  );
  root.classList.toggle(
    "has-open-dialog",
    !!root.querySelector("#game-dialog"),
  );
  mountDeviceAudit();
  mountScene();
  root
    .querySelectorAll<HTMLDetailsElement>("details[data-disclosure]")
    .forEach((el) => {
      if (expanded.has(el.dataset.disclosure)) el.open = true;
    });
  const device = document.querySelector<HTMLElement>(".zoom-device");
  const memo = device?.querySelector<HTMLElement>(".memo-board");
  if (memo) {
    memo.dataset.layoutViewport = memoViewport;
    if (device?.dataset.device === deviceKey && previousMemoHeight > 0)
      memo.style.minHeight = `${Math.ceil(previousMemoHeight)}px`;
  }
  if (device && device.dataset.device === deviceKey)
    device.scrollTop = deviceScroll;
  const scrollCue = document.querySelector<HTMLElement>(".device-scroll-cue");
  if (device && scrollCue) {
    // Device content flows in #app. Observe the real scroller, not the
    // non-scrolling device card, and remove listeners before the next render.
    const scroller =
      device.scrollHeight > device.clientHeight + 2 ? device : root;
    const phoneCue = document.querySelector<HTMLElement>(
      "[data-phone-scroll-hint]",
    );
    const updateCue = () => {
      const scrollable = scroller.scrollHeight > scroller.clientHeight + 2;
      const below =
        scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 8;
      scrollCue.hidden = !scrollable;
      scrollCue.textContent = below
        ? "↓ 아래에도 장치가 있어요 · 위아래로 움직여 살펴봐요"
        : "↑ 위쪽 단서를 다시 살펴볼 수 있어요";
      if (phoneCue) {
        phoneCue.hidden = !scrollable;
        phoneCue.textContent = below ? "↓ 아래도 있어요" : "↑ 위로 돌아보기";
      }
    };
    updateCue();
    scroller.addEventListener("scroll", updateCue, { passive: true });
    const observer = new ResizeObserver(updateCue);
    observer.observe(root);
    observer.observe(device);
    clearScrollCue = () => {
      scroller.removeEventListener("scroll", updateCue);
      observer.disconnect();
    };
  }
  // Inside #app so it stays exposed while #app is fullscreen.
  root.append(announcer);
  const dialog = document.querySelector<HTMLDialogElement>("#game-dialog");
  if (dialog) {
    dialog.showModal();
    // A modal makes the page outside it inert, so announcements must come from inside.
    dialog.append(announcer);
    dialog.scrollTop = dialogScroll;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeModal();
    });
  }
  clearStickyHeaders = watchStickyHeaders(root);
  const restored = focus ? findFocus(focus) : null;
  if (
    restored &&
    !restored.hasAttribute("disabled") &&
    restored.getClientRects().length
  )
    restored.focus({ preventScroll: true });
  else if (!dialog && focus) {
    const fallback =
      document.querySelector<HTMLElement>("#panel-title") ??
      document.querySelector<HTMLElement>(".explore-goal") ??
      document.querySelector<HTMLElement>('[data-scene-control="center"]') ??
      document.querySelector<HTMLElement>("main h1");
    if (fallback) {
      fallback.tabIndex = -1;
      fallback.focus({ preventScroll: true });
    }
  }
  const changedDevice =
    !!previousDevice &&
    previousDevice.dataset.device !== device?.dataset.device;
  window.scrollTo({ top: changedDevice ? 0 : scroll, behavior: "instant" });
  root.scrollTop = changedDevice ? 0 : appScroll;
}
function openModal(name: string) {
  if (name === "tutorial") tick();
  if (name === "hint") c.bonusHintLevel = 0;
  if (name === "team-puzzle" && c.learning) {
    const e = c.learning;
    c.roleCard =
      e.coopSolved || (e.viewedRoles.includes(0) && e.viewedRoles.includes(1))
        ? null
        : e.viewedRoles.includes(0)
          ? 1
          : 0;
    if (c.roleCard !== null && !e.viewedRoles.includes(c.roleCard))
      e.viewedRoles.push(c.roleCard);
    if (checkCooperation(e)) e.coopSolved = true;
    persist();
  }
  if (!c.modal)
    dialogReturnFocus =
      (document.activeElement as HTMLElement)?.dataset.focus ?? "";
  c.modal = name;
  if (name === "tutorial") tick();
  render();
}
function closeModal() {
  if (c.modal === "save-blocked") {
    go("/");
    c.modal = null;
    render();
    return;
  }
  if (c.modal === "pause") {
    resume();
    return;
  }
  if (c.modal === "exit-confirm") c.selected = null;
  c.modal = null;
  render(dialogReturnFocus);
}
function pause() {
  if (!c.state || c.state.phase === "escaped") return;
  tick();
  // Capture the work position before the paused screen replaces its context.
  persist();
  c.state.paused = true;
  c.running = false;
  c.modal = "pause";
  tick();
  persist();
  render();
}
function restorePanelScroll(offset: number) {
  if (!c.objectId || !root.querySelector(".zoom-device")) return;
  if (root.scrollHeight > root.clientHeight + 2) root.scrollTop = offset;
  else window.scrollTo({ top: offset, behavior: "instant" });
}
function resume() {
  if (!c.state) return;
  const offset = c.learning?.view.panelScroll ?? 0;
  c.state.paused = false;
  c.modal = null;
  tick();
  render(c.objectId ? "" : "goal:");
  if (c.objectId)
    document.getElementById("panel-title")?.focus({ preventScroll: true });
  restorePanelScroll(offset);
  persist();
}
let schoolsKnown = false;
async function data() {
  c.warnings = [];
  const results = await Promise.allSettled([readConfig(), readSchools()]);
  // A failed refresh keeps the last good data, so a network blip cannot drop a chosen school or round.
  if (results[0].status === "fulfilled") c.config = results[0].value;
  if (results[1].status === "fulfilled") {
    c.schools = results[1].value;
    schoolsKnown = true;
  }
  if (!c.config)
    c.warnings.push(
      "회차 설정을 읽지 못했어요. 연습은 가능하지만 공식 내보내기는 사용할 수 없어요.",
    );
  if (!schoolsKnown)
    c.warnings.push(
      "학교 목록을 읽지 못했어요. 학교 없이 체험으로 진행할 수 있어요.",
    );
  c.ranking = null;
  if (c.config && schoolsKnown)
    try {
      c.ranking = await readRanking(c.config, c.schools);
    } catch {
      c.warnings.push(
        "공식 순위를 읽지 못했어요. 체험 게임은 계속할 수 있어요.",
      );
    }
}
async function bootstrap() {
  c.loading = true;
  c.loadError = false;
  render();
  try {
    await Promise.all(
      [
        "assets/classroom.svg",
        "assets/key.svg",
        "assets/chime.wav",
        fontUrl,
      ].map(async (path) => {
        const r = await fetch(path === fontUrl ? path : asset(path), {
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok || (await r.arrayBuffer()).byteLength === 0)
          throw new Error(path);
      }),
    );
    await data();
    saveBlocked = !(await saveCoordinator.acquire());
    const loaded = storage
      ? loadProgress(
          storage,
          key,
          c.config ?? PRACTICE_CONFIG,
          c.warnings.some((x) => x.startsWith("학교 목록")) ? null : c.schools,
        )
      : { state: null, error: null };
    c.state = loaded.state;
    c.learning = storage ? readExperience(storage, key) : null;
    if (c.state && !c.learning)
      c.learning = createExperience({ ...DEFAULT_LESSON, cooperation: false });
    if (c.learning && c.state) {
      assistProgress(c.state, c.learning);
      c.lessonDraft = { ...c.learning.options };
      c.objectId = c.learning.view.objectId;
      c.device = c.learning.view.device;
      c.selected = c.state.inventory.includes(
        c.learning.view.selected as ItemId,
      )
        ? (c.learning.view.selected as ItemId)
        : null;
      // Every launch opens the 3D room; a picture-mode choice lasts only for its session.
      c.sceneMode = "3d";
      // A copy: editor input must not mutate the running game's saved lesson pack.
      c.authorDraft = c.learning.extras.custom
        ? structuredClone(c.learning.extras.custom)
        : c.learning.extras.custom;
      c.reflection = null;
      lastMarker = progressMarker(c.state);
    }
    c.saved = Boolean(loaded.state);
    if (loaded.error)
      c.warnings.push(`이어하기 기록을 사용할 수 없어요: ${loaded.error}`);
    if (c.state?.paused && route() === "/play") c.modal = "pause";
    if (saveBlocked && route() === "/play") c.modal = "save-blocked";
  } catch {
    c.loadError = true;
  } finally {
    c.loading = false;
    if (
      route() === "/play" &&
      c.state?.phase === "intro" &&
      !phonePortrait.matches &&
      !saveBlocked &&
      !c.loadError
    ) {
      void handle("start", "");
      return;
    }
    render();
    tick();
  }
}
function resetImport() {
  c.aggregate = { records: [], conflicts: [], messages: [] };
  c.importErrors = [];
  toolContext = contextId();
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function saveText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openPrint(html: string) {
  document.getElementById("lesson-print")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "lesson-print";
  frame.title = "인쇄할 모둠 카드";
  frame.style.cssText =
    "position:fixed;left:-2000px;top:0;width:900px;height:900px;border:0";
  frame.onload = () => {
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow?.print();
  };
  frame.srcdoc = html;
  document.body.append(frame);
}
function mountDeviceAudit() {
  const pad = document.getElementById("device-touch-pad");
  if (!pad) return;
  const pointers = new Map<number, { x: number; y: number }>(),
    a = c.deviceAudit!;
  const update = () => {
    const t = document.getElementById("device-touch-stats");
    if (t)
      t.textContent = `터치 감지 ${a.touchSeen ? "있음" : "아직 없음"} · 누르기 ${a.taps} · 밀기 ${a.swipes} · 두 손가락 ${a.multi}`;
  };
  pad.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    a.touchSeen = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) a.multi++;
    pad.setPointerCapture(event.pointerId);
    update();
  });
  pad.addEventListener("pointerup", (event) => {
    const p = pointers.get(event.pointerId);
    if (!p) return;
    Math.hypot(event.clientX - p.x, event.clientY - p.y) > 14
      ? a.swipes++
      : a.taps++;
    pointers.delete(event.pointerId);
    update();
  });
  pad.addEventListener("pointercancel", (event) =>
    pointers.delete(event.pointerId),
  );
}
async function run() {
  const s = c.state;
  if (
    !s ||
    !active(s) ||
    !unlocked(s, "P3") ||
    s.solvedPuzzleIds.includes("P3") ||
    c.running
  )
    return;
  if (s.puzzles.p3.path.at(-1) !== 14) {
    say("먼저 공의 길을 골대까지 이어요.");
    return;
  }
  const result = runBall(s.puzzles.p3.arrows);
  c.running = true;
  c.ballPath = result.path;
  c.ballIndex = -1;
  if (
    !s.settings.reducedMotion &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    for (let i = 0; i < result.path.length; i++) {
      if (!c.running || !active(s) || route() !== "/play") {
        c.running = false;
        return;
      }
      c.ballIndex = i;
      render();
      await new Promise((r) => setTimeout(r, 160));
    }
  } else c.ballIndex = result.path.length - 1;
  c.running = false;
  if (result.ok) finishPuzzle("P3");
  else outcome({ ok: false, message: result.message });
}
function finishPuzzle(id: PuzzleId) {
  const s = c.state!;
  if (s.solvedPuzzleIds.includes(id)) return;
  const result = solve(s, id);
  if (!result.ok) {
    outcome(result);
    return;
  }
  const hasLens = s.inventory.some((id) => id.endsWith("lens"));
  const nexts = [hasLens ? "O04" : "O06", "O07", "O08", "O09", "O12"];
  const texts = [
    hasLens
      ? "서랍이 열렸어요! 찾은 렌즈로 암호판을 살펴봐요."
      : "서랍이 열렸어요! 공용 도구함에서 렌즈를 집어 암호판을 살펴봐요.",
    "놀이판에 불이 들어왔어요. 네 친구에게 공을 전해요.",
    "교실 태블릿이 켜졌어요. 두 연결망을 살펴봐요.",
    "뒤편 도움 지도가 펼쳐졌어요. 어른을 찾아가요.",
    "우정 조각 다섯 개를 모았어요. 출구의 조합판이 열렸어요.",
  ];
  c.held = null;
  c.selected = null;
  c.reward = {
    puzzle: id,
    title: FRAGMENTS[PUZZLES.indexOf(id)] + " 조각을 찾았어요!",
    text: texts[PUZZLES.indexOf(id)],
    next: nexts[PUZZLES.indexOf(id)],
    roleNotice: c.learning
      ? `역할을 바꿔요. 다음 조작은 ${roleAssignments(c.learning, s).find((x) => x.role === "조작")!.student}번 친구예요.`
      : undefined,
  };
  persist();
  openModal("reward");
  sound("piece");
}
function checkDevice() {
  const s = c.state!;
  if (
    c.objectId === "O02" &&
    c.device === "main" &&
    s.puzzles.p1.order.length === 3
  ) {
    if (judgeP1(s)) finishPuzzle("P1");
    else say("맞닿는 기호와 토끼가 직접 한 말을 다시 살펴봐요.");
  }
  if (c.objectId === "O08" && judgeP4(s.puzzles.p4)) finishPuzzle("P4");
  if (c.objectId === "O09" && judgeP5(s.puzzles.p5)) finishPuzzle("P5");
  if (c.objectId === "O12" && judgeFinal(s) && !s.finalCombined) {
    combine(s);
    c.reward = {
      title: "열쇠가 숨겨진 지도를 완성했어요!",
      text: "창가 / 둥근 / 화분 / 받침 / 아래",
      next: "O11",
    };
    persist();
    openModal("reward");
    sound("piece");
  }
  if (
    c.device === "bonus" &&
    c.objectId === "O02" &&
    s.puzzles.b3.length === 3 &&
    !s.foundBonusIds.includes("B3")
  ) {
    const result = solveBonus(s, "B3", s.puzzles.b3.join(","));
    if (result.ok) say("초대장 속 추가 단서를 찾았어요! 5점");
    else say("문장 사이의 원과 삼각형을 다시 맞춰 봐요.");
    persist();
    render();
  }
}
let launchImmersion = true;
let refreshing = false;
/** Refreshes data before a step; false while one is already running or once the user has moved to another screen. */
async function refreshForStep() {
  if (refreshing) return false;
  refreshing = true;
  const from = route();
  root
    .querySelectorAll<HTMLButtonElement>(
      '[data-action="continue"], [data-action="setup-next"]',
    )
    .forEach((el) => {
      el.disabled = true;
    });
  try {
    await data();
  } finally {
    refreshing = false;
  }
  return route() === from;
}
async function handle(action: string, value: string) {
  tick();
  clearTimeout(toastTimeout);
  c.toast = "";
  updateFeedback(root, "");
  const previousToast = document.getElementById("toast");
  if (previousToast) previousToast.hidden = true;
  const s = c.state;
  if (
    saveBlocked &&
    ![
      "home",
      "close-modal",
      "save-retry",
      "print",
      "audit-check",
      "audit-download",
      "lesson",
      "print-roles",
      "download-roles",
      "download-pledge",
      "print-pledge",
    ].includes(action)
  ) {
    openModal("save-blocked");
    return;
  }
  switch (action) {
    case "demo-object":
    case "demo-move":
    case "demo-bag":
    case "demo-use": {
      const actions = ["demo-object", "demo-move", "demo-bag", "demo-use"];
      if (c.modal !== "tutorial" || actions[c.tutorialStep ?? 0] !== action)
        return;
      c.tutorialStep = (c.tutorialStep ?? 0) + 1;
      if (c.tutorialStep === 4 && c.learning) {
        c.learning.extras.tutorialDone = true;
        persist();
      }
      render();
      document
        .querySelector<HTMLElement>(".demo-stage h3")
        ?.focus({ preventScroll: true });
      return;
    }
    case "talk-choice":
      if (c.learning && s && active(s) && ["0", "1", "2"].includes(value)) {
        c.learning.extras.conversation = Number(value);
        persist();
        render();
        const reply = root.querySelector<HTMLElement>(".friend-reply");
        reply?.focus({ preventScroll: true });
        reply?.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
      return;
    case "teacher-progress":
      if (s && active(s)) pause();
      go("/progress");
      return;
    case "offline-prepare": {
      if (c.offlineBusy) return;
      c.offlineBusy = true;
      const status = (text: string) => {
        c.offlineStatus = text;
        const node = document.getElementById("offline-status");
        if (node) node.textContent = text;
      };
      try {
        await prepareOffline(status);
      } catch (error) {
        status(
          error instanceof Error ? error.message : "파일을 준비하지 못했어요.",
        );
      } finally {
        c.offlineBusy = false;
        render();
      }
      return;
    }
    case "author-default":
      c.authorDraft = defaultLessonPack(
        c.authorDraft?.episode ?? c.lessonDraft?.episode ?? "classroom",
      );
      c.authorStatus = "선택한 이야기의 기본 문구를 불러왔어요.";
      render();
      return;
    case "author-clear":
      c.authorDraft = null;
      c.lessonDraft!.authored = false;
      render();
      return;
    case "author-export":
    case "author-apply": {
      try {
        const draft = validateLessonPack(
          c.authorDraft ??
            defaultLessonPack(c.lessonDraft?.episode ?? "classroom"),
        );
        c.authorDraft = draft;
        if (action === "author-export") {
          saveText(
            JSON.stringify(draft, null, 2),
            "교실탈출-수업설정.json",
            "application/json",
          );
          c.authorStatus =
            "수업 파일을 저장했어요. 학생 개인정보는 작성하지 않아요.";
          render();
        } else {
          c.lessonDraft = {
            ...c.lessonDraft!,
            episode: draft.episode,
            authored: true,
          };
          if (c.saved) openModal("new-confirm");
          else go("/setup");
        }
      } catch (error) {
        c.authorStatus =
          error instanceof Error ? error.message : "수업 파일을 확인해요.";
        render();
      }
      return;
    }
    case "save-retry":
      saveBlocked = !(await saveCoordinator.acquire());
      if (!saveBlocked) {
        disposeScene();
        c.modal = null;
        await bootstrap();
        if (c.state && c.state.phase !== "intro" && c.state.phase !== "escaped")
          c.modal = "pause";
        render();
      } else say("다른 탭을 닫은 뒤 다시 확인해 주세요.");
      return;
    case "lesson": {
      const draft = c.lessonDraft!;
      if (value === "official")
        c.lessonDraft = {
          ...DEFAULT_LESSON,
          cooperation: false,
          hints: "request",
        };
      else {
        const [name, v] = value.split(":");
        if (name === "grade" && ["guided", "standard"].includes(v))
          draft.grade = v as LessonOptions["grade"];
        if (name === "minutes" && [15, 25, 40].includes(Number(v)))
          draft.minutes = Number(v) as 15 | 25 | 40;
        if (name === "hints" && ["suggest", "request"].includes(v))
          draft.hints = v as LessonOptions["hints"];
        if (name === "cooperation") draft.cooperation = v === "true";
        if (name === "variation") draft.variation = v === "true";
        if (name === "episode" && Object.hasOwn(EPISODES, v)) {
          draft.episode = v as LessonOptions["episode"];
          // An applied lesson pack belongs to one story; switching stories leaves it behind.
          if (c.authorDraft?.episode !== draft.episode) draft.authored = false;
        }
      }
      render();
      return;
    }
    case "role-card":
      c.roleCard = value === "" ? null : Number(value);
      if (
        c.roleCard !== null &&
        c.learning &&
        c.roleCard >= 0 &&
        c.roleCard < 4 &&
        !c.learning.viewedRoles.includes(c.roleCard)
      )
        c.learning.viewedRoles.push(c.roleCard);
      if (
        c.learning &&
        !c.learning.coopSolved &&
        checkCooperation(c.learning)
      ) {
        c.learning.coopSolved = true;
        say("두 친구의 설명과 암호가 맞아요. 도구함을 열었어요!");
      }
      persist();
      render();
      if (c.modal === "team-puzzle") {
        const dialog =
          document.querySelector<HTMLDialogElement>("#game-dialog");
        if (dialog) dialog.scrollTop = 0;
      }
      document
        .querySelector<HTMLElement>(".role-clue h3, .coop-input-title")
        ?.focus();
      return;
    case "role-shift":
      if (c.learning) {
        c.learning.roleShift = (c.learning.roleShift + 1) % 4;
        persist();
        render();
      }
      return;
    case "coop-code":
      if (c.learning && !c.learning.coopSolved) {
        const e = c.learning,
          size = cooperationAnswer(e).length;
        if (value === "지우기") e.coopCode = "";
        else if (/^\d$/.test(value))
          e.coopCode = (e.coopCode.length === size ? "" : e.coopCode) + value;
        if (e.coopCode.length === size) {
          e.coopSolved = checkCooperation(e);
          if (!e.coopSolved)
            say(
              e.viewedRoles.includes(0) && e.viewedRoles.includes(1)
                ? "두 친구의 기호 순서와 숫자를 다시 연결해요."
                : "관찰 카드와 읽기 카드를 맡은 친구의 설명을 먼저 들어요.",
            );
          else say("친구의 설명을 연결해 도구함을 열었어요!");
        }
        persist();
        render();
      }
      return;
    case "pledge":
      if (
        c.learning &&
        s?.phase === "escaped" &&
        Number(value) >= 0 &&
        Number(value) < 5
      ) {
        c.learning.pledge = Number(value);
        persist();
        render();
        if (
          matchMedia(
            "(orientation: landscape) and (max-height: 600px) and (max-width: 1000px)",
          ).matches
        ) {
          const preview =
            document.querySelector<HTMLElement>(".pledge-preview");
          preview?.focus({ preventScroll: true });
          preview?.scrollIntoView({ block: "start", behavior: "instant" });
        }
      }
      return;
    case "print-materials":
      openPrint(
        lessonMaterialsDocument(
          route() === "/play" && c.learning
            ? c.learning
            : createExperience(c.lessonDraft),
        ),
      );
      return;
    case "print-roles":
      openPrint(
        rolesDocument(
          route() === "/play" && c.learning
            ? c.learning
            : createExperience(c.lessonDraft),
        ),
      );
      return;
    case "download-roles":
      saveText(
        rolesDocument(
          route() === "/play" && c.learning
            ? c.learning
            : createExperience(c.lessonDraft),
        ),
        "모둠-역할-카드.html",
        "text/html;charset=utf-8",
      );
      return;
    case "print-pledge":
      if (c.learning && c.learning.pledge !== null)
        openPrint(practiceCard(c.learning));
      return;
    case "download-pledge":
      if (c.learning && c.learning.pledge !== null)
        saveText(
          practiceCard(c.learning),
          "우리-모둠-실천-카드.html",
          "text/html;charset=utf-8",
        );
      return;
    case "audit-check": {
      const n = Number(value),
        a = c.deviceAudit!;
      if (n >= 0 && n < DEVICE_CHECKS.length)
        a.checks = a.checks.includes(n)
          ? a.checks.filter((i) => i !== n)
          : [...a.checks, n];
      render();
      return;
    }
    case "audit-download": {
      const a = c.deviceAudit!;
      download(
        {
          type: "self-reported-device-check",
          testDate: new Date().toLocaleDateString("sv-SE", {
            timeZone: "Asia/Seoul",
          }),
          status:
            a.touchSeen &&
            a.device !== "기기 선택" &&
            a.checks.length === DEVICE_CHECKS.length
              ? "SELF_REPORTED_PASS"
              : "NOT_RUN",
          ...a,
          items: DEVICE_CHECKS,
          viewport: { width: innerWidth, height: innerHeight },
        },
        "교실-탈출-실기기-점검.json",
      );
      return;
    }
    case "retry":
      await bootstrap();
      return;
    case "new":
      if (s || c.saved) openModal("new-confirm");
      else go("/setup");
      return;
    case "new-confirmed":
      c.modal = null;
      c.setupSchool = null;
      go("/setup");
      render();
      return;
    case "continue": {
      if (!(await refreshForStep())) return;
      if (!c.state) return;
      say("현재 설정을 확인했어요. 이어하기는 일시정지 상태로 시작해요.");
      try {
        c.state = validateProgress(
          c.state,
          c.config ?? PRACTICE_CONFIG,
          c.warnings.some((x) => x.startsWith("학교 목록")) ? null : c.schools,
        );
      } catch (e) {
        say(e instanceof Error ? e.message : "저장 검증 오류");
        return;
      }
      if (c.state.phase === "escaped") go("/result");
      else if (c.state.phase === "intro") go("/intro");
      else {
        c.state.paused = true;
        c.modal = "pause";
        go("/play");
      }
      render();
      return;
    }
    case "choose-school":
      if (!value || c.schools.some((x) => x.schoolId === value))
        c.setupSchool = value || null;
      render();
      return;
    case "setup-next":
      if (!(await refreshForStep())) return;
      if (
        c.setupSchool &&
        !c.schools.some((x) => x.schoolId === c.setupSchool)
      ) {
        say(
          "선택한 학교를 확인하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.",
        );
        render();
        return;
      }
      disposeScene();
      // Saves require options.authored to match an attached pack of the same story.
      if (
        c.lessonDraft?.authored &&
        c.authorDraft?.episode !== c.lessonDraft.episode
      )
        c.lessonDraft.authored = false;
      c.learning = createExperience(
        c.lessonDraft,
        c.learning?.extras.seed ?? 0,
      );
      if (c.lessonDraft?.authored && c.authorDraft)
        c.learning.extras.custom = validateLessonPack(c.authorDraft);
      c.state = createProgress(
        isPracticeLesson(c.learning.options)
          ? { ...(c.config ?? PRACTICE_CONFIG), activeRound: null }
          : (c.config ?? PRACTICE_CONFIG),
        c.schools.some((x) => x.schoolId === c.setupSchool)
          ? c.setupSchool
          : null,
      );
      c.state.settings = { sound: c.setupSound, reducedMotion: c.setupReduced };
      c.selected = null;
      c.objectId = null;
      c.held = null;
      c.device = "main";
      c.reward = null;
      c.ballPath = [];
      c.reflection = null;
      c.modal = null;
      persist();
      go("/intro");
      return;
    case "start":
      if (s?.phase === "intro") {
        c.modal = null;
        if (!phonePortrait.matches) {
          launchImmersion = false;
          void fullscreen.enter();
          s.phase = "playing";
          s.paused = false;
          hintClock.reset();
          mistakes = 0;
          c.hintSuggested = false;
        }
        persist();
        go("/play");
        render();
        tick();
      }
      return;
    case "home":
      void fullscreen.exit();
      go("/");
      return;
    case "fullscreen":
      // Close the dialog synchronously, before entering the fullscreen top layer.
      // Keep this before the first await so the native request retains activation.
      if (c.modal === "game-menu") {
        c.modal = null;
        render("fullscreen:");
      }
      await fullscreen.toggle();
      mountScene();
      return;
    case "scene-mode":
      c.modal = null;
      c.sceneMode = c.sceneMode === "3d" ? "2d" : "3d";
      c.sceneFailed = false;
      render("scene-mode:");
      return;
    case "modal":
      if (
        [
          "bag",
          "notes",
          "hint",
          "settings",
          "objects",
          "team",
          "team-puzzle",
          "navigation",
          "game-menu",
          "tutorial",
          "space-map",
          "friend-talk",
        ].includes(value)
      ) {
        if (value === "tutorial") c.tutorialStep = 0;
        openModal(value);
      }
      if (value === "hint") {
        c.hintSuggested = false;
        mistakes = 0;
        hintClock.reset();
      }
      return;
    case "follow-clue":
      if (!s || !active(s)) return;
      c.modal = null;
      c.reward = null;
      await handle("inspect", value);
      return;
    case "reward-room":
      c.modal = null;
      c.reward = null;
      c.objectId = null;
      c.held = null;
      render();
      document
        .querySelector<HTMLElement>(".hotspot")
        ?.focus({ preventScroll: true });
      root.scrollTop = 0;
      window.scrollTo(0, 0);
      return;
    case "close-modal":
      closeModal();
      return;
    case "pause":
      pause();
      return;
    case "easy-mode":
      if (!s || !c.learning || !useEasyMode(s, c.learning)) return;
      c.lessonDraft = { ...c.learning.options };
      persist();
      render();
      say("쉬운 난이도로 바꿨어요. 찾은 단서·도구·점수는 그대로예요.");
      return;
    case "resume": {
      // The first resume after launching enters fullscreen (browsers need this tap);
      // later resumes respect a player who left fullscreen on purpose.
      if (launchImmersion && !phonePortrait.matches && route() === "/play") {
        launchImmersion = false;
        void fullscreen.enter();
      }
      resume();
      return;
    }
    case "save-home":
      void fullscreen.exit();
      c.modal = null;
      persist();
      go("/");
      return;
    case "erase-confirm":
      openModal("erase");
      return;
    case "erase": {
      const ok = storage ? eraseProgress(storage, key) : true;
      if (!ok) {
        say(
          "저장 삭제를 사용할 수 없어요. 브라우저의 사이트 데이터 설정을 확인해 주세요.",
        );
        return;
      }
      disposeScene();
      try {
        storage?.removeItem(experienceKey(key));
        saveCoordinator.wrote();
      } catch {}
      void fullscreen.exit();
      c.state = null;
      c.saved = false;
      c.selected = null;
      c.objectId = null;
      c.modal = null;
      c.reflection = null;
      go("/");
      render();
      say("이 앱의 활동 기록만 지웠어요.");
      return;
    }
    case "refresh-config": {
      const old = contextId();
      await data();
      if (old !== contextId()) {
        resetImport();
        say("설정·학교 목록이 바뀌어 집계 내용을 초기화했어요.");
      } else say("현재 설정을 다시 확인했어요.");
      render();
      return;
    }
    case "reload-data":
      await data();
      render();
      say("정적 데이터를 다시 읽었어요.");
      return;
    case "export": {
      await data();
      const reason = exportReason(c.state, c.config, c.schools);
      if (reason) {
        render();
        say(reason);
        return;
      }
      download(
        resultFile(c.state!, c.config!, c.schools),
        "classroom-escape-result.json",
      );
      render();
      say(
        "결과 파일을 저장했어요. 공식 순위 반영은 운영자 확인 후 이루어져요.",
      );
      return;
    }
    case "print":
      window.print();
      return;
    case "reflect":
      if (s?.phase === "escaped" && Number(value) >= 0 && Number(value) < 5) {
        c.reflection = Number(value);
        render();
      }
      return;
    case "conflict": {
      const [index, choice] = value.split(":");
      if (choice === "keep" || choice === "replace")
        resolveConflict(c.aggregate, Number(index), choice);
      render();
      return;
    }
    case "reset-import":
      resetImport();
      render();
      return;
    case "aggregate-download": {
      const previous = toolContext;
      await data();
      if (previous && previous !== contextId()) {
        resetImport();
        render();
        say("설정이 바뀌었어요. 현재 회차 파일을 다시 선택해 주세요.");
        return;
      }
      try {
        if (!c.config) throw new Error("유효한 현재 설정이 필요해요.");
        download(
          aggregateFile(c.aggregate, c.config, c.schools),
          "rankings.json",
        );
        say(
          "새 순위 파일을 로컬로 저장했어요. 운영자가 확인한 뒤 저장소에 반영해 주세요.",
        );
      } catch (e) {
        say(e instanceof Error ? e.message : "순위 생성 오류");
      }
      render();
      return;
    }
  }
  if (!s || !active(s) || route() !== "/play") return;
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
        say(
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
      pendingScenePlace = value;
      render();
      persist();
      return;
    case "inspect":
      if (c.sceneMode === "3d" && classroom) {
        c.modal = null;
        c.reward = null;
        c.objectId = null;
        render();
        classroom.focusObject(value);
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
          openModal("team-puzzle");
          return;
        }
        c.objectId = null;
        c.modal = null;
        pendingSceneOperation = value;
        render();
        persist();
        return;
      }
    // The accessible 2D view uses the same investigation rules.
    case "inspect-direct": {
      panelReturnFocus = "inspect:" + value;
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
      c.objectId = value;
      if (
        c.selected === "final-key" &&
        value === "O12" &&
        canEscape(s, c.selected)
      ) {
        persist();
        openModal("exit-confirm");
        return;
      }
      const selected = c.selected;
      const applied = selected ? applyItem(s, selected, value) : null;
      if (applied?.ok) c.selected = null;
      if (c.learning) assistProgress(s, c.learning);
      persist();
      render();
      document.getElementById("panel-title")?.focus({ preventScroll: true });
      root.scrollTop = 0;
      window.scrollTo(0, 0);
      if (applied) say(applied.message);
      checkDevice();
      return;
    }
    case "close-panel":
      c.objectId = null;
      c.held = null;
      c.device = "main";
      persist();
      render(panelReturnFocus);
      root.scrollTop = 0;
      window.scrollTo(0, 0);
      return;
    case "device":
      if (value === "bonus" && c.learning?.options.minutes === 15) {
        say("15분 활동은 필수 다섯 퍼즐에 집중해요.");
        return;
      }
      c.device = value === "bonus" ? "bonus" : "main";
      c.held = null;
      c.bonusHintLevel = 0;
      persist();
      render();
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
        await handle("inspect", "O04");
      }
      return;
    }
    case "place-lens": {
      if (c.objectId !== "O04") return;
      const lens = s.inventory.find((id) => id.endsWith("lens")) ?? null;
      const result = applyItem(s, lens, "O04");
      if (result.ok) c.selected = null;
      if (c.learning) assistProgress(s, c.learning);
      outcome(result);
      return;
    }
    case "key-exit":
      if (s.finalKeyObtained) {
        c.selected = "final-key";
        await handle("inspect", "O12");
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
          outcome(solveBonus(s, "B4", s.puzzles.b4));
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
      render();
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
        persist();
        render("select-item:" + value);
        say(
          c.selected
            ? "도구를 골랐어요. 사용할 물건을 눌러요."
            : "도구 선택을 해제했어요.",
        );
      }
      return;
    case "deselect":
      c.selected = null;
      render();
      return;
    case "take":
      if (c.learning?.options.cooperation && !c.learning.coopSolved) {
        openModal("team-puzzle");
        return;
      }
      takeLens(s, value as ItemId);
      if (s.inventory.includes(value as ItemId)) c.selected = value as ItemId;
      persist();
      render();
      say("렌즈를 아래 아이템 칸에 넣었어요.");
      return;
    case "apply": {
      const result = applyItem(s, c.selected, value);
      if (result.ok) c.selected = null;
      if (c.learning) assistProgress(s, c.learning);
      outcome(result);
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
          say("잠금장치가 열리지 않았어요. 창 번호 순서로 다시 읽어 봐요.");
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
          say("빛나는 이웃 칸을 누르거나, 지나온 칸을 눌러 길을 고쳐요.");
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
      await run();
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
        outcome(move(s, value as Place));
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
      if (canEscape(s, c.selected)) openModal("exit-confirm");
      else say("열쇠를 아래 아이템 칸에서 고른 뒤 출구에 사용해요.");
      return;
    case "escape-confirm": {
      const result = escape(s, c.selected);
      c.modal = null;
      persist();
      if (result.ok) {
        void fullscreen.exit();
        go("/result");
        sound("escape");
      }
      render();
      say(result.message);
      return;
    }
    case "bonus": {
      const colon = value.indexOf(":"),
        id = value.slice(0, colon);
      if (["B1", "B2", "B3", "B4"].includes(id))
        outcome(solveBonus(s, id as any, value.slice(colon + 1)));
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
  persist();
  render();
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
  if (c.objectId === "O04" && judgeP2(s)) finishPuzzle("P2");
  checkDevice();
  if (action === "sentence-start")
    document
      .querySelector<HTMLElement>(".npc-dialog h4")
      ?.focus({ preventScroll: true });
}
root.addEventListener("click", (event) => {
  if ((event.target as Element).closest("a.skip-link")) {
    event.preventDefault();
    const main = document.querySelector<HTMLElement>("main");
    if (main) {
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView({ block: "start" });
    }
    return;
  }
  const button = (event.target as Element).closest<HTMLButtonElement>(
    "button[data-action]",
  );
  if (button && !button.disabled)
    void handle(button.dataset.action!, button.dataset.value ?? "").catch((e) =>
      say(
        e instanceof Error
          ? e.message
          : "처리 중 오류가 생겼어요. 다시 시도해 주세요.",
      ),
    );
});
root.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.author) {
    const draft =
      c.authorDraft ?? defaultLessonPack(c.lessonDraft?.episode ?? "classroom");
    const name = input.dataset.author;
    if (name === "episode" && Object.hasOwn(EPISODES, input.value))
      draft.episode = input.value as typeof draft.episode;
    else if (name === "title" || name === "intro" || name === "speech")
      draft[name] = input.value;
    else if (name.startsWith("hint:"))
      draft.hints[name.slice(5) as keyof typeof draft.hints] = input.value;
    c.authorDraft = draft;
    return;
  }
  if (input.dataset.input === "audit-device") {
    c.deviceAudit!.device = input.value;
    return;
  }
  if (
    input.id === "bonus-code" &&
    c.state &&
    active(c.state) &&
    c.state.solvedPuzzleIds.includes("P5")
  ) {
    input.value = input.value.replace(/\D/g, "").slice(0, 3);
    c.state.puzzles.b4 = input.value;
    persist();
  }
  if (input.dataset.input === "school-query") {
    c.schoolQuery = input.value;
    const options = document.getElementById("school-options");
    if (options) options.innerHTML = schoolOptions(c);
  }
});
root.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === "lesson-pack-file") {
    const file = input.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        if (file.size > 16384) throw Error("수업 파일은 16KB 이하로 골라요.");
        c.authorDraft = parseLessonPack(await file.text());
        c.authorStatus =
          "수업 파일을 확인했어요. 문구를 검토하고 새 게임에 적용해요.";
      } catch (error) {
        c.authorStatus =
          error instanceof Error ? error.message : "수업 파일을 확인해요.";
      }
      render();
    })();
    return;
  }
  if (input.id === "result-files") {
    void importFiles(input.files);
    return;
  }
  if (input.dataset.setting) {
    const name = input.dataset.setting;
    if (name === "setup-sound") c.setupSound = input.checked;
    if (name === "setup-reduced") c.setupReduced = input.checked;
    if (c.state) {
      if (name === "sound") c.state.settings.sound = input.checked;
      if (name === "reduced") c.state.settings.reducedMotion = input.checked;
      persist();
    }
    document.documentElement.classList.toggle(
      "reduce-motion",
      c.state?.settings.reducedMotion ?? c.setupReduced,
    );
    syncScene();
  }
});
root.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;
  if (form.dataset.form === "bonus4") {
    event.preventDefault();
    const code = new FormData(form).get("code");
    void handle("bonus", `B4:${code}`);
  }
});
async function importFiles(files: FileList | null) {
  if (!files?.length || c.importBusy) return;
  if (files.length > MAX_FILES) {
    say("한 번에 최대 100개 파일을 선택해요.");
    return;
  }
  const old = contextId();
  await data();
  if (old !== contextId()) {
    resetImport();
    render();
    say("설정이 바뀌었어요. 파일을 다시 선택해 주세요.");
    return;
  }
  if (!c.config?.activeRound?.acceptingResults) {
    say("접수 중인 공식 회차가 필요해요.");
    return;
  }
  if (!toolContext) toolContext = contextId();
  c.importBusy = true;
  render();
  for (const file of files) {
    try {
      if (file.size > 100 * 1024) throw new Error("100KB를 초과했어요.");
      const rows = parseLocalFile(
        await file.text(),
        file.size,
        c.config,
        c.schools,
      );
      for (const row of rows) mergeEntry(c.aggregate, { name: file.name, row });
    } catch (e) {
      c.importErrors.push(
        `${file.name}: ${e instanceof Error ? e.message : "파일 오류"}`,
      );
    }
  }
  c.importBusy = false;
  render();
  say("선택한 파일의 검증을 마쳤어요. 오류 파일은 반영하지 않았어요.");
}
window.addEventListener("hashchange", () => {
  tick();
  c.running = false;
  if (route() !== "/play") {
    c.modal = null;
    void fullscreen.exit();
  }
  if (route() === "/play" && c.state?.paused) c.modal = "pause";
  render();
  document
    .querySelector<HTMLElement>("main h1")
    ?.setAttribute("tabindex", "-1");
  document
    .querySelector<HTMLElement>("main h1")
    ?.focus({ preventScroll: true });
  root.scrollTop = 0;
  window.scrollTo(0, 0);
  tick();
});
phonePortrait.addEventListener("change", () => {
  if (route() === "/play") {
    tick();
    if (phonePortrait.matches) c.running = false;
    if (!phonePortrait.matches && c.state?.phase === "intro" && !c.loading) {
      void handle("start", "");
      return;
    }
    if (!phonePortrait.matches) hintClock.reset();
    render("fullscreen:");
    classroom?.resize();
    tick();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || document.fullscreenElement) return;
  if (event.key === "Escape" && !c.modal && route() === "/play" && c.objectId) {
    event.preventDefault();
    c.objectId = null;
    c.held = null;
    c.device = "main";
    render(panelReturnFocus);
  }
});
document.addEventListener("visibilitychange", () => {
  tick();
  persist();
  mountScene();
});
window.addEventListener("pagehide", () => {
  tick();
  persist();
  saveCoordinator.release();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) void bootstrap();
});
window.addEventListener("storage", (event) => {
  if (event.key === key) saveCoordinator.observe();
});
setInterval(() => {
  tick();
  if (
    c.state &&
    active(c.state) &&
    route() === "/play" &&
    !c.modal &&
    !c.running &&
    !phonePortrait.matches &&
    c.learning &&
    !c.hintSuggested &&
    shouldSuggestHint(hintClock.idleMs, mistakes, c.learning.options)
  ) {
    c.hintSuggested = true;
    render();
  }
  if (performance.now() - lastPersist > 5000 && clockActive) {
    persist();
    lastPersist = performance.now();
  }
}, 250);
void bootstrap();
