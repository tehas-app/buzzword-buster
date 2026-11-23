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

// The highest of the scores it is given, or 0 when not one of them is a real
// score. A score that is not a whole number of at least zero can be no one's
// best, so it is left out of the running — which is also how the two answers
// `asked` returns for "no score" and "no answer" are kept out of a best.
// Number.isInteger is true for Infinity and String(Infinity) is not a score, so
// the test is the stricter Number.isSafeInteger.
export function bestOf(...scores) {
  let best = 0;
  for (const score of scores) {
    if (Number.isSafeInteger(score) && score > best) best = score;
  }
  return best;
}

// What the box answers for one question. Three outcomes, not two, and they are
// told apart by distinct values because a round must treat two of them
// differently:
//   UNREADABLE — the box would not answer, so nobody knows what it holds and
//                nothing may be written into it;
//   NO_SCORE   — it answered, and what it holds is no score, which is a box any
//                round may write its own best into;
//   a number   — the score it says it holds.
// Collapsing the first two into one value is what lets a round replace a stored
// best it was never shown, so they are kept apart here even though the readout
// shows 0 for both.
const UNREADABLE = Symbol("no answer");
const NO_SCORE = Symbol("no score");

const asked = (storage) => {
  if (!storage) return UNREADABLE;
  let raw = null;
  try {
    raw = storage.getItem(BEST_KEY);
  } catch { return UNREADABLE; }
  const score = storedScore(raw);
  return score === null ? NO_SCORE : score;
};

// The best the storage holds, or 0 where there is no storage, it answers with an
// error, or what it holds is no score. Reading it is never an error, so the page
// plays either way.
export function readBest(storage) {
  const answer = asked(storage);
  return typeof answer === "number" ? answer : 0;
}

// Keep a round's score and say what the best now is: this round against what the
// storage holds. The best of the page's own rounds is the caller's to keep, as
// the page outlives no storage that can hold it — where the storage is absent or
// answers with an error (private mode, a blocked cookie setting, a full quota),
// that page best is all there is, and a worse round cannot lower it.
export function recordScore(storage, score) {
  // Two asks of the box, not one. The first names the round's best; the second is
  // the box as it stands the moment before the write, so a best another page on
  // this browser raised in between is not overwritten with the older one. There
  // is no lock, so two rounds ending in the same instant can still lose one
  // another's write; nothing here lowers the best either page shows.
  const first = asked(storage);
  const justNow = asked(storage);
  // Shown and kept are two different answers. The page is shown the round's own
  // score even where the box would not answer, because the readout has to say
  // something; the box is written only with a whole score read from it or scored
  // by this round, so the bytes that land there are always bytes readBest reads
  // back. A round that ties or loses the box leaves it exactly as it was.
  // bestOf leaves the two symbols out of the running on its own: neither is a
  // whole number, so neither can be anybody's best.
  const shown = bestOf(first, justNow, score);
  if (justNow === UNREADABLE) return shown;
  const kept = bestOf(justNow, score);
  if (kept === bestOf(justNow)) return shown;
  try {
    storage.setItem(BEST_KEY, String(kept));
  } catch { /* the best of this page's rounds will do */ }
  return shown;
}

// The same module for the page, which loads it as a plain script the way
// brick-wall.js is loaded. One definition, two entry points: the exports above
// for the tests, the global below for the game.
globalThis.BUZZ_BEST = { BEST_KEY, storedScore, bestOf, readBest, recordScore };
