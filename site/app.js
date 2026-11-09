// Quickle: four words a day, one guess each. No framework, no build.
"use strict";

const $ = (id) => document.getElementById(id);
const DAY_MS = 86400000;

/** 2 green, 1 yellow, 0 grey per letter; duplicates handled like the original game. Kept in step with scripts/lib.mjs by test/score.test.mjs. */
function score(guess, answer) {
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
const same = (a, b) => a.every((x, i) => x === b[i]);

// ---- Dates: a new set at local midnight, numbered from the first day.
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD
const dayNumber = (start, date) => Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / DAY_MS);

// ---- Saved progress, per day, so a reload picks up where you were and can't replay.
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const state = {
  date: localDate(), number: 0, puzzles: [], // [{ answer, clues: [..] }]
  progress: null, // { started, finished, results: [{ guess, outcome: "exact"|"fits"|"miss" }] }
  view: 0, // the puzzle on screen; stays on a finished one until "Next"
  typed: "", busy: false, dict: {},
};
const key = () => `quickle.${state.date}`;

async function words(len) {
  if (!state.dict[len]) {
    state.dict[len] = fetch(`words/${len}.txt`).then((r) => r.text()).then((t) => new Set(t.split("\n")));
  }
  return state.dict[len];
}

async function init() {
  if (load("quickle.contrast", false)) document.body.classList.add("contrast");
  const data = await fetch("days.json").then((r) => r.json());
  state.number = dayNumber(data.start, state.date);
  const today = data.days[state.number];
  if (!today) {
    $("startDay").textContent = "No puzzle today. Check back soon.";
    $("play").hidden = true;
    return;
  }
  state.puzzles = today.map(([answer, ...clues]) => ({ answer, clues }));
  state.progress = load(key(), null);
  const label = `#${state.number + 1} · ${new Date(state.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`;
  $("startDay").textContent = label;
  $("doneDay").textContent = label;
  // Warm the word lists while the rules are read.
  for (const p of state.puzzles) words(p.answer.length);
  if (state.progress?.finished) showDone();
  else if (state.progress) startGame();
}

// ---- Screens
function show(id) {
  for (const s of ["start", "game", "done"]) $(s).hidden = s !== id;
  $("keyboard").hidden = id !== "game";
  $("clock").hidden = id === "start";
}

function startGame() {
  if (!state.progress) {
    state.progress = { started: Date.now(), results: [] };
    save(key(), state.progress);
  }
  state.view = current();
  show("game");
  tick();
  render();
}

const current = () => state.progress.results.length;

// ---- Board
function tile(letter, cls = "", delay = 0) {
  const t = document.createElement("span");
  t.className = "t " + cls;
  t.textContent = letter;
  if (delay) t.style.animationDelay = delay + "ms";
  return t;
}
const CLS = ["x", "y", "g"];

function row(word, marks, { kind = "", reveal = false } = {}) {
  const r = document.createElement("div");
  r.className = "row " + kind;
  [...word].forEach((ch, i) => r.append(tile(ch.toUpperCase(), marks ? CLS[marks[i]] + (reveal ? " flip" : "") : "", reveal ? i * 120 : 0)));
  return r;
}

