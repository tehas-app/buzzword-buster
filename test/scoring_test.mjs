// Tests the scoring rule of Buzzword Buster: what a busted word is worth, and
// what the word line says about it. The events are reported the way game.js
// reports them — a piece busted (with whether it was the word's last), the
// paddle touched, a round reset — so a failure here names a round the game
// would have scored wrong.
//
//   node --test test/scoring_test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  COMBO_LINE,
  COMBO_POINTS,
  COUNT_MAX,
  WORD_LINE,
  WORD_POINTS,
  createScoring,
  lineFor,
} from "../src/scoring.js";

// A round's worth of pieces, in the order the ball takes them off the wall:
// four letters to a piece, as brick-wall.js writes them.
const pieceCount = (word) => Math.ceil(word.length / 4);
const lastOf = (word) => pieceCount(word) - 1;

// Serve a ball: off the paddle, into the wall, and back to the paddle again —
// the run a combo is measured over. reset() serves the first ball of a round;
// this is the second and every ball after it, each of which starts a run of its
// own and inherits no pieces from the ball before it.
const flight = (t) => { t.paddleTouched(); t.ballInPlay(); };

// Serve a ball and bust a whole word with it, reporting each of its pieces.
function bust(t, word, count = 1) {
  flight(t);
  let verdict;
  for (let p = 0; p <= lastOf(word); p++) {
    verdict = t.pieceBusted(word, p === lastOf(word), { word, count });
  }
  return verdict;
}

test("a busted word is worth 10; the same word with the ball never touched the paddle is worth 20", () => {
  assert.equal(WORD_POINTS, 10);
  assert.equal(COMBO_POINTS, 20);

  const touched = createScoring();
  flight(touched);
  touched.pieceBusted("pivot", false);
  touched.paddleTouched();
  assert.deepEqual(touched.pieceBusted("pivot", true, { word: "pivot", count: 3 }), {
    busted: true, combo: false, points: WORD_POINTS, word: "pivot", line: "BUSTED: PIVOT (3×)",
  });

  const flown = createScoring();
  flight(flown);
  flown.pieceBusted("pivot", false);
  assert.deepEqual(flown.pieceBusted("pivot", true, { word: "pivot", count: 3 }), {
    busted: true, combo: true, points: COMBO_POINTS, word: "pivot", line: "COMBO: PIVOT (3×)",
  });
});

test("a piece that is not the last of its word scores nothing", () => {
  const t = createScoring();
  flight(t);
  assert.deepEqual(t.pieceBusted("synergy", false, { word: "synergy", count: 14 }),
    { busted: false, combo: false, points: 0, word: null, line: null });
  assert.equal(t.combo, true, "the ball is still in the air, it just has not finished the word");
});

test("a word scores once: its last piece reported twice is not two busts", () => {
  const t = createScoring();
  const first = bust(t, "pivot");
  const again = t.pieceBusted("pivot", true, { word: "pivot", count: 1 });
  assert.equal(first.points, COMBO_POINTS);
  assert.deepEqual(again, { busted: false, combo: false, points: 0, word: null, line: null });
});

test("a single-piece word busted on a fresh ball is a combo", () => {
  // abc is one piece, so there is nothing "in between" to touch the paddle.
  const t = createScoring();
  flight(t);
  const verdict = t.pieceBusted("abc", true, { word: "abc", count: 1 });
  assert.equal(verdict.combo, true);
  assert.equal(verdict.points, COMBO_POINTS);
});

test("a paddle touch before the first piece of a word is no combo", () => {
  const t = createScoring();
  t.paddleTouched(); // the ball never left the paddle
  assert.equal(t.combo, false);
  assert.equal(t.pieceBusted("abc", true, { word: "abc", count: 1 }).combo, false);
});

test("a paddle touch between two words spoils neither of the words it separates", () => {
  const t = createScoring();
  assert.equal(bust(t, "synergy").points, COMBO_POINTS); // one clean run
  t.paddleTouched();
  assert.equal(bust(t, "pivot").points, COMBO_POINTS); // and the next word, on its own run
});

