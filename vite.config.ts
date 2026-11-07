import { defineConfig, type Plugin } from "vite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
// Files the game fetches at run time. A page opened from file:// may not
// fetch them, so the double-click copy carries them in file-data.js.
const FETCHED = [
  "data/game-config.json",
  "data/schools.json",
  "data/rankings.json",
  ...readdirSync("public/assets").map((name) => `assets/${name}`),
];
const TYPES: Record<string, string> = {
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
};
const fileOpen: Plugin = {
  name: "file-open",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html
        .replace(
          /<script type="module" crossorigin src=/g,
          "<script defer src=",
        )
        .replace(/ crossorigin/g, "")
        .replace(/(font|img|media|connect)-src 'self'/g, "$1-src 'self' data:")
        .replace("<script", '<script src="./file-data.js"></script><script'),
  },
  generateBundle() {
    const files = Object.fromEntries(
      FETCHED.map((name) => [
        name,
        [
          TYPES[extname(name)],
          readFileSync(join("public", name)).toString("base64"),
        ],
      ]),
    );
    this.emitFile({
      type: "asset",
      fileName: "file-data.js",
      source: `// Answers the game's own fetches when index.html is opened from a folder.
(() => {
  if (location.protocol !== "file:") return;
  const files = ${JSON.stringify(files)};
  const base = new URL("./", document.baseURI).href;
  const fetchFile = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const href = new URL(input instanceof Request ? input.url : String(input), document.baseURI).href;
    const name = href.startsWith(base) ? decodeURIComponent(href.slice(base.length).split(/[?#]/)[0]) : "";
    const file = Object.hasOwn(files, name) ? files[name] : null;
    if (!file) return fetchFile(input, init);
    const text = atob(file[1]);
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0));
    return Promise.resolve(new Response(bytes, { status: 200, headers: { "Content-Type": file[0] } }));
  };
})();
`,
    });
  },
};
// Relative output works at an unknown repository path. Pages CI supplies its actual base_path.
export default defineConfig({
  plugins: [
    ...(process.env.OFFLINE_FILE ? [fileOpen] : []),
    {
      name: "offline-lesson-manifest",
      writeBundle(options) {
        const dir = resolve(options.dir ?? "dist"),
          files: { url: string; sha256: string; bytes: number }[] = [];
        const walk = (at: string) => {
          for (const entry of readdirSync(at, { withFileTypes: true })) {
            const path = join(at, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (entry.name !== "offline-manifest.json") {
              const data = readFileSync(path);
              files.push({
                url: relative(dir, path).replaceAll("\\", "/"),
                sha256: createHash("sha256").update(data).digest("hex"),
                bytes: data.length,
              });
            }
          }
        };
        walk(dir);
        files.sort((a, b) => a.url.localeCompare(b.url));
        const revision = createHash("sha256")
          .update(JSON.stringify(files))
          .digest("hex")
          .slice(0, 16);
        writeFileSync(
          join(dir, "offline-manifest.json"),
          JSON.stringify({ version: 1, revision, files }),
        );
      },
    },
  ],
  base: process.env.PAGES_BASE || "./",
  // OFFLINE_FILE builds the copy a teacher opens by double-clicking
  // index.html: one classic script with every import and asset inlined,
  // because browsers refuse module scripts and fetches from file:// pages.
  build: process.env.OFFLINE_FILE
    ? {
        target: "es2022",
        assetsInlineLimit: () => true,
        modulePreload: false,
        cssCodeSplit: false,
        rollupOptions: {
          output: { format: "iife", inlineDynamicImports: true },
        },
      }
    : { target: "es2022" },
});
