// The best score of this browser: the highest score of any round played on it.
// Pure: no DOM and no window inside it, so it is tested in node
// (test/best_score_test.mjs) with a storage handed to it. game.js keeps it in
// localStorage, keeps the best of the page's own rounds beside it, and shows the
// higher of the two in the readout.
//
// One best for the browser, not one per word or per page address, and nothing
// clears it. A stored value only counts when it is a whole score of at least
// zero, so a value put there by anything else reads as no best at all; scores
// are whole numbers, so the rule loses none of the game's own.

export const BEST_KEY = "buzzword-buster.best";

// What the storage holds is somebody else's bytes: digits only, no sign, no
// "+", no space and no exponent. Anything else says no score, so nothing here is
// rounded or clamped and no rounding can quietly make one number look like another.
const STORED = /^(0|[1-9][0-9]*)$/;

// The number a stored string says, or null when it says none. null, "", "abc",
// "12abc", "1e3", " 12" and "0x10" all say none, and so does any negative one.
export function storedScore(raw) {
  if (typeof raw !== "string" || !STORED.test(raw)) return null;
  const stored = Number(raw);
  return Number.isSafeInteger(stored) ? stored : null;
}

// The highest of the scores it is given. A score that is not a whole number of
// at least zero can be no one's best, so it is left out of the running.
export function bestOf(...scores) {
  let best = 0;
  for (const score of scores) {
    if (Number.isInteger(score) && score >= 0 && score > best) best = score;
  }
  return best;
}

// The best the storage holds, or 0 where there is no storage, it answers with an
// error, or what it holds is no score. Reading it is never an error, so the page
// plays either way.
export function readBest(storage) {
  let raw = null;
  try {
    raw = storage ? storage.getItem(BEST_KEY) : null;
  } catch { raw = null; }
  const stored = storedScore(raw);
  return stored === null ? 0 : stored;
}

// Keep a round's score and say what the best now is: this round against what the
// storage holds. The best of the page's own rounds is the caller's to keep, as
// the page outlives no storage that can hold it — where the storage is absent or
// answers with an error (private mode, a blocked cookie setting, a full quota),
// that page best is all there is, and a worse round cannot lower it.
export function recordScore(storage, score) {
  const best = bestOf(readBest(storage), score);
  try {
    if (storage) storage.setItem(BEST_KEY, String(best));
  } catch { /* the best of this page's rounds will do */ }
  return best;
}

// The same module for the page, which loads it as a plain script the way
// brick-wall.js is loaded. One definition, two entry points: the exports above
// for the tests, the global below for the game.
globalThis.BUZZ_BEST = { BEST_KEY, storedScore, bestOf, readBest, recordScore };
