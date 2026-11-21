// Tests the theme rule of DESIGN.md: theme-pixel.css is the only file that
// names a colour, and every token the page uses is one it sets.
//
//   node --test test/theme_test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const theme = read("src/theme-pixel.css");
const set = new Set([...theme.matchAll(/^\s*--([a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
const users = { "src/game.css": read("src/game.css"), "src/game.js": read("src/game.js"), "src/brick-wall.js": read("src/brick-wall.js") };

test("every colour of the theme is twelve bits", () => {
  for (const [, hex] of theme.matchAll(/#([0-9a-fA-F]+)\b/g)) assert.equal(hex.length, 3, `#${hex}`);
});

test("no file but the theme names a colour", () => {
  for (const [path, text] of Object.entries(users)) {
    assert.doesNotMatch(text.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, path);
  }
});

test("every var() of the stylesheet is a token the theme sets", () => {
  for (const [, name] of users["src/game.css"].matchAll(/var\(--([a-z0-9-]+)\)/g)) assert.ok(set.has(name), `--${name}`);
});

test("every token the canvas paints with is one the theme sets", () => {
  const painted = [...users["src/game.js"].matchAll(/paint\("([a-z0-9-]+)"\)/g)].map((m) => m[1]);
  const colors = [...users["src/brick-wall.js"].matchAll(/"(piece-\d)"/g)].map((m) => m[1]);
  assert.ok(painted.length > 0);
  for (const name of [...painted, ...colors]) assert.ok(set.has(name), `--${name}`);
});
