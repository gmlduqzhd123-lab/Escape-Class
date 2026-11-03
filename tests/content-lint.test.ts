import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { adaptEpisodeHtml, EPISODES } from "../src/content/episodes";
import { OBJECTS } from "../src/content/data";

// Screen text is written for the classroom and adapted per episode. This scans
// every Korean string literal in src/ through that adaptation so a new sentence
// with classroom wording fails here instead of in a library or gym lesson.
// The library keeps its window plant; the gym swaps it for a flag.
const CLASSROOM_WORDS = {
  library: /교실|우정|칠판|공놀이|바구니|골대|그림 책상/,
  gym: /교실|우정|칠판|공놀이|바구니|골대|그림 책상|화분/,
};
const ALLOWED = [
  // The app's own name, file names and the loading screen shown before any story is known.
  /^교실[ -]?탈출/,
  /^교실$/,
  /교실(을 준비하지 못했어요| 문을 여는 중)/,
  // Map place IDs kept in saves; the shown name goes through placeName().
  /^\$\{\(\["교실", "복도"/,
  // One branch of a per-story ternary whose other branches are already adapted.
  /^그림 책상 앞$/,
  // Teacher-facing text that talks about every story at once, or about the real room.
  /교실·도서관 이야기/,
  /안내가 닫히고 교실이 보여요/,
  /새로운 우정의 기록/,
];
// Bare identifiers (map places, 3D stop names, save values) are composed into
// sentences elsewhere; the 3D room swaps "교실" itself when it mounts.
const IDENTIFIER = /^[가-힣 ]{1,6}$/;
const SELF_ADAPTING = /scene\/classroom\.ts$/;
function literals(file: string) {
  const src = readFileSync(file, "utf8");
  const out: { line: number; text: string }[] = [];
  const re =
    /(?:"((?:[^"\\]|\\.)*?)"|'((?:[^'\\]|\\.)*?)'|`((?:[^`\\]|\\.)*?)`)/gs;
  for (const m of src.matchAll(re)) {
    const text = m[1] ?? m[2] ?? m[3] ?? "";
    if (/[가-힣]/.test(text))
      out.push({ line: src.slice(0, m.index).split("\n").length, text });
  }
  return out;
}
function sources(dir: string, acc: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, acc);
    else if (p.endsWith(".ts") && !p.endsWith("episodes.ts")) acc.push(p);
  }
  return acc;
}
test("every screen sentence adapts to the library and gym without classroom words", () => {
  const leaks: string[] = [];
  for (const file of sources("src"))
    for (const { line, text } of literals(file)) {
      if (SELF_ADAPTING.test(file) || IDENTIFIER.test(text)) continue;
      for (const id of ["library", "gym"] as const) {
        const adapted = adaptEpisodeHtml(text, id, OBJECTS);
        for (const sentence of adapted.split(/(?<=[.!?요])\s+|<[^>]+>/))
          if (
            CLASSROOM_WORDS[id].test(sentence) &&
            !ALLOWED.some((a) => a.test(sentence.trim()))
          )
            leaks.push(
              `${file}:${line} [${id}] ${sentence.trim().slice(0, 80)}`,
            );
      }
    }
  assert.deepEqual([...new Set(leaks)], []);
  assert.ok(Object.keys(EPISODES).length >= 3);
});
