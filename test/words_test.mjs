// Tests words.js: which words a round is picked from, and how they are cleaned.
//
//   node --test test/words_test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { clean, collectWords, DEFAULT_WORDS, WORD_LEN, WORD_MAX, WORD_MIN, wordsFrom } from "../src/words.js";
import "../src/brick-wall.js";

const { MAX_LETTERS, build } = globalThis.BUZZ_BRICK_WALL;

test("a word is cleaned to lower-case letters, digits and hyphens, cut to WORD_LEN", () => {
  assert.equal(clean("Synergy!"), "synergy");
  assert.equal(clean("Deep-Dive"), "deep-dive");
  assert.equal(clean("<b>web3</b>"), "bweb3b");
  assert.equal(clean("supercalifragilistic").length, WORD_LEN);
  assert.equal(clean(null), "");
  assert.equal(clean(undefined), "");
});

test("no word the page hands over is longer than the wall writes", () => {
  assert.ok(WORD_LEN <= MAX_LETTERS);
});

test("short words and stop words are dropped", () => {
  assert.deepEqual(collectWords(["ab", "", "the", "and", "x"]), []);
  assert.deepEqual(collectWords(["abc"]), [{ word: "abc", count: 1 }]);
  assert.equal(WORD_MIN, 3);
});

test("a word named twice counts twice, and the loudest come first", () => {
  const words = collectWords(["pivot", "Pivot", { word: "synergy", count: 5 }, "agile"]);
  assert.deepEqual(words, [{ word: "synergy", count: 5 }, { word: "pivot", count: 2 }, { word: "agile", count: 1 }]);
});

test("what is not a word or a { word } is skipped", () => {
  assert.deepEqual(collectWords([null, 7, {}, { word: 3 }, ["pivot"]]), []);
  assert.deepEqual(collectWords("pivot"), []);
  assert.deepEqual(collectWords({ word: "x" }), []);
  // A count that is not a positive number counts as one.
  assert.deepEqual(collectWords([{ word: "pivot", count: -4 }, { word: "agile", count: "lots" }]),
    [{ word: "agile", count: 1 }, { word: "pivot", count: 1 }]);
});

test("at most WORD_MAX words are kept", () => {
  const many = Array.from({ length: WORD_MAX + 10 }, (_, i) => `word${String(i).padStart(3, "0")}`);
  assert.equal(collectWords(many).length, WORD_MAX);
});

test("the address names the words, split on commas and spaces", () => {
  const { words, source } = wordsFrom("?words=pivot,synergy%20agile&words=pivot");
  assert.equal(source, "address");
  assert.deepEqual(words.map((w) => w.word), ["pivot", "agile", "synergy"]);
});

test("an address with no usable words falls back to the built-in list", () => {
  for (const search of ["", "?", "?words=", "?words=a,b,the", "?other=pivot", null, undefined]) {
    const { words, source } = wordsFrom(search);
    assert.equal(source, "built-in");
    assert.deepEqual(words, collectWords(DEFAULT_WORDS));
  }
});

test("every built-in word survives cleaning as it is written", () => {
  for (const { word } of DEFAULT_WORDS) assert.equal(clean(word), word, word);
  assert.equal(collectWords(DEFAULT_WORDS).length, DEFAULT_WORDS.length);
});

test("the built-in list always builds a wall", () => {
  const words = collectWords(DEFAULT_WORDS);
  for (let seed = 1; seed <= 50; seed++) {
    let a = seed;
    const random = () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648);
    assert.ok(build(words, random).length > 0, `seed ${seed}`);
  }
});