test("a paddle touch partway through a word makes it an ordinary bust", () => {
  const t = createScoring();
  flight(t);
  t.pieceBusted("alignment", false, { word: "alignment", count: 11 }); // 9 letters, 3 pieces
  t.paddleTouched();
  t.pieceBusted("alignment", false, { word: "alignment", count: 11 });
  t.paddleTouched();
  const verdict = t.pieceBusted("alignment", true, { word: "alignment", count: 11 });
  assert.equal(verdict.busted, true, "its last piece went");
  assert.equal(verdict.combo, false, "the ball came off the paddle since its first");
  assert.equal(verdict.points, WORD_POINTS);
});

test("pieces of other words busted in between do not spoil a combo", () => {
  const t = createScoring();
  flight(t);
  t.pieceBusted("synergy", false, { word: "synergy", count: 14 });
  t.pieceBusted("pivot", false, { word: "pivot", count: 12 }); // the ball wanders off
  t.pieceBusted("agile", false, { word: "agile", count: 9 });
  // ... and comes back to finish synergy, the paddle never touched again.
  const verdict = t.pieceBusted("synergy", true, { word: "synergy", count: 14 });
  assert.equal(verdict.busted, true);
  assert.equal(verdict.points, COMBO_POINTS, "synergy still combos");
});

test("two words carved on one ball run are both worth 20", () => {
  const t = createScoring();
  t.ballInPlay();
  const points = [];
  for (const word of ["synergy", "pivot"]) {
    for (let p = 0; p <= lastOf(word); p++) {
      points.push(t.pieceBusted(word, p === lastOf(word), { word, count: 1 }).points);
    }
  }
  assert.deepEqual(points.filter((p) => p > 0), [COMBO_POINTS, COMBO_POINTS]);
  // synergy is seven letters (two pieces), pivot five (two): four pieces, two busts.
  assert.equal(points.length, 4);
});

test("the same words score the same total however they interleave", () => {
  const oneAfterTheOther = createScoring();
  const total = (t) => [bust(t, "synergy"), bust(t, "pivot")].reduce((sum, v) => sum + v.points, 0);
  const sum = total(oneAfterTheOther);

  const interleaved = createScoring();
  interleaved.ballInPlay();
  const mixed = [];
  for (let p = 0; p <= Math.max(lastOf("synergy"), lastOf("pivot")); p++) {
    if (p <= lastOf("synergy")) mixed.push(interleaved.pieceBusted("synergy", p === lastOf("synergy"), { word: "synergy", count: 1 }));
    if (p <= lastOf("pivot")) mixed.push(interleaved.pieceBusted("pivot", p === lastOf("pivot"), { word: "pivot", count: 1 }));
  }
  assert.equal(mixed.reduce((s, v) => s + v.points, 0), sum);
  assert.equal(sum, COMBO_POINTS * 2);
});

test("losing the ball breaks every combo it was carrying", () => {
  const t = createScoring();
  flight(t);
  t.pieceBusted("synergy", false, { word: "synergy", count: 14 });
  t.ballLost(); // the ball went past the paddle
  const verdict = t.pieceBusted("synergy", true, { word: "synergy", count: 14 });
  assert.equal(verdict.busted, true);
  assert.equal(verdict.points, WORD_POINTS, "the run that carried it ended with the ball");
});

test("a word an earlier ball took a piece of is no one's combo", () => {
  // The pieces the dead ball took are not this ball's doing: a word whose last
  // piece goes on a later ball is an ordinary bust, while a word the later ball
  // clears whole is still its own combo.
  const handedOver = createScoring();
  flight(handedOver);
  handedOver.pieceBusted("synergy", false, { word: "synergy", count: 14 }); // first ball
  handedOver.ballLost();
  flight(handedOver);
  const finished = handedOver.pieceBusted("synergy", true, { word: "synergy", count: 14 });
  assert.equal(finished.busted, true);
  assert.equal(finished.points, WORD_POINTS, "the combo belonged to the ball that died");
  assert.equal(finished.line, "BUSTED: SYNERGY (14×)");

  const itsOwn = createScoring();
  flight(itsOwn);
  itsOwn.pieceBusted("pivot", false, { word: "pivot", count: 12 });
  itsOwn.ballLost();
  flight(itsOwn); // the second ball, which has never seen synergy at all
  assert.equal(itsOwn.pieceBusted("synergy", true, { word: "synergy", count: 14 }).points, COMBO_POINTS);
});