function render(reveal = false) {
  const i = state.view;
  const p = state.puzzles[i], res = state.progress.results[i];
  const len = p.answer.length;
  document.documentElement.style.setProperty("--len", len);
  $("label").textContent = `${i + 1} of 4 · ${len} letters`;

  const prog = $("progress");
  prog.replaceChildren(...state.puzzles.map((_, k) => {
    const d = document.createElement("span");
    const r = state.progress.results[k];
    d.className = "pip " + (r ? (r.outcome === "miss" ? "miss" : "win") : k === i ? "now" : "");
    return d;
  }));

  const board = $("board");
  board.replaceChildren();
  const clues = document.createElement("div");
  clues.className = "clues";
  p.clues.forEach((c) => clues.append(row(c, score(c, p.answer), { kind: "clue" })));
  board.append(clues);

  const yours = document.createElement("div");
  yours.className = "yours";
  if (res) {
    yours.append(row(res.guess, score(res.guess, p.answer), { kind: "guess", reveal }));
    if (res.outcome === "miss") yours.append(row(p.answer, new Array(len).fill(2), { kind: "answer", reveal }));
  } else {
    const r = document.createElement("div");
    r.className = "row input";
    r.id = "input";
    for (let k = 0; k < len; k++) r.append(tile((state.typed[k] || "").toUpperCase(), k === state.typed.length ? "cursor" : state.typed[k] ? "filled" : ""));
    yours.append(r);
  }
  board.append(yours);

  const hinted = hints().includes(i);
  $("hint").hidden = !!res || hinted;
  if (res) {
    $("message").innerHTML = res.outcome === "exact" ? (res.hint ? "Got it, with a hint." : "Got it.")
      : res.outcome === "fits" ? `That fits too! We had <b>${p.answer.toUpperCase()}</b> in mind.`
      : `Not this time. It was <b>${p.answer.toUpperCase()}</b>.`;
    $("next").hidden = false;
    $("next").textContent = i === state.puzzles.length - 1 ? "See results" : "Next word";
  } else {
    const h = hintAt(p);
    $("message").innerHTML = hinted ? `Hint: letter ${h + 1} is <b>${p.answer[h].toUpperCase()}</b>.` : "";
    $("next").hidden = true;
  }
  keyboard(p, res, hinted ? p.answer[hintAt(p)] : null);
}

// ---- Hints: one per word. Tells you a letter you don't know yet, in its place.
const hints = () => state.progress.hints || [];
/** The first position the clues haven't fixed, preferring a letter that hasn't shown up at all. */
function hintAt(p) {
  const fixed = new Set(), seen = new Set();
  for (const c of p.clues) score(c, p.answer).forEach((m, k) => { if (m === 2) fixed.add(k); if (m) seen.add(c[k]); });
  const open = [...p.answer].map((_, k) => k).filter((k) => !fixed.has(k));
  return open.find((k) => !seen.has(p.answer[k])) ?? open[0];
}
function useHint() {
  if (state.busy || state.progress.results[state.view]) return;
  state.progress.hints = [...hints(), state.view];
  save(key(), state.progress);
  render();
}

// ---- Keyboard, coloured by what the clues already tell you.
const ROWS = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"];
function keyboard(p, res, hinted) {
  const best = {};
  for (const c of p.clues) score(c, p.answer).forEach((m, k) => { best[c[k]] = Math.max(best[c[k]] ?? -1, m); });
  if (hinted) best[hinted] = 2;
  const kb = $("keyboard");
  kb.replaceChildren(...ROWS.map((r) => {
    const div = document.createElement("div");
    div.className = "krow";
    for (const ch of r) {
      const b = document.createElement("button");
      b.type = "button";
      if (ch === "+") { b.textContent = "Enter"; b.className = "k wide"; b.dataset.key = "Enter"; }
      else if (ch === "-") { b.textContent = "⌫"; b.className = "k wide"; b.dataset.key = "Backspace"; b.setAttribute("aria-label", "Delete"); }
      else { b.textContent = ch; b.className = "k " + (best[ch] === undefined ? "" : CLS[best[ch]]); b.dataset.key = ch; }
      b.disabled = !!res && ch !== "+";
      div.append(b);
    }
    return div;
  }));
}

// ---- Input
function press(k) {
  if ($("game").hidden || state.busy) return;
  const i = state.view;
  if (state.progress.results[i]) {
    if (k === "Enter") next();
    return;
  }
  const len = state.puzzles[i].answer.length;
  if (k === "Backspace") state.typed = state.typed.slice(0, -1);
  else if (k === "Enter") return submit();
  else if (/^[a-z]$/i.test(k) && state.typed.length < len) state.typed += k.toLowerCase();
  else return;
  render();
}

