// Tests speedFactor(): how fast the ball travels as the wall clears. The rule
// is the whole of issue "Speed up as the wall clears"; game.js only multiplies
// by what this returns.
//
//   node --test test/ball_speed_test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/ball-speed.js";

const { speedFactor, START, SPEED_AT_EMPTY } = globalThis.BUZZ_BALL_SPEED;

// The largest wall brick-wall.js lays (COLS * ROWS / 4). Re-typed here rather
// than read from the wall, so this test cannot agree with a wrong packer.
const PIECES = 24;

test("a whole wall is the starting speed and an empty one is 1.5 times it", () => {
  assert.equal(START, 1);
  assert.equal(SPEED_AT_EMPTY, 1.5);
  assert.equal(speedFactor(PIECES, PIECES), 1);
  assert.equal(speedFactor(0, PIECES), 1.5);
  // The rule does not care how big the wall is, only how far down it is.
  for (const total of [1, 2, 5, 12, 24]) {
    assert.equal(speedFactor(total, total), 1, `${total} pieces left of ${total}`);
    assert.equal(speedFactor(0, total), 1.5, `nothing left of ${total}`);
  }
});

test("the speed rises by the same step with every piece busted", () => {
  for (const total of [1, 2, 3, 7, 24]) {
    // Even to the bits a multiplied speed can be: two ways of reaching the
    // same speed differ by a rounding of the last place at most.
    const steps = [];
    for (let left = total; left >= 0; left--) steps.push(speedFactor(left, total));
    const step = (SPEED_AT_EMPTY - START) / total;
    const worst = Math.max(...steps.slice(1).map((f, i) => Math.abs(f - steps[i] - step)));
    assert.ok(worst < 1e-12, `${total} pieces: the steps differ by ${worst}, not evenly`);
    // Half a wall down is half way between the two ends.
    for (const left of [0, 6, 12, 18, 24]) {
      assert.equal(speedFactor(left, 24), 1 + 0.5 * (1 - left / 24), `${left} of 24`);
    }
  }
});

test("fewer pieces left is never slower, and every step between is reached", () => {
  for (const total of [1, 4, 13, 24]) {
    let previous = speedFactor(total, total);
    for (let left = total - 1; left >= 0; left--) {
      const factor = speedFactor(left, total);
      assert.ok(factor > previous, `${left} of ${total} is not faster than ${left + 1}`);
      previous = factor;
    }
    // Every piece of the wall is its own speed: nothing is skipped and nothing
    // repeats.
    const seen = new Set();
    for (let left = total; left >= 0; left--) seen.add(speedFactor(left, total));
    assert.equal(seen.size, total + 1, `${total} pieces give ${seen.size} speeds`);
    assert.ok(previous <= SPEED_AT_EMPTY, "the ball outgrew the top speed");
  }
});

test("a wall too small to rise, or a count off the wall, gives a speed to play with", () => {
  // A divide by zero here would stop a round, so the edges answer instead.
  for (const total of [0, -1, -24, NaN, undefined, null, "0", ""]) {
    for (const left of [0, 4, -3, NaN, undefined, null, "x", 99]) {
      const factor = speedFactor(left, total);
      assert.equal(typeof factor, "number");
      assert.ok(Number.isFinite(factor), `speedFactor(${left}, ${total}) is not a number to multiply by`);
      assert.equal(factor, START, `no room to rise still gives ${factor}`);
    }
  }
  // A total that is not a count at all is a wall with no room in it too: a
  // speed that is not a number is worse than a slow one, and the page multiplies
  // the ball's velocity straight by what this returns.
  for (const total of [Infinity, -Infinity, "1e999", "Infinity", {}]) {
    for (const left of [0, 3, 24, -1, NaN]) {
      const factor = speedFactor(left, total);
      assert.ok(Number.isFinite(factor), `speedFactor(${left}, ${total}) is ${factor}`);
      assert.equal(factor, START, `a wall of ${total} pieces still gives ${factor}`);
    }
  }
  // Pieces left beyond the wall are the top of it, and none left below zero is
  // its bottom; the factor never leaves the band the issue asked for.
  for (const total of [1, 9, 24]) {
    for (const left of [-1, -100, total + 1, total + 100]) {
      const factor = speedFactor(left, total);
      assert.ok(factor >= START && factor <= SPEED_AT_EMPTY, `speedFactor(${left}, ${total}) is ${factor}`);
    }
    assert.equal(speedFactor(-1, total), speedFactor(0, total), "less than nothing left is faster than nothing");
    assert.equal(speedFactor(total + 5, total), speedFactor(total, total), "more left than there are is slower than all of them");
  }
});

test("a count is a number of whole pieces, so a fraction of one is read as a piece", () => {
  // The page only ever hands this an Array#length, so a fraction can only arrive
  // from somewhere else. Rounding is what keeps the ramp the ramp: a fraction of
  // a piece must not buy a fraction of a step that no piece of the wall earned.
  assert.equal(speedFactor(1.4, 5), speedFactor(1, 5), "a piece and a bit of one went at another speed");
  assert.equal(speedFactor(0.9, 24), speedFactor(0, 24), "a piece not quite gone yet went at the top speed");
  assert.equal(speedFactor(23.6, 24), speedFactor(23, 24), "a piece almost gone went at the next piece's speed");
  assert.equal(speedFactor("7", 24), speedFactor(7, 24), "a count written as text is another speed");
  assert.equal(speedFactor(2.9, 3), speedFactor(2, 3), "a whole wall read as a fraction went at another speed");
  assert.equal(speedFactor(1.9, 1), START, "one piece left of one went faster than the wall it is");
  for (const [left, total] of [[1.4, 5], [0.9, 24], [23.6, 24], [-0.5, 24], [24.5, 24]]) {
    const factor = speedFactor(left, total);
    assert.ok(Number.isFinite(factor) && factor >= START && factor <= SPEED_AT_EMPTY, `${left} of ${total} is ${factor}`);
  }
});

test("the rule is the same numbers every time and asks nothing of a browser", () => {
  assert.equal(speedFactor(7, 24), speedFactor(7, 24));
  assert.equal(typeof globalThis.BUZZ_BALL_SPEED, "object");
  // No DOM, no storage, no network: only what the wall counts goes in.
  assert.deepEqual(Object.keys(globalThis.BUZZ_BALL_SPEED).sort(), ["SPEED_AT_EMPTY", "START", "speedFactor"]);
});
