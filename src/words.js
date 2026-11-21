// The words a round of Buzzword Buster is built from. Pure: no DOM, no
// storage, no network, so it is tested in node (test/words_test.mjs).
//
// A round takes its words from one of two places:
//
//   - the page's address, ?words=synergy,pivot,leverage (a wall to share), or
//   - the built-in list below, when the address names none worth using.
//
// Every word is cleaned the same way: lower case, letters, digits and hyphens
// only, at most WORD_LEN letters, at least three. A word the address repeats
// counts once more for each time it is named; counts are shown when a word is
// busted, and decide which words come first when there are too many.

export const WORD_MAX = 40; // the words a round is picked from
export const WORD_LEN = 10; // one word, cleaned; brick-wall.js writes no longer one
export const WORD_MIN = 3;

// Words too plain to be worth busting.
const STOP = new Set(("the and for with from this that should would could when while into onto your their there about " +
  "after before also have has had are was were will can not but all any our you its use make add show fix new more " +
  "each than then them through off under over between across").split(" "));

// The office classics. The count is how loud the word is in a meeting.
export const DEFAULT_WORDS = [
  ["synergy", 14], ["leverage", 13], ["pivot", 12], ["alignment", 11], ["roadmap", 11],
  ["bandwidth", 10], ["disrupt", 10], ["scalable", 9], ["agile", 9], ["paradigm", 9],
  ["holistic", 8], ["ecosystem", 8], ["deep-dive", 8], ["circle", 7], ["touchbase", 7],
  ["unpack", 7], ["learnings", 6], ["actionable", 6], ["onboard", 6], ["quick-win", 5],
  ["mindshare", 5], ["blockchain", 5], ["web3", 5], ["north-star", 4], ["offline", 4],
  ["bizdev", 4], ["wheelhouse", 4], ["growth", 3], ["vertical", 3], ["robust", 3],
  ["seamless", 3], ["empower", 3], ["ideate", 2], ["upskill", 2], ["omni", 2],
].map(([word, count]) => ({ word, count }));

export function clean(word) {
  return String(word ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, WORD_LEN);
}

// Counted, cleaned and ordered: loudest first, then alphabetical. Takes strings
// or { word, count }; anything else is skipped.
export function collectWords(items) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const said = typeof item === "string" ? item : item && typeof item.word === "string" ? item.word : "";
    const word = clean(said);
    if (word.length < WORD_MIN || STOP.has(word)) continue;
    const count = typeof item === "object" ? Math.max(1, Math.floor(Number(item.count)) || 1) : 1;
    counts.set(word, (counts.get(word) || 0) + count);
  }
  return [...counts].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, WORD_MAX);
}

// The words of a page address's query string ("?words=a,b c"), or the built-in
// list when it names none that survive cleaning.
export function wordsFrom(search) {
  let given = [];
  try {
    given = new URLSearchParams(String(search ?? "")).getAll("words").flatMap((v) => v.split(/[\s,]+/));
  } catch { given = []; }
  const words = collectWords(given);
  return words.length ? { words, source: "address" } : { words: collectWords(DEFAULT_WORDS), source: "built-in" };
}
