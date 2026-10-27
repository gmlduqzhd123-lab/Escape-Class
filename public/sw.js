/* Prepare every episode atomically; only this deployment owns these caches. */
const ROOT = self.registration.scope;
const PREFIX =
  "escape-class-" + encodeURIComponent(new URL(ROOT).pathname) + "-";
const MANIFEST = new URL("offline-manifest.json", ROOT).href;
let current;
let preparing;
const NETWORK_WAIT_MS = 3000;
/** This deployment's caches, newest revision first. */
async function owned() {
  return (await caches.keys())
    .filter((key) => key.startsWith(PREFIX))
    .reverse();
}
async function prune(keep = 2) {
  const stale = (await owned())
    .filter((key) => key !== current)
    .slice(keep - 1);
  await Promise.all(stale.map((key) => caches.delete(key)));
}
async function manifest() {
  try {
    const response = await fetch(MANIFEST, { cache: "no-store" });
    if (!response.ok) throw Error("manifest");
    const data = await response.json();
    if (
      data.version !== 1 ||
      !/^[a-f0-9]{16}$/.test(data.revision) ||
      !Array.isArray(data.files) ||
      !data.files.length
    )
      throw Error("manifest");
    for (const file of data.files) {
      const url = new URL(file.url, ROOT);
      if (
        url.origin !== new URL(ROOT).origin ||
        !url.pathname.startsWith(new URL(ROOT).pathname) ||
        file.url.includes("..") ||
        !/^[a-f0-9]{64}$/.test(file.sha256) ||
        !Number.isInteger(file.bytes) ||
        file.bytes <= 0
      )
        throw Error("manifest path");
    }
    return data;
  } catch (error) {
    for (const key of await owned()) {
      const cached = await (
        await caches.open(key)
      ).match(MANIFEST, { ignoreVary: true });
      if (cached) return cached.json();
    }
    throw error;
  }
}
async function prepare(notify = () => {}) {
  if (preparing) {
    await preparing;
    return prepare(notify);
  }
  const task = (async () => {
    const data = await manifest(),
      cache = await caches.open(PREFIX + data.revision);
    try {
      let done = 0;
      for (const file of data.files) {
        const url = new URL(file.url, ROOT).href;
        let response = await cache.match(url, { ignoreVary: true });
        if (!response) {
          response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw Error("asset");
          const buffer = await response.clone().arrayBuffer();
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
            (x) => x.toString(16).padStart(2, "0"),
          ).join("");
          if (buffer.byteLength !== file.bytes || hash !== file.sha256)
            throw Error("asset integrity");
          await cache.put(url, response);
        }
        notify({ type: "progress", done: ++done, total: data.files.length });
      }
      await cache.put(
        MANIFEST,
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      current = PREFIX + data.revision;
      // sw.js rarely changes, so activate alone would never clear older revisions.
      await prune();
      notify({
        type: "ready",
        total: data.files.length,
        revision: data.revision,
      });
      return data;
    } catch (error) {
      if (current !== PREFIX + data.revision)
        await caches.delete(PREFIX + data.revision);
      throw error;
    }
  })();
  preparing = task;
  try {
    return await task;
  } finally {
    preparing = null;
  }
}
self.addEventListener("install", (event) =>
  event.waitUntil(prepare().then(() => self.skipWaiting())),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await prune();
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "AUTO_PREPARE") {
    event.waitUntil(prepare().catch(() => {}));
    return;
  }
  if (event.data?.type !== "PREPARE_OFFLINE" || !event.ports?.[0]) return;
  const port = event.ports[0];
  event.waitUntil(
    prepare((data) => port.postMessage(data)).catch(() =>
      port.postMessage({ type: "error" }),
    ),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url),
    base = new URL(ROOT);
  if (
    request.method !== "GET" ||
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname)
  )
    return;
  // Content-hashed build files never change, so the prepared copy is always right.
  const hashed = /\/assets\/[^/]+-[\w-]{8}\.[a-z0-9]+$/.test(url.pathname);
  event.respondWith(
    (async () => {
      if (hashed) return (await cached(request)) ?? fetch(request);
      const network = fetch(request).then((response) => {
        if (!response.ok) throw Error("network response");
        return response;
      });
      network.catch(() => {});
      try {
        // A connected but crawling classroom network must not outlast the app's load timeout.
        const first = await Promise.race([
          network,
          new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT_MS)),
        ]);
        if (first) return first;
        return (await cached(request)) ?? (await network);
      } catch (error) {
        const hit = await cached(request);
        if (hit) return hit;
        throw error;
      }
    })(),
  );
});
async function cached(request) {
  const keys = await owned();
  for (const key of keys) {
    const hit = await (
      await caches.open(key)
    ).match(request, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
  }
  if (request.mode === "navigate")
    for (const key of keys) {
      const hit = await (
        await caches.open(key)
      ).match(new URL("index.html", ROOT).href, { ignoreVary: true });
      if (hit) return hit;
    }
}
