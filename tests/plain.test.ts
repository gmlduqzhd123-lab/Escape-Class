import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plainLanguage,
  plainText,
  PLAIN_TIPS,
  PLAIN_WORDS,
} from "../src/content/plain";
import { OBJECTS } from "../src/content/data";

test("plain language rewrites text but never attributes", () => {
  const html =
    '<button data-action="modal" data-value="team" aria-label="협동 단서 맞추기">협동 단서 맞추기</button><p>암호판을 조작해요.</p>';
  const out = plainLanguage(html);
  assert.match(out, />힘 모으기 단서 맞추기</);
  assert.match(out, /비밀번호 판을 누르기해요|비밀번호 판/);
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
