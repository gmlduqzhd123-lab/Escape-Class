import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const base = process.env.APP_URL || "http://127.0.0.1:4173/classroom-escape/";
const evidence = resolve(process.env.EVIDENCE_DIR || "work/browser-current");
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const report = {
  base,
  engine: "Installed Microsoft Edge, Playwright headless",
  startedAt: new Date().toISOString(),
  checks: [],
  consoleErrors: [],
  requests: [],
  screenshots: [],
};
const pass = (name, details = "") => {
  report.checks.push({ name, status: "PASS", details });
  console.log("PASS " + name);
};
let currentPage;
function track(page) {
  currentPage = page;
  page.on("pageerror", (e) => report.consoleErrors.push(e.message));
  page.on("request", (r) =>
    report.requests.push({ url: r.url(), method: r.method() }),
  );
}
async function shot(page, name) {
  const path = resolve(evidence, name + ".png");
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}
const saved = (page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("classroom-escape:") && k.endsWith(":progress:v1"),
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
async function layout(page, name, targets = true) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    name + " horizontal overflow",
  );
  if (targets)
    // A re-render can swap buttons mid-measure (detached ones read 0x0), so re-measure until settled.
    await expect(async () => {
      const small = await page.locator("button:visible").evaluateAll((els) =>
        els
          .map((el) => ({
            label: el.textContent.trim().slice(0, 45),
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          }))
          .filter((r) => r.width < 43.9 || r.height < 43.9),
      );
      assert.deepEqual(small, [], name + " target size");
    }).toPass({ timeout: 5000 });
  if (await page.locator(".escape-play").count()) {
    // Investigation views scroll as one page since 1.6, so only the explore view pins its tools.
    const pinned = !(await page.locator(".escape-play.device-fill").count());
    assert.doesNotMatch(
      await page.locator(".escape-play").innerText(),
      /\b(?:O\d{2}|P[1-5](?:-C[1-5])?|F[1-5]|R[0-2])\b/,
      name + " internal IDs",
    );
    // The 3D explore view keeps tools in the bottom dock; device views keep the pocket tray.
    if (pinned) {
      const tray = await page
        .locator(".pocket-tray, .explore-dock")
        .first()
        .boundingBox();
      assert.ok(
        tray.y >= 0 && tray.y + tray.height <= page.viewportSize().height,
        name + " inventory visible",
      );
    }
  }
}
function driver(page, keyboard) {
  const room = () => page.locator("#classroom-scene, .adventure-room").first();
  const act = async (action, value, scope = page) => {
    const el = scope
      .locator(
        `button[data-action="${action}"]${value === undefined ? "" : `[data-value="${value}"]`}`,
      )
      // Layouts can keep a hidden duplicate (e.g. the HUD pause in landscape), so act on what is shown.
      .filter({ visible: true })
      .first();
    await expect(el).toBeEnabled();
    if (keyboard) {
      await el.focus();
      await page.keyboard.press("Enter");
    } else await el.click();
  };
  const inspect = async (id) => {
    if (await page.locator('[data-action="close-panel"]').count())
      await act("close-panel");
    await room().waitFor();
    // The 3D explore dock moved the object list into the game menu.
    if (
      !(await page
        .locator('button[data-action="modal"][data-value="objects"]')
        .count())
    )
      await act("modal", "game-menu");
    await act("modal", "objects");
    await act("inspect", id, page.getByRole("dialog"));
    // In 3D the same accessible object list walks to the target before opening it.
    await page.locator(`.zoom-device[data-device="${id}:main"]`).waitFor();
  };
  const reward = async (next = true) => {
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/見|조각|지도/);
    await act(next ? "follow-clue" : "reward-room");
    if (next) await page.locator("#panel-title").waitFor();
    else await room().waitFor();
  };
  return { act, inspect, reward, room };
}
const path = [10, 5, 0, 1, 2, 7, 12, 17, 22, 23, 24, 19, 14];
// New games default to the guided difficulty since 1.6; this scenario covers official rules.
// Setup screens can re-render right after opening (e.g. a storage warning), so each step retries until it lands.
async function officialRules(page, d) {
  const official = page.locator(
    'button[data-action="lesson"][data-value="official"]',
  );
  await expect(async () => {
    const disclosure = page.locator(
      'details[data-disclosure="lesson-settings"]',
    );
    if (await disclosure.count())
      await disclosure.evaluate((el) => {
        el.open = true;
      });
    await expect(official).toBeVisible({ timeout: 1000 });
  }).toPass();
  await d.act("lesson", "official");
}
async function toStory(page, d) {
  const intro = page.getByRole("heading", { name: "우정 열쇠가 사라졌어요!" });
  await expect(async () => {
    if (!(await intro.isVisible())) await d.act("setup-next");
    await expect(intro).toBeVisible({ timeout: 1000 });
  }).toPass();
}
async function start(page, d, school) {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  await d.act("new");
  if (school) await d.act("choose-school", school);
  await officialRules(page, d);
  await toStory(page, d);
  const before = await saved(page).catch(() => null);
  await page.waitForTimeout(350);
  if (before) assert.equal((await saved(page)).elapsedMs, before.elapsedMs);
  await d.act("start");
  await d.room().waitFor();
}
async function play(
  page,
  { keyboard = false, bonusAll = false, prefix = "mobile" } = {},
) {
  const d = driver(page, keyboard),
    { act, inspect, reward } = d;
  await layout(page, prefix + " room");
  assert.equal(await page.locator(".object-list").count(), 0);
  await shot(page, prefix + "-01-room");
  await inspect("O04");
  await expect(page.locator(".physical-lock")).toBeVisible();
  await inspect("O11");
  assert.equal((await saved(page)).finalKeyObtained, false);
  pass(prefix + " prerequisites and key hidden before assembled map");
  await inspect("O03");
  await inspect("O02");
  await layout(page, prefix + " memo");
  await act("modal", "hint");
  await expect(page.getByRole("dialog")).toContainText("반쪽 메모 힌트");
  await act("next-hint", "P1");
  await act("close-modal");
  // Wrong order can be taken out and placed again, without a submit button.
  assert.equal(await page.locator(".flip-card").count(), 0);
  await act("memo-pick", "P1-C2");
  await act("memo-remove", "0");
  for (const id of ["P1-C1", "P1-C3", "P1-C5"]) await act("memo-pick", id);
  assert.deepEqual((await saved(page)).solvedPuzzleIds, ["P1"]);
  await shot(page, prefix + "-02-reward");
  await reward(false);
  assert.deepEqual((await saved(page)).solvedPuzzleIds, ["P1"]);
  await inspect("O04");
  await expect(page.locator(".physical-lock")).toHaveCount(0);
  await inspect("O02");
  await act("device", "bonus");
  assert.equal(await page.locator(".memo-board").count(), 0);
  await act("modal", "hint");
  await expect(page.getByRole("dialog")).toContainText("초대장 힌트");
  await act("next-hint", "B3");
  await act("close-modal");
  for (const n of ["3", "1", "2"]) await act("invite-add", n);
  assert.equal((await saved(page)).foundBonusIds.includes("B3"), false);
  for (let i = 2; i >= 0; i--) await act("invite-remove", String(i));
  for (const n of ["1", "2", "3"]) await act("invite-add", n);
  assert.equal((await saved(page)).foundBonusIds.includes("B3"), true);
  pass(
    prefix +
      " physical memo auto-complete, reward, unlocked cipher and separate bonus hints",
  );
  await inspect("O10");
  await act("bonus", "B1:별");
  await act("bonus", "B1:하트");
  await inspect("O06");
  await act("take", "shared-lens");
  if (bonusAll) {
    await act("device", "bonus");
    await act("bonus", "B2:함께 쓰기");
  }
  await expect(page.locator(".pocket-item.equipped")).toBeVisible();
  await inspect("O01");
  assert.equal((await saved(page)).inventory.includes("shared-lens"), true);
  await expect(page.locator(".pocket-item.equipped")).toBeVisible();
  await inspect("O04");
  assert.equal((await saved(page)).puzzles.p2.lensUsed, "shared-lens");
  assert.equal(
    await page.locator('[data-action="code"][data-value="7"]').isDisabled(),
    true,
  );
  for (let i = 0; i < 3; i++) await act("lens-rotate");
  for (const n of ["1", "1", "1"]) await act("code", n);
  assert.equal((await saved(page)).solvedPuzzleIds.length, 1);
  assert.equal(
    await page
      .locator(".zoom-device")
      .evaluate((el) => el.scrollHeight > el.clientHeight + 2),
    false,
    prefix + " no nested scroll",
  );
  await layout(page, prefix + " lens");
  await shot(page, prefix + "-03-lens");
  for (const n of ["7", "1", "3"]) await act("code", n);
  assert.equal((await saved(page)).solvedPuzzleIds.length, 2);
  await reward();
  pass(
    prefix +
      " select tool then target, wrong target retained, lens alignment and automatic keypad",
  );
  // The incomplete route can be corrected and persists through a paused reload.
  await act("path-step", "11");
  await act("path-undo");
  await expect(
    page.locator('[data-action="path-step"][data-value="0"]'),
  ).toBeDisabled();
  await act("path-step", "11");
  await act("path-step", "10");
  assert.deepEqual((await saved(page)).puzzles.p3.path, [10]);
  for (const cell of [11, 12, 13, 14]) await act("path-step", String(cell));
  await act("ball-run");
  assert.equal((await saved(page)).solvedPuzzleIds.length, 2);
  assert.equal((await saved(page)).puzzles.p3.path.at(-1), 14);
  await act("path-reset");
  await act("path-step", "5");
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("잠깐, 쉬어 가요");
  assert.deepEqual((await saved(page)).puzzles.p3.path, [10, 5]);
  await act("resume");
  await inspect("O07");
  for (const cell of path.slice(2)) await act("path-step", String(cell));
  await layout(page, prefix + " ball");
  await shot(page, prefix + "-04-route");
  await act("ball-run");
  await expect(page.getByRole("dialog")).toContainText("함께하기 조각");
  assert.equal((await saved(page)).solvedPuzzleIds.length, 3);
  await reward();
  pass(
    prefix +
      " adjacent-cell route, wrong route, undo/reset, partial reload and four friends",
  );
  for (const id of ["photo-1", "photo-2"]) await act("switch", id);
  assert.equal((await saved(page)).solvedPuzzleIds.length, 3);
  await act("switch", "help-1");
  await layout(page, prefix + " network");
  await shot(page, prefix + "-05-network");
  await act("switch", keyboard ? "help-3" : "help-2");
  assert.equal((await saved(page)).solvedPuzzleIds.length, 4);
  await reward();
  pass(
    prefix +
      " actual wire controls require stopping photos and reaching an adult",
  );
  assert.equal(await page.locator(".sentence-cards").count(), 0);
  await act("move", "복도");
  await act("move", "담임 자리");
  await expect(page.locator(".npc-dialog")).toContainText("지금 자리에 없어요");
  await act("move", "복도");
  await act("move", keyboard ? "상담실" : "교무실");
  assert.equal(await page.locator('[data-action="sentence-add"]').count(), 0);
  await act("sentence-start");
  await layout(page, prefix + " map");
  await shot(page, prefix + "-06-map");
  await act("sentence-add", keyboard ? "R2" : "R1");
  assert.equal((await saved(page)).solvedPuzzleIds.length, 5);
  await reward();
  pass(
    prefix +
      " spatial map, absent adult alternative and contextual conversation auto-complete",
  );
  if (bonusAll) {
    await act("device", "bonus");
    await page.locator("#bonus-code").fill("31");
    await act("close-panel");
    await inspect("O12");
    await act("device", "bonus");
    assert.equal(await page.locator("#bonus-code").inputValue(), "31");
    await page.locator("#bonus-code").fill("312");
    await page.locator('form[data-form="bonus4"] button').click();
    assert.equal((await saved(page)).foundBonusIds.length, 4);
    await act("device", "main");
    pass(
      prefix +
        " symbol lock partial input survives reopening and all four bonus clues",
    );
  }
  // One click seats each piece upright; an occupied home removes it.
  await act("fragment-pick", "F2");
  await act("fragment-remove", "0");
  for (const id of ["F1", "F2", "F3", "F4"]) await act("fragment-pick", id);
  await layout(page, prefix + " final");
  await shot(page, prefix + "-07-pieces");
  await act("fragment-pick", "F5");
  assert.equal((await saved(page)).finalCombined, true);
  assert.equal((await saved(page)).finalKeyObtained, false);
  assert.equal((await saved(page)).phase, "finalReady");
  await reward();
  assert.equal((await saved(page)).finalKeyObtained, true);
  await act("key-exit");
  await expect(page.getByRole("dialog")).toContainText(
    "추가 단서는 선택 활동이에요.",
  );
  await act("escape-confirm");
  await page.getByRole("heading", { name: "함께 열었어요!" }).waitFor();
  assert.equal((await saved(page)).frozenScore, bonusAll ? 100 : 90);
  // Individual reflection now sits in an optional disclosure below the group pact.
  await expect(async () => {
    await page
      .locator("details[data-disclosure='reflection']")
      .evaluate((el) => {
        el.open = true;
      });
    await expect(
      page.locator('button[data-action="reflect"][data-value="3"]'),
    ).toBeVisible({ timeout: 500 });
  }).toPass();
  await act("reflect", "3");
  await shot(page, prefix + "-08-result");
  const ended = await saved(page);
  await page.waitForTimeout(450);
  assert.equal((await saved(page)).elapsedMs, ended.elapsedMs);
  await page.reload();
  await page.getByRole("heading", { name: "함께 열었어요!" }).waitFor();
  pass(
    prefix +
      " one-click upright assembly, hidden key, direct key exit and frozen score",
  );
  return d;
}
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  track(page);
  const d = driver(page, true);
  await start(page, d);
  await play(page, { keyboard: true, bonusAll: true, prefix: "desktop" });
  await expect(page.locator('[data-action="export"]')).toBeDisabled();
  pass(
    "practice export stays disabled; complete mandatory flow uses keyboard without dragging",
  );
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".site-header").isVisible(), false);
  await shot(page, "desktop-09-print");
  await page.emulateMedia({ media: "screen" });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "#/");
    await layout(page, "home " + width);
    await shot(page, "home-" + width);
  }
  // Phones play in landscape; portrait shows the rotate prompt instead of the room.
  await page.setViewportSize({ width: 740, height: 360 });
  await d.act("new");
  await d.act("new-confirmed");
  await toStory(page, d);
  await d.act("start");
  await d.inspect("O02");
  // Fullscreen and its fill-screen fallback consume Escape themselves. Leave
  // immersion through the UI before testing the investigation-panel shortcut.
  const immersed = () =>
    page.evaluate(
      () =>
        Boolean(document.fullscreenElement) ||
        document
          .getElementById("app")
          ?.classList.contains("immersive-fallback"),
    );
  if (await immersed()) {
    await d.act("fullscreen");
    await expect.poll(immersed).toBe(false);
  }
  await page.keyboard.press("Escape");
  await expect(d.room()).toBeVisible();
  // The 3D room mounts asynchronously, so focus can land a moment after the room shows.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.activeElement?.getAttribute("data-focus") ===
              "inspect:O02" ||
            Boolean(document.activeElement?.closest("#classroom-scene")),
        ),
      {
        message: "Escape returns focus to the inspected object or the 3D room",
      },
    )
    .toBe(true);
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  assert.equal(new URL(page.url()).hash, "#/play");
  await d.act("modal", "game-menu");
  await d.act("modal", "objects", page.getByRole("dialog"));
  assert.equal(await page.locator(".object-picker button").count(), 12);
  await d.act("inspect", "O03", page.getByRole("dialog"));
  await expect(page.locator(".paper-note")).toBeVisible();
  await d.act("modal", "settings");
  assert.equal(await page.locator('[data-setting="sound"]').isChecked(), false);
  // New games start with reduced motion on since 1.6.1.
  assert.equal(
    await page.locator('[data-setting="reduced"]').isChecked(),
    true,
  );
  await d.act("close-modal");
  await d.act("pause");
  const paused = await saved(page);
  await page.waitForTimeout(650);
  assert.equal((await saved(page)).elapsedMs, paused.elapsedMs);
  await d.act("resume");
  pass(
    "360/768/1440 layout; Escape focus, skip link, optional object list, motion settings and pause",
  );
  await page.goto(base + "#/rankings");
  await page
    .getByRole("heading", { name: "아직 공식 기록이 없어요" })
    .waitFor();
  assert.equal(await page.locator("tbody tr").count(), 0);
  await page.goto(base + "#/tools/results");
  await expect(page.locator("#result-files")).toBeDisabled();
  await expect(
    page.locator('[data-action="aggregate-download"]'),
  ).toBeDisabled();
  pass("empty official data and no-round aggregation gates retained");
  // Real error recovery, without mutating any deployed data.
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  const bp = await blocked.newPage();
  track(bp);
  const bd = driver(bp, false);
  await start(bp, bd);
  await bd.inspect("O03");
  await expect(bp.locator(".paper-note")).toBeVisible();
  await blocked.close();
  pass("blocked storage still allows activity");
  const broken = await browser.newContext();
  await broken.route("**/data/schools.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await broken.route("**/data/rankings.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  const fp = await broken.newPage();
  track(fp);
  await start(fp, driver(fp, false));
  await broken.close();
  pass("missing school/ranking data allows practice");
  const assets = await browser.newContext();
  await assets.route("**/assets/classroom.svg", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  const ap = await assets.newPage();
  track(ap);
  await ap.goto(base);
  await ap.getByRole("heading", { name: "교실을 준비하지 못했어요" }).waitFor();
  await assets.unroute("**/assets/classroom.svg");
  await driver(ap, false).act("retry");
  await ap
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  await assets.close();
  pass("required asset failure has working retry");
  // Browser-only official fixtures: no fictional schools/results are deployed.
  const official = await browser.newContext({
    viewport: { width: 360, height: 900 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const fixtureConfig = {
    schemaVersion: 1,
    episodeId: "ep01",
    difficultyId: "standard",
    contentVersion: "ep01-1.0.0",
    activeRound: {
      roundId: "fixture-round",
      label: "검증 전용 회차",
      acceptingResults: true,
    },
  };
  const schools = [{ schoolId: "FIXTURE-1", name: "검증 전용 학교" }];
  let config = fixtureConfig;
  const empty = {
    schemaVersion: 1,
    episodeId: "ep01",
    roundId: "fixture-round",
    difficultyId: "standard",
    contentVersion: "ep01-1.0.0",
    updatedAt: null,
    records: [],
  };
  await official.route("**/data/game-config.json", (r) =>
    r.fulfill({ json: config }),
  );
  await official.route("**/data/schools.json", (r) =>
    r.fulfill({ json: schools }),
  );
  await official.route("**/data/rankings.json", (r) =>
    r.fulfill({ json: empty }),
  );
  const op = await official.newPage();
  track(op);
  const od = driver(op, false);
  const result = {
    schemaVersion: 1,
    recordType: "classroom-escape-result",
    episodeId: "ep01",
    roundId: "fixture-round",
    difficultyId: "standard",
    contentVersion: "ep01-1.0.0",
    schoolId: "FIXTURE-1",
    solvedPuzzleIds: ["P1", "P2", "P3", "P4", "P5"],
    foundBonusIds: ["B1", "B3"],
    escaped: true,
  };
  await op.goto(base + "#/tools/results");
  await expect(op.locator("#result-files")).toBeEnabled();
  const file = (name, json) => ({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(json)),
  });
  await op
    .locator("#result-files")
    .setInputFiles([
      file("90.json", result),
      file("same.json", result),
      file("95.json", { ...result, foundBonusIds: ["B1", "B2", "B3"] }),
      file("invalid.json", { ...result, studentName: "must reject" }),
    ]);
  await op.locator(".conflict").waitFor();
  await expect(op.locator('[data-action="aggregate-download"]')).toBeDisabled();
  await od.act("conflict", "0:replace");
  let ev = op.waitForEvent("download");
  await od.act("aggregate-download");
  let json = JSON.parse(await readFile(await (await ev).path(), "utf8"));
  assert.equal(json.records[0].score, 95);
  assert.deepEqual(Object.keys(json.records[0]).sort(), [
    "bonusCount",
    "escaped",
    "schoolId",
    "score",
  ]);
  assert.equal(json.records.length, 1);
  await expect(op.locator(".error-list")).not.toBeEmpty();
  pass(
    "official fixture file validation, duplicate/conflict handling and safe local ranking download",
  );
  await op.setViewportSize({ width: 740, height: 360 });
  await start(op, od, "FIXTURE-1");
  await play(op, { prefix: "mobile" });
  await expect(op.locator('[data-action="export"]')).toBeEnabled();
  ev = op.waitForEvent("download");
  await od.act("export");
  json = JSON.parse(await readFile(await (await ev).path(), "utf8"));
  assert.deepEqual(json, result);
  pass(
    "official fixture full phone-landscape UI play and exact 90-point result download",
  );
  config = {
    ...fixtureConfig,
    activeRound: {
      ...fixtureConfig.activeRound,
      roundId: "next-fixture-round",
    },
  };
  await od.act("refresh-config");
  await expect(op.locator('[data-action="export"]')).toBeDisabled();
  config = {
    ...fixtureConfig,
    activeRound: { ...fixtureConfig.activeRound, acceptingResults: false },
  };
  await op.goto(base + "#/tools/results");
  await od.act("refresh-config");
  await expect(op.locator('[data-action="aggregate-download"]')).toBeDisabled();
  await official.close();
  pass(
    "changed round blocks old result export; closed round blocks aggregation",
  );
  currentPage = page;
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(base + "#/teacher");
  await page
    .getByRole("heading", { name: "서로의 생각이 열쇠가 되는 40분" })
    .waitFor();
  await layout(page, "teacher tablet");
  await shot(page, "teacher-tablet");
  await page.evaluate(() => localStorage.setItem("other-app-record", "keep"));
  await d.act("erase-confirm");
  await d.act("erase");
  await page
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("other-app-record")),
    "keep",
  );
  assert.equal(await saved(page), null);
  pass("teacher guidance and activity erase preserve unrelated data");
  assert.equal(
    report.requests.some(
      (r) =>
        new URL(r.url).origin !== new URL(base).origin || r.method !== "GET",
    ),
    false,
  );
  pass(
    "entire game, official export and aggregation use only same-origin static GETs",
  );
  assert.deepEqual(report.consoleErrors, []);
  pass("no browser runtime errors");
  await ctx.close();
} catch (error) {
  report.checks.push({
    name: "browser run",
    status: "FAIL",
    details: error.stack,
  });
  console.error(error);
  if (currentPage && !currentPage.isClosed())
    await shot(currentPage, "failure");
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await writeFile(
    resolve(evidence, "browser-results.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
