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
// game.js owns the events of the round and only reports them; these are the
// call sites it reports, and the whole of this module's surface:
//
//   pieceBusted(wordKey, isLastPieceOfWord, word?)  a piece just went; the verdict
//   paddleTouched()                                 the ball came back off the paddle
//   ballLost()                                      the ball went past the paddle; its run is over
//   ballInPlay()                                    a ball is off the paddle and climbing
//   reset()                                         a new wall, and the ball played with it
//
// A ball is in the air from the moment it is thrown until the paddle takes it.
// `word` is the { word, count } the piece belongs to, as brick-wall.js carries
// it, and the verdict of a bust is { busted, combo, points, word, line }. A hit
// that busts nothing is worth nothing, and a word scores once.

export const WORD_POINTS = 10; // a word busted however the ball got there
export const COMBO_POINTS = 20; // a word busted with one ball, paddle untouched
export const WORD_LINE = "BUSTED"; // what the word line says for an ordinary bust
export const COMBO_LINE = "COMBO"; // what it says when the whole word went at once
export const COUNT_MAX = 99; // the loudest the word line can say a word was

// The word line: which bust it is, the word in capitals, and how loud it was in
// the meeting. Text for textContent or fillText only — a word from the address
// is not markup. The count is bounded both ways so the line has a longest case.
export function lineFor(combo, word, count) {
  const loud = Math.min(COUNT_MAX, Math.max(1, Math.floor(Number(count)) || 1));
  return `${combo ? COMBO_LINE : WORD_LINE}: ${String(word ?? "").toUpperCase()} (${loud}×)`;
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
    // A new wall, and the ball it is played with: off the paddle, so the first
    // word of the round can be a combo. The round inherits no combo, and no
    // word, from the one before it.
    reset() {
      busted.clear();
      touched.clear();
      words.clear();
      thrown();
    },

    // The end of a ball's run — the paddle took it, or it went past the paddle:
    // any combo it was carrying is over, and the next ball starts clean.
    paddleTouched() { landed(); },
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

    // Whether the ball is in the air, so a test can look between the events.
    get combo() { return inTheAir; },
  };
}