test("reset starts a round that inherits no combo and no word", () => {
  const t = createScoring();
  flight(t);
  t.pieceBusted("pivot", false, { word: "pivot", count: 12 });
  assert.equal(t.combo, true, "the ball of the old round is still in the air");
  t.reset();
  assert.equal(t.combo, true, "a new round is served with a ball in the air of its own");
  // The same wordKey again, from the new wall, named by the new word.
  assert.deepEqual(bust(t, "pivot", 3), {
    busted: true, combo: true, points: COMBO_POINTS, word: "pivot", line: "COMBO: PIVOT (3×)",
  });
});

test("reset throws the ball of the new round, so its first word can combo", () => {
  const t = createScoring();
  t.paddleTouched(); // whatever the last round ended with
  t.reset();
  assert.equal(t.combo, true, "the ball of a new round is off the paddle with its wall");
  assert.equal(t.pieceBusted("abc", true, { word: "abc", count: 1 }).points, COMBO_POINTS);
});

test("a ball that never left the paddle makes no combo, only an ordinary bust", () => {
  const t = createScoring();
  t.reset();
  t.paddleTouched(); // the ball of the round went straight back down
  assert.equal(t.combo, false);
  assert.equal(t.pieceBusted("pivot", true, { word: "pivot", count: 1 }).points, WORD_POINTS);
});

test("the word a piece carries names the line; a count of nothing is still one", () => {
  const t = createScoring();
  flight(t);
  assert.equal(t.pieceBusted("deep-dive", true, { word: "deep-dive", count: 8 }).line, "COMBO: DEEP-DIVE (8×)");
  const nameless = createScoring();
  flight(nameless);
  assert.equal(nameless.pieceBusted("x", true).line, "COMBO:  (1×)");
  const oddCount = createScoring();
  flight(oddCount);
  assert.equal(oddCount.pieceBusted("x", true, { word: "x", count: "lots" }).line, "COMBO: X (1×)");
  assert.equal(oddCount.pieceBusted("y", true, { word: "y", count: -4 }).line, "COMBO: Y (1×)");
});

test("the word line names the bust, the word and its count, in capitals", () => {
  assert.equal(WORD_LINE, "BUSTED");
  assert.equal(COMBO_LINE, "COMBO");
  assert.equal(lineFor(false, "pivot", 2), "BUSTED: PIVOT (2×)");
  assert.equal(lineFor(true, "pivot", 2), "COMBO: PIVOT (2×)");
  assert.equal(lineFor(false, null, 1), "BUSTED:  (1×)", "no word, no crash");
});

test("the word line is text for textContent, never markup", () => {
  const nasty = "<img onerror=alert(1)>";
  const line = lineFor(true, nasty, 1);
  assert.ok(line.includes(nasty.toUpperCase()), "the brackets survive as characters, not as a tag");
  assert.equal(line.match(/</g).length, 1, "nothing else in the line opened a tag");
  assert.equal(line, `COMBO: ${nasty.toUpperCase()} (1×)`);
});

test("a hit that busts no word is worth nothing", () => {
  const t = createScoring();
  flight(t);
  t.pieceBusted("pivot", false, { word: "pivot", count: 3 });
  assert.equal(t.pieceBusted("pivot", false, { word: "pivot", count: 3 }).points, 0,
    "only the last piece of the word scores");
  const fresh = createScoring();
  flight(fresh);
  assert.equal(fresh.pieceBusted("pivot", true, { word: "pivot", count: 3 }).points, COMBO_POINTS);
  // The same wordKey reported again after it is already off the wall.
  assert.equal(fresh.pieceBusted("pivot", true, { word: "pivot", count: 3 }).points, 0);
});

