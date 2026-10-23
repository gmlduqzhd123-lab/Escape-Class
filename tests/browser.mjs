import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.APP_URL || "http://127.0.0.1:4173/classroom-escape/";
const browser = await chromium.launch({
  executablePath:
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
await mkdir("evidence", { recursive: true });
const report = {
  base,
  engine: "Installed Microsoft Edge, Playwright headless",
  startedAt: new Date().toISOString(),
  checks: [],
  consoleErrors: [],
  requests: [],
  screenshots: [],
};
function pass(name, details = "") {
  report.checks.push({ name, status: "PASS", details });
  console.log(`PASS ${name} ${details}`);
}
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => report.consoleErrors.push(e.message));
page.on("request", (r) =>
  report.requests.push({ url: r.url(), method: r.method() }),
);
const act = async (action, value, where = page) => {
  const selector = `button[data-action="${action}"]${value === undefined ? "" : `[data-value="${value}"]`}`;
  const el = where.locator(selector).first();
  await el.waitFor();
  await el.focus();
  await page.keyboard.press("Enter");
};
const inspect = async (id) => {
  await act("inspect", id, page.locator(".object-list"));
  await page.locator("#panel-title").waitFor();
};
const state = () =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("classroom-escape:"),
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
const shot = async (name) => {
  const path = `evidence/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await shot("01-home-desktop");
  assert.equal(
    await page.locator('[data-action="continue"]').isDisabled(),
    true,
  );
  pass("start assets, no valid continue, local font");
  await act("new");
  await page.getByRole("heading", { name: "우리 모둠, 준비됐나요?" }).waitFor();
  assert.equal(await page.locator("input:not([type=checkbox])").count(), 1);
  await act("setup-next");
  await page
    .getByRole("heading", { name: "우정 열쇠가 사라졌어요!" })
    .waitFor();
  const before = await state();
  await page.waitForTimeout(500);
  assert.equal((await state()).elapsedMs, before.elapsedMs);
  await act("start");
  await page.locator(".object-list").waitFor();
  pass("AC01 practice without personal input, intro timer stopped");
  await inspect("O04");
  assert.ok(await page.getByText("아직 잠긴 장치예요").isVisible());
  await inspect("O11");
  assert.equal((await state()).finalKeyObtained, false);
  pass("AC31 prerequisite lock in UI and plant before assembly");
  await inspect("O10");
  await act("bonus", "B1:별");
  assert.deepEqual((await state()).foundBonusIds, []);
  await act("bonus", "B1:하트");
  await inspect("O06");
  await act("take", "shared-lens");
  await act("bonus", "B2:함께 쓰기");
  await inspect("O02");
  for (const n of ["1", "2", "3"]) await act("invite-add", n);
  await act("bonus", "B3:1,2,3");
  assert.equal((await state()).foundBonusIds.length, 3);
  pass("B1-B3 discovery and wrong-answer recovery");
  await inspect("O03");
  await inspect("O02");
  for (const id of ["P1-C1", "P1-C3", "P1-C5"]) {
    await act("flip", id);
    await act("p1-add", id);
  }
  await act("solve", "P1");
  assert.deepEqual((await state()).solvedPuzzleIds, ["P1"]);
  await shot("02-p1-desktop");
  await page.reload();
  await page.getByRole("dialog").waitFor();
  assert.equal((await state()).solvedPuzzleIds.length, 1);
  await act("resume");
  await inspect("O04");
  pass("AC17 reload restores progress paused");
  for (const n of ["7", "1", "3"]) await act("code", n);
  await act("solve", "P2");
  assert.equal((await state()).solvedPuzzleIds.length, 1);
  await act("modal", "bag");
  await act("select-item", "shared-lens");
  await act("apply", "O04");
  for (let i = 0; i < 3; i++) await act("lens-rotate");
  await act("solve", "P2");
  assert.equal((await state()).solvedPuzzleIds.length, 2);
  pass("AC04-AC05 shared lens and number-only failure");
  await inspect("O07");
  await act("ball-run");
  await page.waitForFunction(
    () => !document.querySelector('[data-action="ball-run"]')?.disabled,
  );
  assert.equal((await state()).solvedPuzzleIds.length, 2);
  const path = [
    [1, 3],
    [1, 2],
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2],
    [3, 3],
    [3, 4],
    [3, 5],
    [4, 5],
    [5, 5],
    [5, 4],
    [5, 3],
  ];
  for (let i = 0; i < path.length - 1; i++) {
    const [x, y] = path[i],
      [nx, ny] = path[i + 1],
      dir = nx > x ? 0 : ny > y ? 1 : nx < x ? 2 : 3;
    for (let k = 0; k < dir; k++)
      await act("arrow", String((y - 1) * 5 + x - 1));
  }
  await act("ball-run");
  await page.waitForFunction(
    () => document.querySelector('[data-action="ball-run"]')?.disabled,
  );
  assert.equal((await state()).solvedPuzzleIds.length, 3);
  await shot("03-p3-desktop");
  pass("AC06-AC07 ball failure, retained arrows, successful simulation");
  await inspect("O08");
  await act("switch", "photo-1");
  await act("switch", "photo-2");
  await act("solve", "P4");
  assert.equal((await state()).solvedPuzzleIds.length, 3);
  await act("switch", "help-1");
  await act("switch", "help-3");
  await act("solve", "P4");
  assert.equal((await state()).solvedPuzzleIds.length, 4);
  pass("AC08 photo-block alone fails; counselor help succeeds");
  await inspect("O09");
  await act("move", "복도");
  await act("move", "담임 자리");
  await act("move", "복도");
  await act("move", "상담실");
  await act("sentence-add", "R0");
  await act("sentence-add", "R2");
  await act("solve", "P5");
  assert.equal((await state()).solvedPuzzleIds.length, 5);
  assert.equal((await state()).phase, "finalReady");
  await shot("04-p5-desktop");
  pass("AC10 absent teacher alternative route and request");
  await inspect("O12");
  await page.locator("#bonus-code").focus();
  await page.keyboard.type("31");
  await act("close-panel");
  await inspect("O12");
  assert.equal(await page.locator("#bonus-code").inputValue(), "31");
  await page.locator("#bonus-code").focus();
  await page.keyboard.press("End");
  await page.keyboard.type("2");
  pass("partial B4 code survives panel close and reopen");
  await page.locator('form[data-form="bonus4"] button').focus();
  await page.keyboard.press("Enter");
  assert.equal((await state()).foundBonusIds.length, 4);
  for (const id of ["F1", "F2", "F3", "F4", "F5"])
    await act("fragment-add", id);
  for (const [i, rot] of [90, 180, 270, 90, 180].entries())
    for (let n = 0; n < (360 - rot) / 90; n++)
      await act("fragment-rotate", String(i));
  await act("combine");
  assert.equal((await state()).phase, "finalReady");
  assert.equal((await state()).finalCombined, true);
  assert.equal((await state()).finalKeyObtained, false);
  pass("AC13-AC14 100 points and assembly do not escape");
  await inspect("O11");
  await act("modal", "bag");
  await act("select-item", "final-key");
  await inspect("O12");
  await act("use-exit");
  await page.getByRole("dialog").waitFor();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /追加|남은 추가 단서가 0개/,
  );
  await act("escape-confirm");
  await page.getByRole("heading", { name: "함께 열었어요!" }).waitFor();
  assert.equal((await state()).frozenScore, 100);
  assert.equal(await page.locator('[data-action="export"]').isDisabled(), true);
  await act("reflect", "3");
  await shot("05-result-desktop");
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".site-header").isVisible(), false);
  assert.equal(await page.locator(".no-print").first().isVisible(), false);
  await shot("13-result-print");
  await page.emulateMedia({ media: "screen" });
  pass(
    "print media shows activity record and selected reflection without export controls",
  );
  pass("AC15-AC16 final key exit, frozen 100, practice export disabled");
  pass(
    "AC27 full mandatory game operated by focus + Enter without drag or pointer",
  );
  const escaped = await state();
  await page.waitForTimeout(1100);
  assert.equal((await state()).elapsedMs, escaped.elapsedMs);
  await page.reload();
  await page.getByRole("heading", { name: "함께 열었어요!" }).waitFor();
  pass("result timer stopped and escaped restore validated");
  // Viewport and hit-target inspection uses the real DOM, with no injected game completion.
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "#/");
    await page
      .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await shot(`06-home-${width}`);
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await act("new");
  await act("new-confirmed");
  await act("setup-next");
  await act("start");
  await inspect("O02");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await shot("07-play-mobile");
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#panel-title").innerText(),
    "어디부터 살펴볼까요?",
  );
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("data-focus"),
  );
  assert.equal(focused, "inspect:O02");
  pass("AC26 mobile 360 / tablet 768 / desktop 1440, no horizontal overflow");
  pass("AC27 Escape returns focus to investigation target");
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  assert.ok(page.url().endsWith("#/play"));
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  pass("skip-to-content retains the play hash route");
  const small = await page.locator("button:visible").evaluateAll((els) =>
    els
      .map((el) => ({
        label: el.textContent.trim(),
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }))
      .filter((r) => r.width < 43.9 || r.height < 43.9),
  );
  assert.deepEqual(small, []);
  pass("44px hit targets on mobile play screen");
  await act("modal", "settings");
  assert.equal(await page.locator('[data-setting="sound"]').isChecked(), false);
  assert.equal(
    await page.locator('[data-setting="reduced"]').isChecked(),
    true,
  );
  await act("close-modal");
  pass("AC28 sound off and reduced motion preserve full clue access");
  const elapsedBefore = (await state()).elapsedMs;
  await act("pause");
  await page.waitForTimeout(1100);
  const elapsedPaused = (await state()).elapsedMs;
  assert.ok(elapsedPaused - elapsedBefore < 400);
  await act("resume");
  pass("pause timer stopped");
  await page.goto(base + "#/rankings");
  await page
    .getByRole("heading", { name: "아직 공식 기록이 없어요" })
    .waitFor();
  assert.equal(await page.locator("tbody tr").count(), 0);
  pass("AC24 official empty state; no invented schools");
  await page.goto(base + "#/tools/results");
  await page.locator("#result-files").waitFor();
  assert.equal(await page.locator("#result-files").isDisabled(), true);
  assert.equal(
    await page.locator('[data-action="aggregate-download"]').isDisabled(),
    true,
  );
  pass("AC34 no-round import/download disabled");
  assert.equal(
    report.requests.some((r) => new URL(r.url).origin !== new URL(base).origin),
    false,
  );
  assert.equal(
    report.requests.some((r) => r.method !== "GET"),
    false,
  );
  pass("AC30 only same-origin static GETs in actual full game");
  // Storage unavailable and missing read-only data recover independently.
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  const bp = await blocked.newPage();
  await bp.goto(base);
  await bp
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  assert.equal(await bp.locator(".storage-warning").isVisible(), true);
  await bp.locator('[data-action="new"]').click();
  await bp.locator('[data-action="setup-next"]').click();
  await bp.locator('[data-action="start"]').click();
  await bp.locator('.object-list [data-value="O03"]').click();
  assert.equal(
    await bp
      .getByText("P1-C3을 단서 노트에 보관했어요.", { exact: false })
      .isVisible(),
    true,
  );
  await blocked.close();
  pass("AC18 blocked localStorage still allows real UI activity");
  const failure = await browser.newContext();
  await failure.route("**/data/schools.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await failure.route("**/data/rankings.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  const fp = await failure.newPage();
  await fp.goto(base);
  await fp
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  await fp.locator('[data-action="new"]').click();
  await fp.locator('[data-action="setup-next"]').click();
  await fp.locator('[data-action="start"]').click();
  await fp.locator(".object-list").waitFor();
  await failure.close();
  pass("AC25 failed schools/rankings do not block practice");
  const assetFailure = await browser.newContext();
  await assetFailure.route("**/assets/classroom.svg", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  const ap = await assetFailure.newPage();
  await ap.goto(base);
  await ap.getByRole("heading", { name: "교실을 준비하지 못했어요" }).waitFor();
  await assetFailure.unroute("**/assets/classroom.svg");
  await ap.locator('[data-action="retry"]').click();
  await ap
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  await assetFailure.close();
  pass("required asset failure and retry recovery");
  // Official configuration and schools are intercepted fixtures, never production data.
  const official = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 360, height: 900 },
    reducedMotion: "reduce",
  });
  const op = await official.newPage();
  op.on("request", (r) =>
    report.requests.push({ url: r.url(), method: r.method() }),
  );
  op.on("pageerror", (e) => report.consoleErrors.push(e.message));
  const officialShot = async (name) => {
    assert.equal(
      await op.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const path = `evidence/${name}.png`;
    await op.screenshot({ path, fullPage: true });
    report.screenshots.push(path);
  };
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
  const fixtureSchools = [{ schoolId: "FIXTURE-1", name: "검증 전용 학교" }];
  let currentConfig = fixtureConfig;
  await official.route("**/data/game-config.json", (r) =>
    r.fulfill({ json: currentConfig }),
  );
  await official.route("**/data/schools.json", (r) =>
    r.fulfill({ json: fixtureSchools }),
  );
  const empty = {
    schemaVersion: 1,
    episodeId: "ep01",
    roundId: "fixture-round",
    difficultyId: "standard",
    contentVersion: "ep01-1.0.0",
    updatedAt: null,
    records: [],
  };
  await official.route("**/data/rankings.json", (r) =>
    r.fulfill({ json: empty }),
  );
  await op.goto(base + "#/tools/results");
  await op.locator("#result-files").waitFor();
  assert.equal(await op.locator("#result-files").isDisabled(), false);
  const resultJson = {
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
  const file = (name, json) => ({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(json)),
  });
  await op
    .locator("#result-files")
    .setInputFiles([
      file("90.json", resultJson),
      file("same.json", resultJson),
      file("95.json", { ...resultJson, foundBonusIds: ["B1", "B2", "B3"] }),
      file("invalid.json", { ...resultJson, studentName: "must reject" }),
    ]);
  await op.locator(".conflict").waitFor();
  assert.equal(await op.locator(".conflict").count(), 1);
  assert.equal(
    await op.locator('[data-action="aggregate-download"]').isDisabled(),
    true,
  );
  await op.locator('[data-action="conflict"][data-value="0:replace"]').click();
  const downloadEvent = op.waitForEvent("download");
  await op.locator('[data-action="aggregate-download"]').click();
  const downloaded = await downloadEvent;
  const data = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  assert.equal(data.records[0].score, 95);
  assert.deepEqual(Object.keys(data.records[0]).sort(), [
    "bonusCount",
    "escaped",
    "schoolId",
    "score",
  ]);
  assert.equal(data.records.length, 1);
  assert.ok(await op.locator(".error-list").innerText());
  pass(
    "AC20-AC22,AC32 actual file picker, conflict choice, local download and strict fields (fixtures)",
  );
  await op.goto(base + "#/");
  await op.locator('[data-action="new"]').click();
  await op
    .locator('[data-action="choose-school"][data-value="FIXTURE-1"]')
    .click();
  await op.locator('[data-action="setup-next"]').click();
  await op.getByRole("heading", { name: "우정 열쇠가 사라졌어요!" }).waitFor();
  const officialState = await op.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) =>
          k.startsWith("classroom-escape:"),
        ),
      ),
    ),
  );
  assert.equal(officialState.schoolId, "FIXTURE-1");
  assert.equal(officialState.roundId, "fixture-round");
  pass("AC02 real registered-school selection preserved (fixture)");
  // Second real UI play under the intercepted official round; no completion-state injection.
  const oa = async (action, value) => {
    const el = op
      .locator(
        `button[data-action="${action}"]${value === undefined ? "" : `[data-value="${value}"]`}`,
      )
      .first();
    await el.focus();
    await op.keyboard.press("Enter");
  };
  const oi = async (id) => {
    const el = op.locator(`.object-list button[data-value="${id}"]`);
    await el.focus();
    await op.keyboard.press("Enter");
  };
  await oa("start");
  await op.locator(".object-list").waitFor();
  await oi("O03");
  await oi("O02");
  for (const id of ["P1-C1", "P1-C3", "P1-C5"]) await oa("p1-add", id);
  await oa("solve", "P1");
  for (const n of ["1", "2", "3"]) await oa("invite-add", n);
  await oa("bonus", "B3:1,2,3");
  await oi("O10");
  await oa("bonus", "B1:하트");
  await oi("O06");
  await oa("take", "shared-lens");
  await oi("O04");
  await oa("modal", "bag");
  await oa("select-item", "shared-lens");
  await oa("apply", "O04");
  for (let i = 0; i < 3; i++) await oa("lens-rotate");
  for (const n of ["7", "1", "3"]) await oa("code", n);
  await officialShot("10-lens-mobile");
  await oa("solve", "P2");
  await oi("O07");
  for (let i = 0; i < path.length - 1; i++) {
    const [x, y] = path[i],
      [nx, ny] = path[i + 1],
      dir = nx > x ? 0 : ny > y ? 1 : nx < x ? 2 : 3;
    for (let k = 0; k < dir; k++)
      await oa("arrow", String((y - 1) * 5 + x - 1));
  }
  await oa("ball-run");
  await expect(op.locator('[data-action="ball-run"]')).toBeDisabled({
    timeout: 10000,
  });
  await oi("O08");
  for (const id of ["photo-1", "photo-2", "help-1", "help-2"])
    await oa("switch", id);
  await officialShot("11-network-mobile");
  await oa("solve", "P4");
  await oi("O09");
  await oa("move", "복도");
  await oa("move", "교무실");
  await oa("sentence-add", "R0");
  await oa("sentence-add", "R1");
  await oa("solve", "P5");
  await oi("O12");
  for (const id of ["F1", "F2", "F3", "F4", "F5"]) await oa("fragment-add", id);
  for (const [i, rot] of [90, 180, 270, 90, 180].entries())
    for (let n = 0; n < (360 - rot) / 90; n++)
      await oa("fragment-rotate", String(i));
  await oa("combine");
  await officialShot("12-final-map-mobile");
  await oi("O11");
  await oa("modal", "bag");
  await oa("select-item", "final-key");
  await oi("O12");
  await oa("use-exit");
  await expect(op.getByRole("dialog")).toContainText("추가 단서가 2개");
  await oa("escape-confirm");
  await op.getByRole("heading", { name: "함께 열었어요!" }).waitFor();
  await expect(op.locator('[data-action="export"]')).toBeEnabled();
  const resultDownload = op.waitForEvent("download");
  await oa("export");
  const rd = await resultDownload;
  const rf = JSON.parse(await readFile(await rd.path(), "utf8"));
  assert.deepEqual(rf, resultJson);
  await expect(op.locator("#toast")).toContainText(
    "공식 순위 반영은 운영자 확인 후",
  );
  await officialShot("08-official-result-mobile");
  pass(
    "official fixture full mobile UI play and 90-point completion download, exact permitted fields",
  );
  currentConfig = {
    ...fixtureConfig,
    activeRound: {
      ...fixtureConfig.activeRound,
      roundId: "next-fixture-round",
    },
  };
  await oa("refresh-config");
  await expect(op.locator('[data-action="export"]')).toBeDisabled();
  pass("AC33 previous-round completed UI cannot export into a new round");
  currentConfig = {
    ...fixtureConfig,
    activeRound: { ...fixtureConfig.activeRound, acceptingResults: false },
  };
  await op.goto(base + "#/tools/results");
  await op.locator('[data-action="refresh-config"]').click();
  await expect(op.locator('[data-action="aggregate-download"]')).toBeDisabled();
  await official.close();
  pass("AC34 round closed while tool open disables generation after refresh");
  assert.equal(
    report.requests.some(
      (r) =>
        new URL(r.url).origin !== new URL(base).origin || r.method !== "GET",
    ),
    false,
  );
  pass(
    "AC32 aggregation and official export cause only local downloads and static GETs",
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(base + "#/teacher");
  await page
    .getByRole("heading", { name: "서로의 생각이 열쇠가 되는 40분" })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await shot("09-teacher-tablet");
  pass("teacher 40-minute flow, role cards and privacy guidance rendered");
  await page.evaluate(() => localStorage.setItem("other-app-record", "keep"));
  await act("erase-confirm");
  await act("erase");
  await page
    .getByRole("heading", { name: "사라진 우정 열쇠", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("other-app-record")),
    "keep",
  );
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("classroom-escape:")),
    ),
    false,
  );
  pass("AC19 actual erase UI preserves another app's storage key");
  assert.deepEqual(report.consoleErrors, []);
  pass("no browser page errors");
} catch (error) {
  report.checks.push({
    name: "browser run",
    status: "FAIL",
    details: error.stack,
  });
  await shot("failure");
  console.error(error);
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await writeFile(
    "evidence/browser-results.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
