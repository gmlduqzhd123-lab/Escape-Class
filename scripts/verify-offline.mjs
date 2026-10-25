import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { webcrypto, createHash } from "node:crypto";
import assert from "node:assert/strict";
const dist = resolve("dist"),
  proof = resolve(
    process.env.EVIDENCE_DIR || "../Escape-Class-advanced-review/local",
  );
const manifest = JSON.parse(
  await readFile(join(dist, "offline-manifest.json"), "utf8"),
);
const worker = await readFile(join(dist, "sw.js"), "utf8"),
  scope = "https://test.example/Escape-Class/";
const checks = [];
async function harness(corrupt = false) {
  const handlers = {},
    buckets = new Map();
  let offline = false;
  const key = (r, ignore = false) => {
    const u = new URL(typeof r === "string" ? r : r.url, scope);
    if (ignore) u.search = "";
    return u.href;
  };
  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      return {
        async match(request, options = {}) {
          assert.equal(options.ignoreVary, true);
          const target = key(request, options.ignoreSearch);
          for (const [url, value] of bucket)
            if (key(url, options.ignoreSearch) === target) return value.clone();
        },
        async put(request, response) {
          bucket.set(key(request), response.clone());
        },
      };
    },
    async keys() {
      return [...buckets.keys()];
    },
    async delete(name) {
      return buckets.delete(name);
    },
    async match(request, options = {}) {
      for (const name of buckets.keys()) {
        const hit = await (await caches.open(name)).match(request, options);
        if (hit) return hit;
      }
    },
  };
  await caches.open("unrelated-school-app");
  const fetch = async (request) => {
    if (offline) throw Error("network disconnected");
    const url = new URL(
      typeof request === "string" ? request : request.url,
      scope,
    );
    assert.ok(url.href.startsWith(scope));
    const path =
      url.pathname.slice(new URL(scope).pathname.length) || "index.html";
    let body = await readFile(join(dist, path));
    if (corrupt && path === manifest.files[0].url)
      body = Buffer.from("broken asset");
    return new Response(body, { status: 200, headers: { Vary: "Origin" } });
  };
  const self = {
    registration: { scope },
    clients: { async claim() {} },
    async skipWaiting() {},
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
  };
  runInContext(
    worker,
    createContext({
      self,
      caches,
      fetch,
      URL,
      Response,
      crypto: webcrypto,
      Uint8Array,
      Error,
      Array,
      Number,
      Promise,
      encodeURIComponent,
    }),
  );
  const event = async (type, data = {}) => {
    const tasks = [];
    let response;
    handlers[type]({
      ...data,
      waitUntil(p) {
        tasks.push(p);
      },
      respondWith(p) {
        response = p;
      },
    });
    await Promise.all(tasks);
    return response ? await response : undefined;
  };
  return {
    caches,
    buckets,
    event,
    disconnect() {
      offline = true;
    },
  };
}
const env = await harness();
await env.event("install");
await env.event("activate");
assert.ok((await env.caches.keys()).includes("unrelated-school-app"));
checks.push("All built assets prepared; unrelated app cache preserved");
const messages = [];
await env.event("message", {
  data: { type: "PREPARE_OFFLINE" },
  ports: [
    {
      postMessage(m) {
        messages.push(m);
      },
    },
  ],
});
assert.equal(messages.at(-1).type, "ready");
assert.equal(messages.at(-1).total, manifest.files.length);
checks.push("Ready is reported only after every manifest entry is present");
env.disconnect();
for (const file of manifest.files) {
  const response = await env.event("fetch", {
    request: {
      url: new URL(file.url + "?cache-bust=offline", scope).href,
      method: "GET",
      mode: "cors",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex"),
    file.sha256,
  );
}
checks.push(
  "Every asset, including unseen lazy 3D code, fonts and data, survives failed network requests",
);
const navigation = await env.event("fetch", {
  request: { url: scope + "?release=offline", method: "GET", mode: "navigate" },
});
assert.match(await navigation.text(), /index-.*\.js/);
checks.push("A fresh cache-busted navigation falls back to the built index");
const offlineMessages = [];
await env.event("message", {
  data: { type: "PREPARE_OFFLINE" },
  ports: [
    {
      postMessage(m) {
        offlineMessages.push(m);
      },
    },
  ],
});
assert.equal(offlineMessages.at(-1).type, "ready");
checks.push(
  "Preparation can verify the already complete cache with no network",
);
const bad = await harness(true);
await assert.rejects(() => bad.event("install"));
assert.deepEqual(await bad.caches.keys(), ["unrelated-school-app"]);
checks.push(
  "A mismatched asset rejects installation and removes the incomplete cache",
);
assert.equal(
  await env.event("fetch", {
    request: { url: "https://elsewhere.example/file.js", method: "GET" },
  }),
  undefined,
);
checks.push("Requests to other origins are not intercepted");
await mkdir(proof, { recursive: true });
await writeFile(
  join(proof, "offline-engine.json"),
  JSON.stringify(
    {
      status: "PASS",
      manifestRevision: manifest.revision,
      fileCount: manifest.files.length,
      checks,
      evidenceBoundary:
        "Built service-worker source executed with Cache/Fetch harness and network failure; physical devices not tested.",
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    status: "PASS",
    fileCount: manifest.files.length,
    checks: checks.length,
  }),
);
