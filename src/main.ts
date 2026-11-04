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
import { useEasyMode } from "./game/guidance";
import { EASY_LESSON, lessonForRound } from "./game/learning";
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
  type LessonOptions,
} from "./game/learning";
import {
  createSaveCoordinator,
  readExperience,
  writeExperience,
  experienceKey,
} from "./storage/session";
import { adaptEpisodeHtml, episode, EPISODES } from "./content/episodes";
import { deviceView } from "./ui/learning";
import { updateFeedback, watchStickyHeaders } from "./ui/visibility";
import { createFullscreenController } from "./ui/fullscreen";
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
} from "./game/model";
import {
  inspect,
  solve,
  solveBonus,
  move,
  combine,
  escape,
  type Outcome,
} from "./game/engine";
import {
  runBall,
  extendPath,
  judgeP1,
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
  classBoardView,
  modalShell,
  type ViewContext,
} from "./ui/views";
import { button as b, esc, time } from "./ui/helpers";
import { download } from "./ui/files";
import { createSoundPlayer } from "./ui/audio";
import { mountDeviceAudit } from "./ui/device-audit";
import { materialsAction } from "./actions/materials";
import { createResultsTools } from "./actions/results";
import { addGroupCards, groupCard, MAX_GROUP } from "./tools/classboard";
import { playAction, type PlayHost } from "./actions/play";
import { createSceneMount } from "./actions/scene-mount";
import { plainLanguage, plainText } from "./content/plain";
import {
  speak,
  speechAvailable,
  stopSpeaking,
  readableText,
} from "./ui/speech";

