import { defineConfig } from "vite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
// Relative output works at an unknown repository path. Pages CI supplies its actual base_path.
export default defineConfig({
  plugins: [
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
  build: { target: "es2022" },
});
