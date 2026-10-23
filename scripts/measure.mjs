import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, item.name);
    if (item.isDirectory()) await walk(p);
    else files.push(p);
  }
}
await walk("dist");
let total = 0,
  codeGzip = 0;
const sizes = [];
for (const path of files) {
  const data = await readFile(path);
  total += data.length;
  const gzip = gzipSync(data).length;
  if (/\.(js|css)$/.test(path)) codeGzip += gzip;
  sizes.push({ path, bytes: data.length, gzip });
}
const report = {
  builtFiles: sizes,
  totalBytes: total,
  initialAssetUpperBoundBytes: total,
  initialAssetTargetBytes: 4 * 1024 * 1024,
  jsCssGzipBytes: codeGzip,
  jsCssGzipTargetBytes: 400 * 1024,
  pass: total <= 4 * 1024 * 1024 && codeGzip <= 400 * 1024,
};
const evidence = process.env.EVIDENCE_DIR || "work/browser-current";
await mkdir(evidence, { recursive: true });
await writeFile(
  join(evidence, "performance.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
