// Builds the "인터넷 없는 교실" bundle: the built game, the tiny local server and
// the double-click launchers, zipped so a teacher can copy it to a classroom
// PC without internet. Usage: node scripts/package-offline.mjs <out.zip>
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const out = resolve(process.argv[2] ?? "work/escape-class-offline.zip");
const stage = resolve("work/offline");
const folder = join(stage, "escape-class");
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(folder, "scripts"), { recursive: true });
// A relative base works at the local server's path and any other.
execFileSync(
  "npx",
  ["vite", "build", "--outDir", join(folder, "dist"), "--emptyOutDir"],
  { stdio: "inherit", env: { ...process.env, PAGES_BASE: "./" } },
);
cpSync("scripts/serve.mjs", join(folder, "scripts", "serve.mjs"));
cpSync("PLAY.cmd", join(folder, "PLAY.cmd"));
cpSync("scripts/offline/PLAY.sh", join(folder, "PLAY.sh"));
cpSync("scripts/offline/읽어보세요.txt", join(folder, "읽어보세요.txt"));
rmSync(out, { force: true });
execFileSync("zip", ["-qr", out, "escape-class"], { cwd: stage });
console.log(
  JSON.stringify({
    zip: out,
    bytes: statSync(out).size,
    folder: "escape-class",
  }),
);
