// Writes site/words/{4..7}.txt: every dictionary word of that length, for checking guesses.
// Everything in ENABLE is guessable, including words kept out of answers.
import { mkdirSync, writeFileSync } from "node:fs";
import { loadWords } from "./lib.mjs";

const words = [...loadWords().keys()];
mkdirSync(new URL("../site/words/", import.meta.url), { recursive: true });
for (const len of [4, 5, 6, 7]) {
  const list = words.filter((w) => w.length === len).sort();
  writeFileSync(new URL(`../site/words/${len}.txt`, import.meta.url), list.join("\n"));
  console.log(len, list.length);
}
