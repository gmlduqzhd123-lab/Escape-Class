import "./style.css";
import "./ui/experience.css";

// 홈 화면 설치·오프라인 열기 (배포판에서만)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
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
import { FRAGMENTS } from "./content/data";
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
  play,
  result,
  rankings,
  teacher,
  toolsView,
  modalContent,
  type ViewContext,
} from "./ui/views";
import { button as b, esc, icon, time } from "./ui/helpers";

const root = document.querySelector<HTMLDivElement>("#app")!;
const key = saveKey(deploymentBase());
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
const c: ViewContext = {
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
  setupReduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
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
let toolContext = "";
const route = () => location.hash.replace(/^#/, "") || "/";
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
    c.state && active(c.state) && route() === "/play" && !document.hidden,
  );
  const timer = document.getElementById("timer");
  if (timer && c.state) timer.textContent = time(c.state.elapsedMs);
}
function persist() {
  if (!c.state) return;
  if (!storage || !saveProgress(storage, key, c.state)) c.storageWarning = true;
  else c.saved = true;
}
function say(message: string) {
  c.toast = message;
  const status = document.getElementById("announcer");
  if (status) status.textContent = message;
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.hidden = false;
  }
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    c.toast = "";
    const t = document.getElementById("toast");
    if (t) t.hidden = true;
  }, 6500);
}
function sound() {
  if (c.state?.settings.sound)
    void new Audio(asset("assets/chime.wav")).play().catch(() => {});
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
  const a = document.activeElement as HTMLElement | null;
  const focus = focusKey ?? a?.dataset.focus;
  const scroll = window.scrollY;
  const dialogScroll = document.querySelector("dialog")?.scrollTop ?? 0;
  const previousDevice = document.querySelector<HTMLElement>(".zoom-device");
  const deviceKey = previousDevice?.dataset.device;
  const deviceScroll = previousDevice?.scrollTop ?? 0;
  const current = route();
  let content = "";
  if (c.loading)
    content =
      '<main id="main" class="narrow loading"><div class="loader"></div><h1>교실 문을 여는 중이에요</h1><p>게임 데이터와 꼭 필요한 자산을 확인하고 있어요.</p></main>';
  else if (c.loadError)
    content = `<main id="main" class="narrow"><h1>교실을 준비하지 못했어요</h1><p>필수 그림·글꼴·소리를 읽지 못했어요. 연결을 확인하고 다시 시도해 주세요.</p>${b("다시 준비하기", "retry", "", 'class="primary"')}</main>`;
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
  else if (current === "/teacher") content = teacher();
  else if (current === "/tools/results") content = toolsView(c);
  else content = home(c);
  document.documentElement.classList.toggle(
    "reduce-motion",
    c.state?.settings.reducedMotion ?? c.setupReduced,
  );
  document.body.classList.toggle("in-game", current === "/play");
  root.innerHTML = `<a class="skip-link" href="#main">본문으로 바로가기</a>${header(c)}${c.storageWarning ? `<p class="storage-warning" role="status">${SAVE_WARNING}</p>` : ""}${content}${footer()}<div id="announcer" class="sr-only" role="status" aria-live="polite"></div><div id="toast" class="toast" ${c.toast ? "" : "hidden"}>${esc(c.toast)}</div>${c.modal ? `<dialog id="game-dialog" aria-labelledby="dialog-title">${b(icon("close"), "close-modal", "", 'class="dialog-close icon-button" aria-label="대화상자 닫기"')}${modalContent(c)}</dialog>` : ""}`;
  const device = document.querySelector<HTMLElement>(".zoom-device");
  if (device && device.dataset.device === deviceKey)
    device.scrollTop = deviceScroll;
  const scrollCue = document.querySelector<HTMLElement>(".device-scroll-cue");
  if (device && scrollCue) {
    const updateCue = () => {
      scrollCue.hidden = device.scrollHeight <= device.clientHeight + 2;
      scrollCue.textContent =
        device.scrollTop + device.clientHeight < device.scrollHeight - 8
          ? "↓ 아래에도 장치가 있어요 · 위아래로 움직여 살펴봐요"
          : "↑ 위쪽 단서를 다시 살펴볼 수 있어요";
    };
    updateCue();
    device.addEventListener("scroll", updateCue, { passive: true });
  }
  const dialog = document.querySelector<HTMLDialogElement>("#game-dialog");
  if (dialog) {
    dialog.showModal();
    dialog.scrollTop = dialogScroll;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeModal();
    });
  }
  const restored = focus ? findFocus(focus) : null;
  if (restored && !restored.hasAttribute("disabled"))
    restored.focus({ preventScroll: true });
  else if (!dialog && focus) {
    const fallback = document.querySelector<HTMLElement>(
      "#panel-title, main h1",
    );
    if (fallback) {
      fallback.tabIndex = -1;
      fallback.focus({ preventScroll: true });
    }
  }
  window.scrollTo({ top: scroll, behavior: "instant" });
}
function openModal(name: string) {
  if (name === "hint") c.bonusHintLevel = 0;
  dialogReturnFocus =
    (document.activeElement as HTMLElement)?.dataset.focus ?? "";
  c.modal = name;
  render();
}
function closeModal() {
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
  c.state.paused = true;
  c.running = false;
  c.modal = "pause";
  tick();
  persist();
  render();
}
function resume() {
  if (!c.state) return;
  c.state.paused = false;
  c.modal = null;
  tick();
  persist();
  render("pause:");
}
async function data() {
  c.warnings = [];
  const results = await Promise.allSettled([readConfig(), readSchools()]);
  c.config = results[0].status === "fulfilled" ? results[0].value : null;
  c.schools = results[1].status === "fulfilled" ? results[1].value : [];
  if (!c.config)
    c.warnings.push(
      "회차 설정을 읽지 못했어요. 연습은 가능하지만 공식 내보내기는 사용할 수 없어요.",
    );
  if (results[1].status === "rejected")
    c.warnings.push(
      "학교 목록을 읽지 못했어요. 학교 없이 체험으로 진행할 수 있어요.",
    );
  c.ranking = null;
  if (c.config && results[1].status === "fulfilled")
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
    const loaded = storage
      ? loadProgress(
          storage,
          key,
          c.config ?? PRACTICE_CONFIG,
          c.warnings.some((x) => x.startsWith("학교 목록")) ? null : c.schools,
        )
      : { state: null, error: null };
    c.state = loaded.state;
    c.saved = Boolean(loaded.state);
    if (loaded.error)
      c.warnings.push(`이어하기 기록을 사용할 수 없어요: ${loaded.error}`);
    if (c.state?.paused && route() === "/play") c.modal = "pause";
  } catch {
    c.loadError = true;
  } finally {
    c.loading = false;
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
    title: FRAGMENTS[PUZZLES.indexOf(id)] + " 조각을 찾았어요!",
    text: texts[PUZZLES.indexOf(id)],
    next: nexts[PUZZLES.indexOf(id)],
  };
  persist();
  openModal("reward");
  sound();
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
    sound();
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
async function handle(action: string, value: string) {
  tick();
  clearTimeout(toastTimeout);
  c.toast = "";
  const previousToast = document.getElementById("toast");
  if (previousToast) previousToast.hidden = true;
  const s = c.state;
  switch (action) {
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
      await data();
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
      await data();
      c.state = createProgress(
        c.config ?? PRACTICE_CONFIG,
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
        s.phase = "playing";
        s.paused = false;
        persist();
        go("/play");
      }
      return;
    case "home":
      go("/");
      return;
    case "modal":
      if (["bag", "notes", "hint", "settings", "objects"].includes(value))
        openModal(value);
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
      window.scrollTo(0, 0);
      return;
    case "close-modal":
      closeModal();
      return;
    case "pause":
      pause();
      return;
    case "resume":
      resume();
      return;
    case "save-home":
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
    case "inspect": {
      panelReturnFocus = "inspect:" + value;
      c.modal = null;
      c.held = null;
      c.device = "main";
      c.bonusHintLevel = 0;
      inspect(s, value);
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
      persist();
      render();
      document.getElementById("panel-title")?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      if (applied) say(applied.message);
      checkDevice();
      return;
    }
    case "close-panel":
      c.objectId = null;
      c.held = null;
      c.device = "main";
      render(panelReturnFocus);
      window.scrollTo(0, 0);
      return;
    case "device":
      c.device = value === "bonus" ? "bonus" : "main";
      c.held = null;
      c.bonusHintLevel = 0;
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
      takeLens(s, value as ItemId);
      if (s.inventory.includes(value as ItemId)) c.selected = value as ItemId;
      persist();
      render();
      say("렌즈를 아래 아이템 칸에 넣었어요.");
      return;
    case "apply": {
      const result = applyItem(s, c.selected, value);
      if (result.ok) c.selected = null;
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
          s.puzzles.p2.code += value;
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
          dialog.scrollIntoView({ block: "center", behavior: "instant" });
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
        go("/result");
        sound();
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
  if (route() !== "/play") c.modal = null;
  if (route() === "/play" && c.state?.paused) c.modal = "pause";
  render();
  document
    .querySelector<HTMLElement>("main h1")
    ?.setAttribute("tabindex", "-1");
  document
    .querySelector<HTMLElement>("main h1")
    ?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  tick();
});
window.addEventListener("keydown", (event) => {
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
});
window.addEventListener("pagehide", () => {
  tick();
  persist();
});
setInterval(() => {
  tick();
  if (performance.now() - lastPersist > 5000 && clockActive) {
    persist();
    lastPersist = performance.now();
  }
}, 250);
void bootstrap();
