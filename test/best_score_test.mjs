// Tests best-score.js: what a stored best has to say to count, and what a round
// does to it. A storage is handed in, so no browser is needed.
//
//   node --test test/best_score_test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { BEST_KEY, bestOf, readBest, recordScore, storedScore } from "../src/best-score.js";

// A localStorage that answers from an object, and can be made to fail. A write
// that fails leaves the box as it was, as a real one does when the quota is full.
// `failing` is fixed for the whole box; `readsBlocked` can be flipped part-way
// through a case, which is how a storage that dies mid-session is played out.
const storage = (initial = {}, failing = null) => {
  const items = new Map(Object.entries(initial));
  const box = {
    items,
    readsBlocked: failing === "read",
    getItem: (key) => {
      if (box.readsBlocked) throw new Error("storage is closed");
      return items.has(key) ? items.get(key) : null;
    },
    setItem: (key, value) => {
      if (failing === "write") throw new Error("quota is full");
      items.set(key, String(value));
    },
  };
  return box;
};

test("a missing, empty or malformed stored value reads as no best", () => {
  assert.equal(readBest(storage()), 0);
  for (const raw of ["", " ", "abc", "12abc", "1e3", "0x10", "1.5", "12 34", "+10", " 12", "12 ", "-0", "NaN", "Infinity", "١٢"]) {
    assert.equal(storedScore(raw), null, JSON.stringify(raw));
    assert.equal(readBest(storage({ [BEST_KEY]: raw })), 0, JSON.stringify(raw));
  }
  // Not a string at all: nothing anybody put in the box says a score.
  for (const raw of [null, undefined, 12, -3, {}, [], true]) assert.equal(storedScore(raw), null);
});

test("a negative stored value reads as no best", () => {
  for (const raw of ["-1", "-10", "-000"]) {
    assert.equal(storedScore(raw), null, raw);
    assert.equal(readBest(storage({ [BEST_KEY]: raw })), 0, raw);
  }
  assert.equal(storedScore("0"), 0);
  assert.equal(storedScore("250"), 250);
  // What the game writes is read back as it was written.
  const box = storage();
  recordScore(box, 130);
  assert.equal(box.items.get(BEST_KEY), "130");
  assert.equal(readBest(box), 130);
});

test("the page's own best stands when storage is unavailable", () => {
  // No storage at all, one that cannot be read, and one that cannot be written.
  // A page best is the caller's, the way the page outlives no storage that can
  // hold it, so the round is folded in by the caller and held beside the box.
  for (const box of [undefined, null, storage({}, "read"), storage({}, "write")]) {
    let pageBest = 0;
    const play = (score) => (pageBest = bestOf(pageBest, recordScore(box, score)));
    assert.equal(play(40), 40);
    assert.equal(play(20), 40, "a worse round does not lower it");
    assert.equal(play(80), 80, "a better round raises it");
    assert.equal(play(80), 80);
  }
  // Reading a storage that answers with an error is never an error itself.
  assert.equal(readBest(storage({}, "read")), 0);
  assert.equal(readBest({ getItem() { throw new Error("blocked"); } }), 0);
  assert.doesNotThrow(() => recordScore({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }, 70));
});

test("a round keeps the best only when it beats it", () => {
  const box = storage({ [BEST_KEY]: "100" });
  assert.equal(recordScore(box, 90), 100);
  assert.equal(box.items.get(BEST_KEY), "100", "a worse round writes nothing new");
  assert.equal(recordScore(box, 150), 150);
  assert.equal(box.items.get(BEST_KEY), "150");
  assert.equal(readBest(box), 150);
});

test("a score that is not a whole score neither is a best nor raises one", () => {
  // bestOf takes scores, and readBest turns what is stored into one of them.
  assert.equal(bestOf(readBest("100"), -5), 0, "a malformed stored value is no best at all");
  for (const box of [storage({ [BEST_KEY]: "100" }), storage({ [BEST_KEY]: "-10" })]) {
    const held = readBest(box);
    assert.equal(bestOf(held, -5), held === 0 ? 0 : 100);
    assert.equal(bestOf(held, 12.5), held === 0 ? 0 : 100);
    assert.equal(bestOf(held, NaN), held === 0 ? 0 : 100);
    assert.equal(bestOf(held, undefined), held === 0 ? 0 : 100);
    assert.equal(bestOf(held, "150"), held === 0 ? 0 : 100);
  }
  assert.equal(bestOf(100, -5), 100);
  assert.equal(bestOf(100, 12.5), 100);
  assert.equal(bestOf(100, NaN), 100);
  assert.equal(bestOf(100, undefined), 100);
  assert.equal(bestOf(-5), 0);
  assert.equal(bestOf(12.5), 0);
  assert.equal(bestOf("150"), 0);
  assert.equal(bestOf(70), 70);
  assert.equal(bestOf(0), 0);
  assert.equal(bestOf(100, 110), 110);
  assert.equal(bestOf(0, 0), 0);
  assert.equal(bestOf(), 0);
  // A round whose score is none does not disturb what is held.
  const box = storage({ [BEST_KEY]: "100" });
  assert.equal(recordScore(box, NaN), 100);
  assert.equal(recordScore(box, -5), 100);
  assert.equal(box.items.get(BEST_KEY), "100");
});

