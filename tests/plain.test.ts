import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plainLanguage,
  plainText,
  PLAIN_TIPS,
  PLAIN_WORDS,
} from "../src/content/plain";
import { OBJECTS } from "../src/content/data";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

test("plain language rewrites text but never attributes", () => {
  const html =
    '<button data-action="modal" data-value="team" aria-label="협동 단서 맞추기">협동 단서 맞추기</button><p>암호판을 조작해요.</p>';
  const out = plainLanguage(html);
  assert.match(out, />힘 모으기 단서 맞추기</);
  assert.match(out, /<p>비밀번호 판을 눌러요\.<\/p>/);
  assert.match(out, /data-value="team"/);
  assert.match(out, /aria-label="협동 단서 맞추기"/);
  assert.equal(plainText("기호 순서"), "모양 순서");
});
test("every object has a plain tip and no plain word is an action value", () => {
  for (const o of OBJECTS) assert.ok(PLAIN_TIPS[o.id], o.id);
  const values = [
    "교실",
    "복도",
    "담임 자리",
    "교무실",
    "상담실",
    "main",
    "bonus",
  ];
  for (const [word] of PLAIN_WORDS)
    assert.ok(!values.includes(word), `${word} is a data value`);
});
test("swapped words keep correct particles and verb endings", () => {
  const cases: [string, string][] = [
    ["기호를 찾아요", "모양을 찾아요"],
    ["기호가 있어요", "모양이 있어요"],
    ["기호와 숫자", "모양과 숫자"],
    ["협동과 배려", "힘 모으기와 배려"],
    ["조작은 쉬워요", "누르기는 쉬워요"],
    ["조작을 연습해요", "누르기를 연습해요"],
    ["가상 상황에서", "이야기 속 상황에서"],
    ["역할을 나눠요", "맡은 일을 나눠요"],
    ["연결망으로 가요", "연결 그림으로 가요"],
    ["역할로 정해요", "맡은 일로 정해요"],
    ["조사한 곳", "살펴본 곳"],
    ["조사한 내용은", "살펴본 것은"],
    ["탐색해요", "둘러봐요"],
    ["조작하기", "누르기"],
    ["조작한 뒤", "누른 뒤"],
    ["조작하면", "누르면"],
    ["획득하면", "얻으면"],
    ["협동해요", "힘을 모아요"],
    ["도움 요청망을", "도움 연결 그림을"],
    ["일시정지했어요", "멈췄어요"],
  ];
  for (const [from, to] of cases) assert.equal(plainText(from), to, from);
});
test("no screen sentence reads wrong in plain words", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      // plain.ts quotes the wrong forms in its own comments.
      else if (p.endsWith(".ts") && !p.endsWith("plain.ts")) files.push(p);
    }
  };
  walk("src");
  const finalOf = (w: string) => (w.charCodeAt(w.length - 1) - 0xac00) % 28;
  const bad: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(
      /"([^"\\\n]*[가-힣][^"\\\n]*)"|`([^`]*[가-힣][^`]*)`/g,
    )) {
      const out = plainLanguage(m[1] ?? m[2]);
      for (const [, to] of PLAIN_WORDS) {
        const has = finalOf(to) !== 0;
        const wrong = has ? /^(를|는|가|와|예요)/ : /^(을|은|과|이에요)/;
        for (const at of out.matchAll(new RegExp(to, "g"))) {
          const rest = out.slice(at.index + to.length);
          if (wrong.test(rest))
            bad.push(
              `${file}: ${out.slice(at.index, at.index + to.length + 4)}`,
            );
        }
      }
      for (const v of out.matchAll(/[가-힣]+기(해|한|하|할|했)[가-힣]*/g))
        if (!/(하기|이야기)/.test(v[0])) bad.push(`${file}: ${v[0]}`);
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});
