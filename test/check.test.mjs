// node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { score, code, loadWords, loadExcluded, inflected, givesAway } from "../scripts/lib.mjs";

test("the page scores guesses exactly like the generator", () => {
  const src = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("function score("), src.indexOf("const same ="));
  const siteScore = new Function(fn + "; return score;")();
  const words = [...loadWords().keys()].filter((w) => w.length === 5);
  for (let i = 0; i < 20000; i++) {
    const a = words[(i * 7919) % words.length], b = words[(i * 104729) % words.length];
    assert.deepEqual(siteScore(a, b), score(a, b), `${a} vs ${b}`);
  }
  assert.deepEqual(score("eerie", "there"), [1, 0, 1, 0, 2]);
  assert.deepEqual(score("speed", "abide"), [0, 0, 1, 0, 1]);
});

test("every puzzle has exactly one common answer, and the answer is a word", () => {
  const words = loadWords(), dict = new Set(words.keys()), excluded = loadExcluded();
  const { days } = JSON.parse(readFileSync(new URL("../site/days.json", import.meta.url), "utf8"));
  const pool = {};
  for (const len of [4, 5, 6, 7]) pool[len] = [...words].filter(([w, z]) => w.length === len && z >= 3.0 && !inflected(w, dict) && !excluded.has(w)).map(([w]) => w);
  const seen = new Set();
  for (const day of days.slice(0, 120)) {
    for (const [answer, ...clues] of day) {
      assert.ok(dict.has(answer), answer);
      assert.ok(!seen.has(answer), `repeat ${answer}`);
      seen.add(answer);
      const fits = pool[answer.length].filter((w) => clues.every((c) => code(c, w) === code(c, answer)));
      assert.deepEqual(fits, [answer], `${answer} <- ${clues}`);
    }
  }
});

test("clues never hand over the word between them (from day 2; day 1 was played as it was)", () => {
  const { days } = JSON.parse(readFileSync(new URL("../site/days.json", import.meta.url), "utf8"));
  for (const day of days.slice(1)) {
    for (const [answer, ...clues] of day) {
      assert.ok(!givesAway(clues.map((g) => ({ g, s: score(g, answer) })), answer), `${answer} <- ${clues}`);
    }
  }
});
