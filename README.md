# Quickle

Five words a day, one guess each. Each word comes with one or two clue rows (guesses already
made, coloured green/yellow/grey) chosen so that exactly one common word fits. Any real word that
fits every clue counts as a win.

Live at https://quickle.bill.computer. A static site (`site/`) served as an assets-only Cloudflare
Worker; no server, no accounts. Progress, streak and stats live in the browser's localStorage.

## The day

| # | Length | Answer | Clues |
|---|---|---|---|
| 1 | 4 | very common | generous |
| 2 | 5 | common | middling |
| 3 | 5 | less common | sparse |
| 4 | 6 or 7 (alternating) | common | middling |

A new set at local midnight. Answers are never plurals or verb forms, never repeat within a year.

## How puzzles are made

`scripts/generate.mjs` picks each answer, scores a sample of common clue words against it, and
keeps clue sets (one row, or two) that leave **exactly one** word among the common, non-name,
non-inflected words of that length. The slot's difficulty picks among them: easy shows the most
coloured tiles, hard the fewest. Output is `site/days.json`, **append-only**: existing days are
never rewritten, because people have played them. Extend with `node scripts/generate.mjs <days>`.

Word data:

- `data/words.tsv`, from `scripts/words.py`: every [ENABLE](https://github.com/dolph/dictionary)
  word of 3-7 letters (public domain) with its [wordfreq](https://github.com/rspeer/wordfreq) Zipf
  frequency (**CC BY-SA 4.0**, so this file is too), flagged `x` for the
  [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
  profanity list (CC BY 4.0) or `p` when [WordNet](https://wordnet.princeton.edu/) only knows it
  as a name.
- `data/exclude.txt`: hand-kept words never used as answers or clues (names, places, crude).
  Every word stays guessable.
- `site/words/{4..7}.txt`, from `scripts/site-words.mjs`: the guess dictionary.

## Work on it

    node --test test/check.test.mjs   # scoring matches the page; every puzzle has one answer
    npx wrangler dev                  # local, http://localhost:8787
    ./deploy.sh                       # tests, then wrangler deploy

Repo: `git@git.lan:quickle.git` (origin), mirrored to public `github.com/billdbrown/quickle`.
No licence chosen yet for the code.
