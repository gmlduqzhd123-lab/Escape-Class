import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullscreenController } from "../src/ui/fullscreen";

class FakeDocument extends EventTarget {
  fullscreenEnabled = true;
  fullscreenElement: unknown = null;
  exits = 0;
  async exitFullscreen() {
    this.exits += 1;
    this.fullscreenElement = null;
    this.dispatchEvent(new Event("fullscreenchange"));
  }
}

function fixture() {
  const doc = new FakeDocument();
  const classes = new Set<string>();
  let requests = 0;
  let changes = 0;
  const target = {
    ownerDocument: doc,
    classList: {
      toggle(name: string, active: boolean) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
      remove(...names: string[]) {
        names.forEach((name) => classes.delete(name));
      },
    },
    requestFullscreen: async () => {
      requests += 1;
      doc.fullscreenElement = target;
      doc.dispatchEvent(new Event("fullscreenchange"));
    },
  };
  const controller = createFullscreenController(
    target as unknown as HTMLElement,
    () => {
      changes += 1;
    },
  );
  return {
    doc,
    target,
    classes,
    controller,
    requests: () => requests,
    changes: () => changes,
  };
}

function escapeKey(doc: FakeDocument) {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { value: "Escape" });
  doc.dispatchEvent(event);
  return event;
}

test("fullscreen requests immediately on the initiating click and syncs once", async () => {
  const f = fixture();
  const request = f.controller.enter();
  assert.equal(f.requests(), 1);
  assert.equal(f.controller.isFullscreen(), true);
  await request;
  assert.equal(f.changes(), 1);
  assert.equal(f.classes.has("immersive-fullscreen"), true);
  await f.controller.enter();
  assert.equal(f.requests(), 1);
  assert.equal(f.changes(), 1);
  await f.controller.toggle();
  assert.equal(f.controller.isFullscreen(), false);
  assert.equal(f.controller.isFallback(), false);
  assert.equal(f.classes.size, 0);
  assert.equal(f.doc.exits, 1);
  f.controller.dispose();
});

test("unsupported or policy-disabled fullscreen fills the app and Escape exits", async () => {
  for (const support of ["disabled", "missing"] as const) {
    const f = fixture();
    if (support === "disabled") f.doc.fullscreenEnabled = false;
    else
      Object.defineProperty(f.target, "requestFullscreen", {
        value: undefined,
      });
    await f.controller.enter();
    assert.equal(f.requests(), 0);
    assert.equal(f.controller.isFullscreen(), false);
    assert.equal(f.controller.isFallback(), true);
    assert.equal(f.classes.has("immersive-fallback"), true);
    assert.equal(escapeKey(f.doc).defaultPrevented, true);
    assert.equal(f.controller.isFallback(), false);
    assert.equal(f.classes.size, 0);
    assert.equal(f.doc.exits, 0);
    f.controller.dispose();
  }
});

test("a rejected request falls back and can later re-enter native fullscreen", async () => {
  const f = fixture();
  const nativeRequest = f.target.requestFullscreen;
  f.target.requestFullscreen = () => Promise.reject(new Error("not allowed"));
  await f.controller.enter();
  assert.equal(f.controller.isFallback(), true);
  f.target.requestFullscreen = nativeRequest;
  await f.controller.enter();
  assert.equal(f.controller.isFullscreen(), true);
  assert.equal(f.controller.isFallback(), false);
  assert.equal(f.classes.has("immersive-fallback"), false);
  f.controller.dispose();
});

test("browser Escape is not intercepted and does not activate fallback", async () => {
  const f = fixture();
  await f.controller.enter();
  assert.equal(escapeKey(f.doc).defaultPrevented, false);
  f.doc.fullscreenElement = null;
  f.doc.dispatchEvent(new Event("fullscreenchange"));
  assert.equal(f.controller.isFullscreen(), false);
  assert.equal(f.controller.isFallback(), false);
  assert.equal(f.classes.size, 0);
  assert.equal(f.changes(), 2);
  f.controller.dispose();
});

test("exit during a pending fullscreen request is respected after it resolves", async () => {
  const f = fixture();
  let resolve!: () => void;
  f.target.requestFullscreen = () =>
    new Promise<void>((done) => {
      resolve = done;
    });
  const pending = f.controller.enter();
  await f.controller.toggle();
  f.doc.fullscreenElement = f.target;
  f.doc.dispatchEvent(new Event("fullscreenchange"));
  resolve();
  await pending;
  assert.equal(f.doc.fullscreenElement, null);
  assert.equal(f.controller.isFallback(), false);
  assert.equal(f.classes.size, 0);
  f.controller.dispose();
});

test("late rejection after exit never reopens fallback", async () => {
  const f = fixture();
  let reject!: (reason: Error) => void;
  f.target.requestFullscreen = () =>
    new Promise<void>((_done, fail) => {
      reject = fail;
    });
  const pending = f.controller.enter();
  await f.controller.exit();
  reject(new Error("cancelled"));
  await pending;
  assert.equal(f.controller.isFallback(), false);
  assert.equal(f.classes.size, 0);
  f.controller.dispose();
});

test("dispose removes listeners/classes and never exits another element's fullscreen", async () => {
  const f = fixture();
  f.doc.fullscreenEnabled = false;
  await f.controller.enter();
  const changes = f.changes();
  f.doc.fullscreenElement = {};
  f.controller.dispose();
  assert.equal(f.classes.size, 0);
  assert.equal(f.controller.isFallback(), false);
  assert.equal(f.doc.exits, 0);
  f.doc.dispatchEvent(new Event("fullscreenchange"));
  assert.equal(escapeKey(f.doc).defaultPrevented, false);
  await f.controller.enter();
  assert.equal(f.changes(), changes);
});