const root = document.querySelector<HTMLDivElement>("#app")!;
const key = saveKey(deploymentBase());
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
// A per-device preference, kept outside the validated save so old saves stay compatible.
const readAloudKey = `classroom-escape:${deploymentBase()}:read-aloud:v1`;
const plainWordsKey = `classroom-escape:${deploymentBase()}:plain-words:v1`;
function preference(key: string) {
  try {
    return storage?.getItem(key) === "on";
  } catch {
    return false;
  }
}
function rememberPreference(key: string, on: boolean) {
  try {
    if (on) storage?.setItem(key, "on");
    else storage?.removeItem(key);
  } catch {}
}
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
  readAloud: preference(readAloudKey),
  plainWords: preference(plainWordsKey),
  speech: speechAvailable(),
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
// Declared before the fullscreen controller, whose change callback reads it.
let launchImmersion = true,
  firstBoot = true;
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
const phonePortrait = matchMedia(
  "(max-width: 600px) and (orientation: portrait), (max-width: 1024px) and (orientation: portrait) and (any-pointer: coarse)",
);
const hintClock = createHintClock();
let mistakes = 0,
  lastMarker = "";
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
  // Leaving fullscreen on purpose ends the launch-time offer to enter it.
  if (!c.immersive) launchImmersion = false;
  // A dialog opened just before fullscreen applied sits under #app in the top
  // layer; reopen it so it stays visible and usable.
  const dialog =
    document.querySelector<HTMLDialogElement>("#game-dialog[open]");
  if (dialog && document.fullscreenElement === root) {
    const focused = document.activeElement as HTMLElement | null;
    dialog.close();
    dialog.showModal();
    focused?.focus({ preventScroll: true });
  }
  // Fullscreen may finish after a temporary hidden/orientation state skipped loading.
  scene.mount();
  scene.current?.resize();
});
const scene = createSceneMount({
  c,
  route: () => route(),
  portrait: () => phonePortrait.matches,
  render: () => render(),
  say: (message) => say(message),
  persist: () => persist(),
  saveBlocked: () => saveBlocked,
  inspect: (id) => void handle("inspect-direct", id),
});
const go = (path: string) => {
  location.hash = path;
};
const resultsTools = createResultsTools({
  c,
  data: () => data(),
  say: (message) => say(message),
  render: () => render(),
});
const contextId = resultsTools.contextId;
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
  const adapted = adaptEpisodeHtml(
    message,
    c.learning?.options.episode ?? "classroom",
    OBJECTS,
  );
  const displayMessage = c.plainWords ? plainText(adapted) : adapted;
  updateFeedback(root, displayMessage);
  if (c.readAloud && c.speech && displayMessage) speak(displayMessage);
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
const player = createSoundPlayer(() => !!c.state?.settings.sound);
function outcome(o: Outcome) {
  persist();
  render();
  say(o.message);
  if (o.ok) player.play();
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
  else if (current === "/class-board") content = classBoardView(c);
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
  scene.host?.remove();
  // Keep the one live region alive across re-renders (innerHTML would discard it).
  document.body.append(announcer);
  const markup = `<a class="skip-link" href="#main">본문으로 바로가기</a>${header(c)}${c.storageWarning ? `<p class="storage-warning" role="status">${SAVE_WARNING}</p>` : ""}${content}${footer()}<div id="toast" class="toast" ${c.toast ? "" : "hidden"}>${esc(c.toast)}</div>${c.modal && !landscapeBlocked ? `<dialog id="game-dialog" data-kind="${esc(c.modal)}" aria-labelledby="dialog-title">${modalShell(c)}</dialog>` : ""}`;
  root.innerHTML = ["/", "/play", "/intro", "/result", "/progress"].includes(
    current,
  )
    ? (c.plainWords && ["/play", "/intro", "/result"].includes(current)
        ? plainLanguage
        : (x: string) => x)(
        customizeHtml(
          adaptEpisodeHtml(
            markup,
            c.learning?.options.episode ?? "classroom",
            OBJECTS,
          ),
          c.learning?.extras.custom,
          c.learning?.options.episode ?? "classroom",
        ),
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
  mountDeviceAudit(c.deviceAudit!);
  scene.mount();
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
  // A dialog starts without the previous screen's feedback (e.g. an old arrival message).
  if (name !== c.modal) c.toast = "";
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
  let notice = "";
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
      // Every launch opens the 3D room; a picture-mode choice lasts only for its
      // session, so later bootstraps (retry, back-forward restore) keep it.
      if (firstBoot) c.sceneMode = "3d";
      // A copy: editor input must not mutate the running game's saved lesson pack.
      c.authorDraft = c.learning.extras.custom
        ? structuredClone(c.learning.extras.custom)
        : c.learning.extras.custom;
      c.reflection = null;
      lastMarker = progressMarker(c.state);
    }
    c.saved = Boolean(loaded.state);
    firstBoot = false;
    if (loaded.error)
      c.warnings.push(`이어하기 기록을 사용할 수 없어요: ${loaded.error}`);
    if (loaded.notice) {
      notice = loaded.notice;
      c.warnings.push(loaded.notice);
      if (storage && c.state && !saveBlocked)
        saveProgress(storage, key, c.state);
    }
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
    // The home screen lists warnings; opened straight into the game, say it there.
    if (notice && route() === "/play") say(notice);
    tick();
  }
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
  player.play("piece");
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
    player.play("piece");
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
/** Fullscreen needs a fresh tap; without one (e.g. rotating a phone) wait for the next tap. */
function enterLaunchImmersion() {
  if (navigator.userActivation && !navigator.userActivation.isActive) {
    launchImmersion = true;
    return;
  }
  launchImmersion = false;
  void fullscreen.enter();
}
document.addEventListener(
  "click",
  (event) => {
    // Not from dialogs (a modal opened in the same tap would sit under the
    // fullscreen layer) and not from taps that leave play anyway.
    if (
      launchImmersion &&
      !c.modal &&
      !(event.target as Element).closest?.(
        '#game-dialog, [data-action="fullscreen"], [data-action="modal"], [data-action="pause"], [data-action="home"], [data-action="save-home"], [data-action="use-exit"]',
      ) &&
      !phonePortrait.matches &&
      route() === "/play" &&
      c.state?.phase === "playing" &&
      !c.state.paused
    )
      enterLaunchImmersion();
  },
  true,
);
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
const playHost: PlayHost = {
  c,
  root,
  say,
  render,
  persist,
  finishPuzzle,
  checkDevice,
  openModal,
  go,
  outcome,
  run,
  handle: (action, value) => handle(action, value),
  player,
  fullscreen,
  scene: () => scene.current,
  setPendingPlace: (place) => scene.setPendingPlace(place),
  setPendingOperation: (objectId) => scene.setPendingOperation(objectId),
  panelReturnFocus: () => panelReturnFocus,
  setPanelReturnFocus: (focus) => {
    panelReturnFocus = focus;
  },
};
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
  if (await resultsTools.action(action, value)) return;
  if (
    materialsAction(action, value, {
      c,
      onPlay: () => route() === "/play",
      render: () => render(),
      openModal,
      go,
    })
  )
    return;
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
    case "save-retry":
      saveBlocked = !(await saveCoordinator.acquire());
      if (!saveBlocked) {
        scene.dispose();
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
      scene.dispose();
      // Saves require options.authored to match an attached pack of the same story.
      if (
        c.lessonDraft?.authored &&
        c.authorDraft?.episode !== c.lessonDraft.episode
      )
        c.lessonDraft.authored = false;
      c.learning = createExperience(
        lessonForRound(
          c.lessonDraft ?? EASY_LESSON,
          c.config?.activeRound?.acceptingResults
            ? c.config.activeRound.season
            : undefined,
        ),
        c.learning?.extras.seed ?? 0,
        c.draftSeed,
      );
      c.draftSeed = undefined;
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
          player.prime();
          enterLaunchImmersion();
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
      launchImmersion = false;
      // Close the dialog synchronously, before entering the fullscreen top layer.
      // Keep this before the first await so the native request retains activation.
      if (c.modal === "game-menu") {
        c.modal = null;
        render("fullscreen:");
      }
      await fullscreen.toggle();
      scene.mount();
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
      stopSpeaking();
      closeModal();
      return;
    case "pause":
      stopSpeaking();
      pause();
      return;
    case "read-aloud":
      speak(
        value === "dialog"
          ? readableText(document.querySelector("#game-dialog"))
          : readableText(
              root.querySelector("#panel-title"),
              root.querySelector(".zoom-device"),
            ),
      );
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
      player.prime();
      if (launchImmersion && !phonePortrait.matches && route() === "/play")
        enterLaunchImmersion();
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
      scene.dispose();
      try {
        storage?.removeItem(experienceKey(key));
        storage?.removeItem(readAloudKey);
        storage?.removeItem(plainWordsKey);
        saveCoordinator.wrote();
      } catch {}
      void fullscreen.exit();
      stopSpeaking();
      c.readAloud = false;
      c.plainWords = false;
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
        resultsTools.reset();
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
    case "group-number": {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 1 && n <= MAX_GROUP) c.groupNumber = n;
      render(`group-number:${value}`);
      return;
    }
    case "group-card":
      if (!s || !c.groupNumber || s.phase === "intro") return;
      download(
        groupCard(s, c.learning?.options.episode ?? "classroom", c.groupNumber),
        `모둠-${c.groupNumber}-${s.phase === "escaped" ? "기록" : "진행"}.json`,
      );
      say(
        `${c.groupNumber}모둠 기록 카드를 저장했어요. 선생님 기기의 ‘우리 반 결과판’에서 열어요.`,
      );
      return;
    case "board-reset":
      c.classBoard = { cards: [], messages: [] };
      render();
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
  }
  if (!s || !active(s) || route() !== "/play") return;
  await playAction(action, value, playHost);
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
    else if (name.startsWith("object:")) {
      const objects = { ...draft.objects };
      if (input.value.trim()) objects[name.slice(7)] = input.value;
      else delete objects[name.slice(7)];
      draft.objects = objects;
    }
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
  if (input.id === "group-files") {
    const files = [...(input.files ?? [])].slice(0, 40);
    void Promise.all(
      files.map(async (f) => ({
        name: f.name,
        text: f.size > 4096 ? "x".repeat(4097) : await f.text(),
      })),
    ).then((read) => {
      c.classBoard = addGroupCards(
        c.classBoard ?? { cards: [], messages: [] },
        read,
      );
      input.value = "";
      render();
      say(`모둠 기록 카드 ${read.length}개를 읽었어요.`);
    });
    return;
  }
  if (input.id === "result-files") {
    void resultsTools.importFiles(input.files);
    return;
  }
  if (input.dataset.setting) {
    const name = input.dataset.setting;
    if (name === "setup-sound") c.setupSound = input.checked;
    if (name === "setup-reduced") c.setupReduced = input.checked;
    if (name === "read-aloud" || name === "plain-words") {
      if (name === "read-aloud") {
        c.readAloud = input.checked;
        rememberPreference(readAloudKey, input.checked);
        if (!input.checked) stopSpeaking();
      } else {
        c.plainWords = input.checked;
        rememberPreference(plainWordsKey, input.checked);
      }
      render();
      root
        .querySelector<HTMLInputElement>(`[data-setting="${name}"]`)
        ?.focus({ preventScroll: true });
      return;
    }
    if (c.state) {
      if (name === "sound") {
        c.state.settings.sound = input.checked;
        player.prime();
      }
      if (name === "reduced") c.state.settings.reducedMotion = input.checked;
      persist();
    }
    document.documentElement.classList.toggle(
      "reduce-motion",
      c.state?.settings.reducedMotion ?? c.setupReduced,
    );
    scene.sync();
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
window.addEventListener("hashchange", () => {
  tick();
  stopSpeaking();
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
    scene.current?.resize();
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
  if (document.hidden) stopSpeaking();
  persist();
  scene.mount();
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