test("the word line has a longest case: no count, however repeated in the address, outgrows it", () => {
  // words.js sums a repeated ?words= word without a ceiling (500 repeats of one
  // word give count 500), so this is the one place the readout can be bounded —
  // the way the score and time readouts are bounded at their render sites.
  // Longest case: the 10 letters WORD_LEN allows, plus the loudest count.
  const longest = lineFor(true, "0123456789", COUNT_MAX);
  assert.equal(longest, "COMBO: 0123456789 (99×)");
  for (const count of [1e6, COUNT_MAX + 1, COUNT_MAX, 3, 1, 0, -4, "lots", null, undefined]) {
    assert.ok(lineFor(true, "synergy", count).length <= longest.length,
      `${count} does not outgrow the longest line`);
    assert.ok(/\(\d{1,2}×\)$/.test(lineFor(true, "synergy", count)), `${count} renders as one or two digits`);
  }
  assert.equal(lineFor(true, "pivot", 1e6), `COMBO: PIVOT (${COUNT_MAX}×)`);
  assert.equal(lineFor(false, "pivot", 0), "BUSTED: PIVOT (1×)", "and it never says zero");

  const t = createScoring();
  flight(t);
  assert.equal(t.pieceBusted("pivot", true, { word: "pivot", count: 500 }).line,
    `COMBO: PIVOT (${COUNT_MAX}×)`, "the bound holds through pieceBusted()");
});

test("the tracker answers the whole surface game.js reports", () => {
  // Every event game.js reports, driven in the order the loop reports them, with
  // the tracker's state asserted on both sides of each: paddle bounce, then the
  // run that ends with the ball past the paddle instead of on the paddle.
  const t = createScoring();
  t.reset(); // resetGame(): a new wall and a new ball
  assert.equal(t.combo, true, "the round is served with the ball in the air");
  t.pieceBusted("synergy", false, { word: "synergy", count: 14 });
  assert.equal(t.combo, true, "a piece busted does not by itself end the run");
  t.paddleTouched(); // the loop's bounce branch
  assert.equal(t.combo, false, "the bounce ends the run whether or not the ball was in that branch");
  t.paddleTouched(); // a bounce with nothing in flight is not an error
  assert.equal(t.combo, false);
  t.ballInPlay(); // the loop's ball-lost branch serves the next ball...
  assert.equal(t.combo, true);
  t.pieceBusted("synergy", false, { word: "synergy", count: 14 });
  t.ballLost(); // ... and the same ball goes past the paddle rather than bouncing
  assert.equal(t.combo, false, "a lost ball ends the run the bounce would have ended");
  assert.equal(t.pieceBusted("synergy", true, { word: "synergy", count: 14 }).points, WORD_POINTS,
    "and the word it had started is an ordinary bust");
  t.reset(); // PLAY AGAIN: no word and no combo carries over
  assert.equal(t.combo, true);
  assert.equal(t.pieceBusted("synergy", true, { word: "synergy", count: 14 }).points, COMBO_POINTS);
});

test("reset() is what separates two rounds: wordKey is the same number again next wall", () => {
  // brick-wall.js numbers words by their index in that wall's own shuffled list
  // (brick-wall.js: wordKey: wi), so wordKey 0 is a different word every round.
  // A tracker still holding the last wall's `busted` set drops the new wall's
  // word 0 and it scores nothing — reset() is the only thing that clears it.
  const stale = createScoring();
  stale.reset();
  stale.pieceBusted(0, false, { word: "synergy", count: 1 });
  assert.equal(stale.pieceBusted(0, true, { word: "synergy", count: 1 }).points, COMBO_POINTS, "round one, wordKey 0");
  stale.ballLost(); // the next ball of the same round — only reset() ends a round
  stale.ballInPlay();
  stale.pieceBusted(0, false, { word: "pivot", count: 1 });
  assert.equal(stale.pieceBusted(0, true, { word: "pivot", count: 1 }).points, 0,
    "the new wall's word 0 is silently dropped without reset()");

  const reset = createScoring();
  reset.reset();
  reset.pieceBusted(0, false, { word: "synergy", count: 1 });
  reset.pieceBusted(0, true, { word: "synergy", count: 1 });
  reset.reset(); // the only thing separating this wall from the one above
  reset.pieceBusted(0, false, { word: "pivot", count: 1 });
  assert.deepEqual(reset.pieceBusted(0, true, { word: "pivot", count: 1 }),
    { busted: true, combo: true, points: COMBO_POINTS, word: "pivot", line: "COMBO: PIVOT (1×)" },
    "the same wordKey from the new wall is still a bust — which is why game.js resets beside the wall build");
});

test("scoring.js is pure: no DOM, no clock, no randomness", () => {
  const src = readFileSync(new URL("../src/scoring.js", import.meta.url), "utf8");
  assert.doesNotMatch(src.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""), /\b(document|window|performance|localStorage|Math\.random)\b/);
});
