// Makes site/days.json: five puzzles a day (day 1 had four). Each is an answer plus one or two clue rows that leave
// exactly one possible answer among common words.
//
//   node scripts/generate.mjs [days=730] [start=2026-11-09]
//
// Append-only: existing days are never changed, so run it again with a bigger number to extend.
// Delete site/days.json to start over (only before anyone has played).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { score, code, loadWords, loadExcluded, inflected, rng, givesAway } from "./lib.mjs";

const DAYS = Number(process.argv[2] || 730);
const START = process.argv[3] || "2026-11-09";

// The day's four slots: length, how common the answer is (Zipf), how sparse the clues are.
//   min/max: answer frequency band. Rarer answers are harder to dig up from memory.
//   want:    "easy" picks clues showing the most coloured tiles, "hard" the fewest.
const SLOTS = [
  { len: 4, min: 3.8, want: "easy" },
  { len: 5, min: 3.8, want: "easy" },
  { len: 5, min: 3.6, want: "medium" },
  { len: 5, min: 3.2, want: "hard" },
  { len: (d) => (d % 2 ? 7 : 6), min: 3.3, want: "medium" },
];
// A word counts as "possible" for uniqueness if it's at least this common. Rarer words that fit
// still win when guessed; they just don't make a puzzle ambiguous.
const POSSIBLE = 3.0;
const CLUE = 3.0; // clue words should be recognisable too

const words = loadWords();
const dict = new Set(words.keys());
const excluded = loadExcluded();
const byLen = (len, pred) => [...words].filter(([w, z]) => w.length === len && pred(w, z)).map(([w]) => w);
const pools = {};
for (const len of [4, 5, 6, 7]) {
  pools[len] = {
    possible: byLen(len, (w, z) => z >= POSSIBLE && !inflected(w, dict) && !excluded.has(w)),
    clues: byLen(len, (w, z) => z >= CLUE && !excluded.has(w)),
  };
}

const colours = (s) => s.filter((x) => x > 0).length;

/** Candidates (from `pool`) that give the same feedback as `answer` for every clue. */
const consistent = (pool, clues, answer) => {
  const codes = clues.map((g) => code(g, answer));
  return pool.filter((w) => clues.every((g, i) => code(g, w) === codes[i]));
};

/**
 * All good clue sets for `answer`: single rows, then pairs. A row may not give the word away
 * (at most len-2 coloured tiles) and must show at least one colour, or it's no fun to read.
 */
function clueSets(answer, random) {
  const len = answer.length, { possible, clues } = pools[len];
  // Sample the clue words: the full set is slow and gives no better puzzles.
  const sample = clues.filter((g) => g !== answer).sort(() => random() - 0.5).slice(0, 700);
  const rows = [];
  for (const g of sample) {
    const s = score(g, answer), c = colours(s);
    if (c < 1 || c > len - 2) continue;
    const left = consistent(possible, [g], answer);
    rows.push({ g, s, c, greens: s.filter((x) => x === 2).length, left });
  }
  const sets = [];
  for (const r of rows) if (r.left.length === 1 && !givesAway([r], answer)) sets.push({ clues: [r.g], tiles: r.c, greens: r.greens, firstLeft: 1 });
  // Pairs: a first row that narrows to a handful, then a second that settles it.
  const firsts = rows.filter((r) => r.left.length >= 2 && r.left.length <= 25).slice(0, 60);
  for (const a of firsts) {
    for (const b of rows) {
      if (b.g === a.g || b.left.length === 1) continue;
      if (givesAway([a, b], answer)) continue;
      if (a.left.every((w) => w === answer || !b.left.includes(w))) {
        sets.push({ clues: [a.g, b.g], tiles: a.c + b.c, greens: a.greens + b.greens, firstLeft: a.left.length });
      }
    }
  }
  return sets;
}

/** Pick one clue set for the slot's difficulty. Fewer rows and fewer tiles to read is quicker. */
function choose(sets, want, random) {
  if (!sets.length) return null;
  const singles = sets.filter((s) => s.clues.length === 1);
  const pick = (list, key) => {
    list.sort((a, b) => key(a) - key(b) || random() - 0.5);
    return list;
  };
  if (want === "easy") {
    // Easy: one generous row if there is one, otherwise the most generous pair.
    const list = singles.length ? singles : sets;
    return pick(list, (s) => -(s.tiles + s.greens))[0];
  }
  if (want === "hard") {
    // Hard: the sparsest clues, preferring a single row (one sparse row is the real puzzle).
    const list = singles.length ? singles : sets;
    return pick(list, (s) => s.tiles * 2 + s.greens + s.clues.length)[0];
  }
  const list = singles.length ? singles : sets;
  const sorted = pick(list, (s) => s.tiles + s.greens);
  return sorted[Math.floor(sorted.length / 2)];
}

const addDays = (date, n) => new Date(Date.parse(date + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

// Append-only: days already in site/days.json are kept exactly as they are, because people have
// played them. New days continue after the last one.
const OUT = new URL("../site/days.json", import.meta.url);
const days = [];
if (existsSync(OUT)) {
  const old = JSON.parse(readFileSync(OUT, "utf8"));
  if (old.start === START) {
    old.days.forEach((d, i) => days.push({ date: addDays(START, i), puzzles: d.map(([answer, ...clues]) => ({ answer, clues })) }));
  }
}
const random = rng(20261109 + days.length);
// An answer can come back once a year has passed: one 4-letter word a day uses up the common ones.
const REPEAT_AFTER = 365;
const used = new Map(); // answer -> day index
days.forEach((day, i) => day.puzzles.forEach((p) => used.set(p.answer, i)));
const t0 = Date.now();
for (let d = days.length; d < DAYS; d++) {
  const date = addDays(START, d);
  const puzzles = [];
  for (const slot of SLOTS) {
    const len = typeof slot.len === "function" ? slot.len(d) : slot.len;
    const fresh = (w) => !used.has(w) || d - used.get(w) >= REPEAT_AFTER;
    const answers = pools[len].possible.filter((w) => words.get(w) >= slot.min && fresh(w));
    let made = null;
    for (let tries = 0; tries < 40 && !made; tries++) {
      const answer = answers[Math.floor(random() * answers.length)];
      const set = choose(clueSets(answer, random), slot.want, random);
      if (set) made = { answer, clues: set.clues, want: slot.want };
    }
    if (!made) throw new Error(`no puzzle for ${date} slot ${len}`);
    used.set(made.answer, d);
    puzzles.push(made);
  }
  days.push({ date, puzzles });
  if (d % 50 === 0 || process.env.SHOW) console.log(date, puzzles.map((p) => `${p.answer} <- ${p.clues.join("+")}`).join("  "), `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// The answers are in the file, as they were in Wordle's: anyone determined can read ahead.
writeFileSync(OUT, JSON.stringify({ start: START, days: days.map((d) => d.puzzles.map((p) => [p.answer, ...p.clues])) }));
console.log(`${days.length} days written. Answer pools:`, Object.fromEntries(Object.entries(pools).map(([l, p]) => [l, p.possible.length])));
