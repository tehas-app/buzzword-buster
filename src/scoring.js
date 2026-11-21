// What a busted word is worth, and what the word line says about it. Pure: no
// DOM, no clock, no randomness, so it is tested in node (test/scoring_test.mjs).
//
// A word scores when its last piece goes, not at the first one. On top of that,
// a word is a COMBO when every piece of it came off the wall while the ball was
// still in the air — the ball never touched the paddle between its first piece
// and its last. Pieces of other words busted in between do not spoil it: a ball
// that carves two words on one run is worth 20 for each of them. A combo is
// worth twice the ordinary bust and says COMBO in the word line.
//
// The tracker is the bookkeeping half of the rule. game.js owns the events and
// only reports them; the API is defined by those call sites:
//
//   pieceBusted(wordKey, isLastPieceOfWord, word?)  a piece just went; the verdict
//   paddleTouched()                                 the ball came back off the paddle
//   ballLost()                                      the ball went past the paddle; its run is over
//   ballInPlay()                                    a ball is off the paddle and climbing
//   reset()                                         a new wall, and the ball played with it
//
// A ball is in the air from the moment it is thrown until the paddle takes it:
// reset() throws the first ball of a round, and a game that serves the next one
// straight off the paddle says ballInPlay() for it. A word is a combo only when
// the ball still in the air took every piece of it itself — a piece knocked out
// by a ball that has since come off the paddle, or gone past it, gives the word
// away. That is why the first bust of a round can be a combo, and why a word two
// balls carved together is worth the ordinary 10.
//
// The verdict says whether that piece busted its word, whether the bust was a
// combo, what it is worth, and the text for the word line:
//
//   { busted, combo, points, word, line }
//
// `word` is the { word, count } the piece belongs to, as brick-wall.js carries
// it; it is what the line is named after, and is needed for the bust itself.
// A hit that busts nothing is worth nothing, and a word scores once: reporting
// its last piece a second time is not a second bust.

export const WORD_POINTS = 10; // a word busted however the ball got there
export const COMBO_POINTS = 20; // a word busted with one ball, paddle untouched
export const WORD_LINE = "BUSTED"; // what the word line says for an ordinary bust
export const COMBO_LINE = "COMBO"; // what it says when the whole word went at once

// The word line: which bust it is, the word in capitals, and how loud it was in
// the meeting. Text for textContent or fillText only — a word from the address
// is not markup.
export function lineFor(combo, word, count) {
  const loud = Math.max(1, Math.floor(Number(count)) || 1);
  return `${combo ? COMBO_LINE : WORD_LINE}: ${String(word ?? "").toUpperCase()} (${loud}×)`;
}

// What one verdict is worth: the bonus for a combo, the ordinary price for a
// bust, nothing at all for a hit that busted no word. A caller may name its own
// `points` — the verdict of pieceBusted() carries its own — and anything that is
// not a plain positive number is worth nothing.
export function scoreWord(verdict) {
  if (!verdict || verdict.busted !== true) return 0;
  const points = verdict.points ?? (verdict.combo ? COMBO_POINTS : WORD_POINTS);
  return Number.isFinite(points) && points > 0 ? points : 0;
}

// The bookkeeping of one round: which words are already off the wall, which of
// them a ball that has finished took a piece of, and which of them the ball now
// in the air took itself.
export function createScoring() {
  const busted = new Set(); // wordKeys with every piece already gone
  let touched = new Set(); // wordKeys a finished ball took a piece of, this round
  const words = new Map(); // wordKey -> the { word, count } to name the line after
  let inTheAir = false; // nothing is a combo before the ball of the round is thrown
  let flown = new Set(); // the wordKeys the ball now in the air has taken a piece of

  // The end of a flight: the pieces that ball took are now another ball's
  // history. A word it had started belongs to nobody's combo from here on, and
  // the next ball starts with a clean slate of its own.
  const landed = () => { inTheAir = false; touched = new Set([...touched, ...flown]); flown = new Set(); };

  // A new flight. The pieces it takes are its own; only the pieces taken by a
  // ball that has since come off the paddle, or gone past it, can give a word
  // away to somebody else.
  const thrown = () => { inTheAir = true; flown = new Set(); };

  return {
    // The ball is back off the paddle: its run is over, and so is any combo it
    // was carrying. The next ball is thrown by ballInPlay(), or by reset().
    paddleTouched() { landed(); },

    // A new wall, and the ball it is played with: off the paddle, so the first
    // word of the round can be a combo. The round inherits no combo, and no
    // word, from the one before it.
    reset() {
      busted.clear();
      touched.clear();
      words.clear();
      thrown();
    },

    // The ball went past the paddle: the run it was on is over, and the next
    // one starts clean — a word this ball had started is no one's combo now.
    ballLost() { landed(); },

    // The ball is off the paddle and climbing: the start of the run a combo is
    // measured over, and of the pieces it can be said to have busted.
    ballInPlay() { thrown(); },

    // A piece of `wordKey` just went, and `isLastPieceOfWord` says whether it
    // was that word's last. Only the last one of a word scores anything.
    pieceBusted(wordKey, isLastPieceOfWord, word) {
      if (word) words.set(wordKey, word);
      // Whatever ball knocked this piece out, the word has lost a piece — and a
      // word a finished ball took a piece of is no longer anyone's combo.
      if (inTheAir) flown.add(wordKey); else touched.add(wordKey);
      if (busted.has(wordKey)) return { busted: false, combo: false, points: 0, word: null, line: null };
      if (!isLastPieceOfWord) return { busted: false, combo: false, points: 0, word: null, line: null };

      busted.add(wordKey);
      // The ball still in the air took every piece the word had itself: one
      // knocked out by a ball that has since come off the paddle, or gone past
      // it, gives the word away.
      const combo = inTheAir && flown.has(wordKey) && !touched.has(wordKey);
      const named = words.get(wordKey) ?? null;
      const name = typeof named === "string" ? named : named?.word ?? null;
      const count = typeof named === "string" || !named ? 1 : named.count;
      return {
        busted: true,
        combo,
        points: combo ? COMBO_POINTS : WORD_POINTS,
        word: name,
        line: lineFor(combo, name, count),
      };
    },

    // Whether the ball is in the air, so a word it finishes could be a combo.
    // Nothing in the game reads it; a test that looks between the events can.
    get combo() { return inTheAir; },
  };
}

// The same tracker under the other name its events read well with at a call
// site; createScoring() is the one game.js calls.
export const createTracker = createScoring;
