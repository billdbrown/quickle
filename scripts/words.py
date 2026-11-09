"""Build data/words.tsv: every ENABLE word of 3-7 letters with its wordfreq Zipf score, and a flag.

ENABLE (public domain) decides what counts as a word; wordfreq (data CC BY-SA 4.0) says how
common it is. Every word stays guessable. The flag keeps a word out of answers and clues:
    x  on the profanity list (LDNOOBW, CC BY 4.0), or a plural of one
    p  probably a name: WordNet (Princeton, permissive licence) has no lowercase entry for it or its
       base form, and it isn't so common it must be a word (until, herself, which)
3-letter words are only there so the generator can tell a plural ("buys") from a word.
Run with wordfreq installed:
    python scripts/words.py path/to/enable1.txt path/to/ldnoobw-en.txt path/to/nltk_data
"""
import sys
import nltk
from wordfreq import zipf_frequency

enable, blocklist = sys.argv[1], sys.argv[2]
nltk.data.path.insert(0, sys.argv[3])
from nltk.corpus import wordnet as wn

def known(w):
    """WordNet has w, or its base form (slept -> sleep), as a lowercase entry."""
    for base in {w, wn.morphy(w)} - {None}:
        if any(l.name() == base for s in wn.synsets(base) for l in s.lemmas()):
            return True
    return False
blocked = {w.strip().lower() for w in open(blocklist, encoding="utf-8") if w.strip() and " " not in w.strip()}
def flag(w, z):
    if w in blocked or (w.endswith("s") and w[:-1] in blocked) or (w.endswith("es") and w[:-2] in blocked):
        return "x"
    if z >= 3.0 and len(w) >= 4 and z < 4.8 and not known(w):
        return "p"
    return ""
out = []
for line in open(enable, encoding="utf-8"):
    w = line.strip().lower()
    if 3 <= len(w) <= 7 and w.isalpha() and w.isascii():
        z = zipf_frequency(w, "en")
        out.append((w, z, flag(w, z)))
with open("data/words.tsv", "w", encoding="utf-8", newline="\n") as f:
    f.write("# word\tzipf\tflag  (ENABLE, public domain; frequencies from wordfreq, CC BY-SA 4.0)\n")
    for w, z, fl in out:
        f.write(f"{w}\t{z:.2f}\t{fl}\n")
print(len(out), "words")
