// Shared by the generator and the tests. The site has its own copy of `score` (site/app.js);
// test/score.test.mjs keeps the two in step.
import { readFileSync } from "node:fs";

/**
 * Wordle-style feedback for `guess` against `answer`: 2 green, 1 yellow, 0 grey, per letter.
 * Duplicates count properly: greens claim their letters first, then yellows left to right.
 */
export function score(guess, answer) {
  const n = guess.length, out = new Array(n).fill(0), left = {};
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) out[i] = 2;
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < n; i++) {
    if (out[i] === 0 && left[guess[i]] > 0) { out[i] = 1; left[guess[i]]--; }
  }
  return out;
}

/** score() as one number, for fast comparison. Allocation-free: the generator calls it millions of times. */
const left = new Int8Array(26), marks = new Int8Array(8);
export function code(guess, answer) {
  const n = guess.length;
  left.fill(0);
  for (let i = 0; i < n; i++) {
    const g = guess.charCodeAt(i), a = answer.charCodeAt(i);
    if (g === a) marks[i] = 2;
    else { marks[i] = 0; left[a - 97]++; }
  }
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (marks[i] === 0) { const k = guess.charCodeAt(i) - 97; if (left[k] > 0) { marks[i] = 1; left[k]--; } }
    c = c * 3 + marks[i];
  }
  return c;
}

/** Every word with its Zipf frequency (0-8; 3 is "you'd know it", 5+ is everyday). */
export function loadWords(path = new URL("../data/words.tsv", import.meta.url)) {
  const words = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [w, z] = line.split("\t");
    words.set(w, Number(z));
  }
  return words;
}

/** Words kept out of answers and clues: flagged in words.tsv, or listed in data/exclude.txt. */
export function loadExcluded() {
  const out = new Set();
  for (const line of readFileSync(new URL("../data/words.tsv", import.meta.url), "utf8").split("\n")) {
    const [w, , flag] = line.split("\t");
    if (flag && flag.trim()) out.add(w);
  }
  for (const line of readFileSync(new URL("../data/exclude.txt", import.meta.url), "utf8").split("\n")) {
    if (line.startsWith("#")) continue;
    for (const w of line.trim().split(/\s+/)) if (w) { out.add(w); out.add(w + "s"); }
  }
  return out;
}

/**
 * Is `w` an inflection of a word that's also in the dictionary (cats, baked, baking, bigger)?
 * Answers are never inflections, the same promise Wordle makes about plurals; clue words may be.
 */
export function inflected(w, dict) {
  const has = (x) => x.length >= 3 && dict.has(x);
  if (w.endsWith("ss") || w.endsWith("us") || w.endsWith("is")) return false;
  if (w.endsWith("ies") && has(w.slice(0, -3) + "y")) return true;
  if (w.endsWith("es") && has(w.slice(0, -2))) return true;
  if (w.endsWith("s") && has(w.slice(0, -1))) return true;
  if (w.endsWith("ied") && has(w.slice(0, -3) + "y")) return true;
  if (w.endsWith("ed") && (has(w.slice(0, -2)) || has(w.slice(0, -1)) || (w[w.length - 3] === w[w.length - 4] && has(w.slice(0, -3))))) return true;
  if (w.endsWith("ing") && (has(w.slice(0, -3)) || has(w.slice(0, -3) + "e") || (w[w.length - 4] === w[w.length - 5] && has(w.slice(0, -4))))) return true;
  // Superlatives (biggest, safest). Comparatives in -er can't be told from nouns (baker, timer)
  // by spelling, so those are left to the frequency cut.
  if (w.endsWith("est")) {
    const stem = w.slice(0, -3);
    if (has(stem) || has(stem + "e") || (stem.at(-1) === stem.at(-2) && has(stem.slice(0, -1)))) return true;
  }
  return false;
}

/** A small seeded random generator (mulberry32), so the same seed always makes the same days. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