async function submit() {
  const p = state.puzzles[state.view], guess = state.typed, len = p.answer.length;
  if (guess.length < len) return nope("Not enough letters");
  const dict = await words(len);
  if (!dict.has(guess)) return nope("Not in the word list");
  // Any real word that fits every clue counts: the clues are the whole puzzle.
  const fits = p.clues.every((c) => same(score(c, guess), score(c, p.answer)));
  const outcome = guess === p.answer ? "exact" : fits ? "fits" : "miss";
  state.progress.results.push({ guess, outcome, hint: hints().includes(state.view) });
  if (current() >= state.puzzles.length) state.progress.finished = Date.now();
  save(key(), state.progress);
  state.typed = "";
  state.busy = true;
  render(true);
  setTimeout(() => { state.busy = false; }, len * 120 + 400);
}

function nope(text) {
  const r = $("input");
  r?.classList.remove("shake");
  void r?.offsetWidth;
  r?.classList.add("shake");
  toast(text);
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 1600);
}

function next() {
  if (state.busy) return;
  state.view++;
  if (state.view >= state.puzzles.length) return showDone();
  render();
}

// ---- Clock
const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function tick() {
  const p = state.progress;
  if (!p) return;
  $("clock").textContent = fmt((p.finished || Date.now()) - p.started);
  if (!p.finished) setTimeout(tick, 500);
}

// ---- Results
function record() {
  const hist = load("quickle.history", {});
  if (!(state.date in hist)) {
    hist[state.date] = { wins: state.progress.results.filter((r) => r.outcome !== "miss").length, ms: state.progress.finished - state.progress.started };
    save("quickle.history", hist);
  }
  return hist;
}

function showDone() {
  show("done");
  tick();
  const hist = record();
  const res = state.progress.results;
  const wins = res.filter((r) => r.outcome !== "miss").length;
  const ms = state.progress.finished - state.progress.started;
  $("doneTitle").textContent = ["Tough one.", "One out of four.", "Two out of four.", "Three out of four!", "All four!"][wins];

  $("results").replaceChildren(...state.puzzles.map((p, k) => {
    const r = res[k], d = document.createElement("div");
    d.className = "result " + (r.outcome === "miss" ? "miss" : "win") + (r.hint ? " hinted" : "");
    d.innerHTML = `<span class="mark">${r.outcome === "miss" ? "✕" : "✓"}</span><span class="word">${p.answer.toUpperCase()}</span>` +
      (r.outcome === "fits" ? `<span class="note">you said ${r.guess.toUpperCase()}, which fits${r.hint ? ", with a hint" : ""}</span>` : r.hint && r.outcome !== "miss" ? `<span class="note">with a hint</span>` : r.outcome === "miss" ? `<span class="note">you said ${r.guess.toUpperCase()}</span>` : "");
    return d;
  }));

  // Streak: consecutive days played, ending today.
  let streak = 0;
  for (let d = new Date(state.date + "T12:00:00"); hist[localDate(d)]; d = new Date(d - DAY_MS)) streak++;
  const days = Object.values(hist);
  const perfect = days.filter((h) => h.wins === 4).length;
  $("stats").innerHTML = [
    [fmt(ms), "time"], [streak, streak === 1 ? "day streak" : "days streak"], [days.length, "played"], [perfect, "all four"],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");

  $("share").onclick = async () => {
    const text = `Quickle #${state.number + 1} ${res.map((r) => (r.outcome === "miss" ? "🟥" : r.hint ? "🟨" : "🟩")).join("")} ${fmt(ms)}\n${location.origin}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Copied"); }
    } catch { /* cancelled */ }
  };
  countdown();
}

function countdown() {
  const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.floor((midnight - now) / 1000);
  $("countdown").textContent = `Next set in ${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  if (localDate() !== state.date) location.reload();
  else setTimeout(countdown, 30000);
}

// ---- Wiring
$("play").onclick = startGame;
$("next").onclick = next;
$("hint").onclick = useHint;
$("help").onclick = () => $("helpDialog").showModal();
$("contrast").onclick = () => save("quickle.contrast", document.body.classList.toggle("contrast"));
$("keyboard").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) press(b.dataset.key); });
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || $("helpDialog").open) return;
  // Enter means "submit / next" here, not "click whichever button has focus" (that would double up).
  if (e.key === "Enter") e.preventDefault();
  if (e.key === "Enter" && !$("start").hidden) return startGame();
  press(e.key);
});
init();