test("a round that does not beat the box leaves it alone, whatever the box holds", () => {
  // The write is skipped, not made and then ignored: a box that would fail the
  // write (a quota full, a disk gone) still answers for a round that has nothing
  // to add to it.
  for (const raw of ["100", "40"]) {
    for (const failing of [null, "write"]) {
      const box = storage({ [BEST_KEY]: raw }, failing);
      // The page is shown the better of the box and this round; the box itself is
      // untouched, which is the point of the case.
      assert.equal(recordScore(box, 40), Number(raw), `stored ${raw}, failing ${String(failing)}`);
      assert.equal(box.items.get(BEST_KEY), raw, `stored ${raw}, failing ${String(failing)}`);
    }
  }
});

test("a round that has nothing to add writes nothing, so a box cannot fail it", () => {
  // recordScore runs once a round, at the end of it. The one thing it must not do
  // is reach for setItem when the round did not beat the box — a browser whose
  // quota is full then still answers for the round, and BEST keeps showing what
  // the page has already played.
  const box = storage({ [BEST_KEY]: "120" }, "write");
  assert.equal(readBest(box), 120, "reading it is not an error either way");
  assert.doesNotThrow(() => recordScore(box, 60), "a losing round never reaches the write");
  assert.equal(box.items.get(BEST_KEY), "120");
  // A round that does beat it reaches the write and is caught, not thrown.
  assert.doesNotThrow(() => recordScore(box, 200));
  assert.equal(recordScore(box, 200), 200, "and the page is still shown the better round");
  assert.equal(box.items.get(BEST_KEY), "120", "while the box keeps what it holds");
});

test("a box nobody can read is left as it stands, and the round still plays", () => {
  // The box is not there to be trusted, so nothing is written into it and nothing
  // of it is believed. The round is still shown and counted: BEST falls back to
  // the page's own rounds and the loop carries on.
  const b = storage({ [BEST_KEY]: "150" });
  let pageBest = 0;
  const play = (score) => (pageBest = bestOf(pageBest, recordScore(b, score)));
  assert.equal(play(90), 150, "while it answers, the box still sets the floor");
  b.readsBlocked = true;
  assert.equal(play(200), 200, "the page keeps the better round with nothing to hold it");
  assert.equal(b.items.get(BEST_KEY), "150", "the box was not written over by a round that could not read it");
  b.readsBlocked = false;
  assert.equal(readBest(b), 150, "and the value it was holding is still there");
  assert.equal(play(300), 300, "a round may raise it again from there");
  assert.equal(b.items.get(BEST_KEY), "300");
});

test("only plain digits ever reach the box, whatever a caller hands in", () => {
  // readBest reads back exactly what recordScore writes, so String() of anything
  // other than a whole score must never get as far as setItem.
  for (const score of [NaN, Infinity, -Infinity, 1e21, 12.5, "80", null, undefined, {}, [], true, false, -5, 0, 7, 999]) {
    const box = storage();
    recordScore(box, score);
    const stored = box.items.get(BEST_KEY);
    if (stored !== undefined) assert.match(stored, /^(0|[1-9][0-9]*)$/, `String(${String(score)}) leaked into the box`);
  }
});

test("the best of this page's rounds outlives a storage that cannot hold it", () => {
  for (const box of [storage(), storage({}, "write")]) {
    let pageBest = 0;
    assert.equal((pageBest = bestOf(pageBest, recordScore(box, 210))), 210);
    assert.equal((pageBest = bestOf(pageBest, recordScore(box, 30))), 210, "the page still holds the better round");
    assert.equal(readBest(box), box.items.has(BEST_KEY) ? 210 : 0);
  }
});

test("the best is one number for the whole browser", () => {
  assert.equal(BEST_KEY, "buzzword-buster.best");
  const box = storage();
  recordScore(box, 60);
  assert.equal([...box.items.keys()].length, 1, "nothing else is kept in storage");
  assert.equal(readBest(box), 60);
});
