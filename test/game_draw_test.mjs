// Tests how the ball is drawn — a round path in the ball's own colour, at the
// size and the speed it has always had, with the paddle, the wall and the floor
// still square — and how the page scales the 480 by 272 buffer it is drawn into.
//
// game.js is the part of the game that needs a browser, so this file stands in
// for one: a document, a window, a canvas and a 2d context that keeps every
// shape it was asked to paint. It then asks the loop's own frame for a picture,
// with the round's clock held still so the frame says what it means.
//
//   node --test test/game_draw_test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wordsFrom } from "../src/words.js";
import { test } from "node:test";
import "../src/brick-wall.js"; // sets BUZZ_BRICK_WALL, as the page does

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const gameSource = read("src/game.js");
const cssSource = read("src/game.css");
// The stylesheet without its comments: a comment is not a rule.
const cssRules = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");
// The loop's source as code: a comment is not a statement, and the guard
// below is about what the loop does.
const gameCode = gameSource.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");

// The style attribute of an element, as the loop writes to it: what an element
// carries, not how it was written. Both spellings of an inline rule —
// `style.imageRendering = v` and `style.setProperty("image-rendering", v)` —
// land on the same CSS name here, because the cascade reads them as one thing:
// an inline rule beats a stylesheet rule on the same element whichever was
// used. A test that matched one spelling in one file and one in the other would
// have passed while the ball was flattened, which is the hole this fills.
function styleAttribute() {
  const declared = new Map();
  const css = (name) => String(name).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  const style = {
    setProperty(name, value) { declared.set(css(name), value); },
    removeProperty(name) { declared.delete(css(name)); },
  };
  // The traps below must all answer the same question the same way. Each asks
  // the target with Reflect, never with `in` or a plain read — those reach back
  // into this proxy's own has / get traps and recurse — and ownKeys reports
  // exactly the names getOwnPropertyDescriptor will describe, or Object.entries
  // would list a property the descriptor trap denies.
  const keyOf = (name) => css(name);
  return new Proxy(style, {
    get: (target, name) =>
      (Reflect.has(target, name) ? Reflect.get(target, name) : declared.get(keyOf(name))),
    set: (target, name, value) => { declared.set(keyOf(name), value); return true; },
    has: (target, name) => Reflect.has(target, name) || declared.has(keyOf(name)),
    ownKeys: () => [...declared.keys()],
    getOwnPropertyDescriptor: (target, name) =>
      (declared.has(keyOf(name))
        ? { value: declared.get(keyOf(name)), enumerable: true, configurable: true }
        : Reflect.getOwnPropertyDescriptor(target, name)),
  });
}

// The canvas of the page as index.html writes it.
const W = 480, H = 272;
// Where a round starts and how fast it goes. These are written here rather than
// read from the game, the way brick_wall_test.mjs writes out the seven
// tetrominoes: a change to how the ball moves is meant to fail, not be agreed
// with. The loop steps by 40 ms at most, which is the tick every frame below is
// drawn at.
const START = { x: W / 2, y: H - 40, vx: 145, vy: -175 };
const TICK = 0.04;
const BALLS = 3; // the balls a round starts with, as the loop counts them
const PADDLE = { w: 72, h: 8, y: H - 32 };
// The ball's own 4 px: the half extent it collides with, and the radius it is
// drawn with, which are the same number because the ball is drawn as big as
// the box it bounces with. The page starts with them as one 8 px footprint.
const EXTENT = 4;
// An hour on the clock before a round is begun, so no frame below is the frame
// that runs the round's clock out.
const HOUR = 3600e3;

// A round in progress: the rules the frames are drawn under, not rules they are
// checked by. Its clock sits at whole seconds so no frame of these ends it, and
// its balls are counted out here rather than left to whatever the loop happens to
// hold — a frame that wants the end of a round says so itself, and a count carried
// by the ball below would quietly overrule that.
const RUNNING = { mode: "playing", score: 0, time: 40, paddleX: W / 2, paddleW: 72 };
// The ball at the start of a round, a tick short of the floor, with the balls the
// round starts with in hand. The direction the loop sends a new ball is its own
// coin (game.js:95), held by the rig; the speed is not.
const FALLING = { x: START.x, y: START.y, vx: START.vx, vy: START.vy, lives: BALLS };

// A canvas 2d context that keeps every shape it was asked to paint.
function recordingContext() {
  const calls = [];
  const ctx = { fillStyle: "", font: "", textAlign: "", textBaseline: "" };
  for (const name of ["fillRect", "fillText", "arc", "roundRect", "ellipse", "beginPath", "fill", "stroke"]) {
    ctx[name] = (...args) => { calls.push({ name, args, fillStyle: ctx.fillStyle }); };
  }
  return { ctx, calls };
}

// The words of the round and the wall it hangs, both from the real modules:
// words.js cleans them and brick-wall.js lays them out, so the wall below is
// the wall the page hangs and none of it is written twice.
const WORDS = Array.from({ length: 24 }, (_, i) => `synergy${i}`);
const { words } = wordsFrom("?" + new URLSearchParams({ words: WORDS.join(",") }));
const wall = globalThis.BUZZ_BRICK_WALL.build(words, () => 0.5);

let rounds = 0;

// One round of the real game, drawn by the loop itself. `standing` is the wall
// as it is at this moment and `ball` where the ball is, so every frame below is
// a position the round could really have been in. The pieces handed over are
// copies: the round busts what it is given, and the wall of the round is spent
// after one frame if it is the same object every time.
async function aFrame({ standing = wall, ball = FALLING } = {}) {
  const { ctx, calls } = recordingContext();
  const canvas = {
    id: "brick-canvas", width: W, height: H, style: styleAttribute(),
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
    addEventListener() {},
  };
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id, textContent: "", disabled: false, style: styleAttribute(), children: [],
        addEventListener() {}, replaceChildren(...kids) { this.children = kids; },
        closest() { return null; },
      });
    }
    return elements.get(id);
  };
  // The face the canvas paints with arrives a moment after the page, and the
  // round begins when it does — the page's own start, not one invented here.
  // The coin the round flips when it puts a lost ball back is held here too: the
  // loop sends that ball left or right by Math.random (game.js:95), so a frame
  // that reads the direction a lost ball comes back with would read the flip as
  // well. Held below the loop's half, it always sends the ball to the left, at
  // -145, so the direction read below means the round's speed and not this file's
  // luck. Every other call to Math.random is left alone: brick-wall.js is handed
  // its own seed, so nothing else in a round rolls.
  let fontLoaded;
  const flip = globalThis.Math.random;
  globalThis.Math.random = () => 0;
  globalThis.document = {
    getElementById: (id) => (id === canvas.id ? canvas : element(id)),
    createElement: () => element("created"),
    addEventListener() {},
    fonts: { load: () => new Promise((done) => { fontLoaded = done; }) },
    documentElement: {},
    hidden: false,
  };
  // prefers-reduced-motion on, so a busted piece leaves no debris to be read
  // for the ball. The theme and the wall hang off the window, as they do on a
  // page.
  const calm = { matches: true };
  globalThis.window = {
    matchMedia: () => calm,
    BUZZ_THEME: { token: (name) => "--" + name },
    BUZZ_BRICK_WALL: globalThis.BUZZ_BRICK_WALL,
  };
  // The page's loop asks for its frames here. The test answers exactly one of
  // those requests, and forgets the rest: an answered request from before the
  // round was put where the test put it would step the round again, and would
  // draw a picture over the one the test is about to read.
  const frames = [];
  globalThis.requestAnimationFrame = (again) => { frames.push(again); };
  globalThis.location = { search: "?" + new URLSearchParams({ words: WORDS.join(",") }) };

  // Each round is its own copy of the module, since a round is taken when the
  // page loads. The clock is the test's, and it runs on by an hour before the
  // round is begun: the round the page is drawn from is then a round that has
  // been played a while, and not one that ends on the frame being looked at.
  const clock = { now: HOUR };
  const perf = globalThis.performance;
  globalThis.performance = { now: () => clock.now };
  await import(`../src/game.js?round=${rounds++}`);
  // game.js hands the loop's state and the canvas it is painted on out under
  // one name, for this file and for nothing on the page. The round takes it
  // once, as the page loads it, and the name is dropped then: read a second
  // time it would hand back some later round's canvas, and the assertions below
  // are worth nothing unless the pixels they read are the ones this very round
  // was painted with. Taking it also proves the loop still hands it over — a
  // drawing half that stopped sharing would leave this file asserting against
  // nothing.
  const drawn = globalThis.__buzzDraw;
  delete globalThis.__buzzDraw;
  assert.ok(drawn, "the loop tells the drawing test what it drew with");
  assert.equal(drawn.canvas, canvas, "the round was drawn on this round's canvas");
  const { game } = drawn;
  try {
    fontLoaded();
    // The round begins, and the loop's first frame with it, in the callback the
    // font's promise settles. Then the wall and the ball are set as this round
    // has them, and one frame more is drawn: the frame this test reads.
    await new Promise((done) => setImmediate(done));
    // The loop's own callback, and only it: every other request the loop has
    // made is dropped before it is answered, since answering one would step the
    // round again and paint over the picture about to be read.
    const [again] = frames.splice(frames.length - 1, 1);
    frames.length = 0;
    if (!again) throw new Error("the loop never asked for a frame to draw");
    game.bricks = standing.map((b) => ({ ...b, alive: true }));
    Object.assign(game, RUNNING, ball);
    calm.matches = true; // no debris, as above
    calls.length = 0;
    // The clock moves on by one tick, and by no more than a tick of the loop,
    // which is the largest step the loop ever takes.
    clock.now += TICK * 1000;
    again(clock.now);
    // The loop asks for its next frame from inside the one just answered. Nothing
    // here runs an animation, so that request is dropped as well: left standing,
    // it would be taken up after this file handed the round back, and would step
    // the round a second time — quietly, after the assertions had been read. The
    // request is answered through a microtask, so the drop is done after one has
    // run, and the round is left with nothing owed to it.
    await new Promise((done) => setImmediate(done));
    frames.length = 0;
  } finally {
    globalThis.performance = perf;
    globalThis.Math.random = flip;
  }
  return { calls, canvas, game, drawn };
}

// How the canvas of a frame was told to copy its pixels, in the order a browser
// reads them: the inline style first — an inline rule beats an author rule on
// the same element, specificity 1-0-0-0 per MDN, which is exactly how the
// page's intent could be silently undone — and then the rule for this very
// canvas in game.css. Nothing here is a browser, so both are read back off the
// element that was actually painted rather than taken on trust.
function pixelRule(canvas) {
  const inline = Object.entries(canvas.style)
    .filter(([name]) => /^image[-_]rendering$/i.test(String(name)))
    .map(([, value]) => value);
  assert.ok(inline.length <= 1, "the canvas carries at most one inline scaling rule");
  const rule = cssRules.match(/\.cabinet\s+canvas\s*\{[^}]*\}/);
  assert.ok(rule, ".cabinet canvas is still styled");
  const fromCsses = [...rule[0].matchAll(/image-rendering\s*:\s*([^;]+)\s*;/g)].map((m) => m[1].trim());
  assert.ok(fromCsses.length <= 1, "the page gives this canvas at most one scaling rule");
  return { inline: inline[0], fromCss: fromCsses[0], fromCsses, rule: rule[0] };
}

// The ball of a frame: everything painted in the ball's colour of the theme.
// Tying the assertions to the colour is what ties them to the ball alone.
function ballCalls(calls) {
  const ball = calls.filter((c) => c.fillStyle === "--game-ball");
  assert.ok(ball.length > 0, "the ball is painted, in the theme's ball colour");
  return ball;
}

const shown = (value) => Math.round(value * 1000) / 1000;

// The call that makes the ball its round shape: the ball is painted in one
// colour, and of those calls the arc is the one that gives it the shape.
const where = (calls) => {
  const [ball] = ballCalls(calls).filter((c) => c.name === "arc");
  assert.ok(ball, "the ball is drawn by a path, not filled as a block");
  return ball;
};
const shapes = (calls, name) => calls.filter((c) => c.name === name);
const inColour = (calls, name, colour) => shapes(calls, name).filter((c) => c.fillStyle === `--${colour}`);
// The paddle is drawn in its colour, or in the flash of a catch — the same
// rectangle either way, a moment apart.
const paddleRects = (calls) => shapes(calls, "fillRect")
  .filter((c) => c.fillStyle === "--game-paddle" || c.fillStyle === "--game-flash");

test("the ball is drawn as a round path, and only the ball is", async () => {
  const { calls } = await aFrame();
  const ball = where(calls);
  assert.equal(ball.name, "arc", `the ball is drawn by ${ball.name}, not a rectangle`);
  assert.ok(Number.isFinite(ball.args[3]) && Number.isFinite(ball.args[4]),
    "an arc is given its own angles, so its path closes on itself");
  // Nothing else on the canvas gave up its square corners — not the paddle,
  // not a shadow, not a cell, not the floor, not the label.
  assert.equal(shapes(calls, "arc").length, 1, "one round path in a frame");
  assert.equal(shapes(calls, "roundRect").length, 0,
    "a rounded rectangle on an 8 px square is not a circle: its middle edges stay flat");
  assert.equal(shapes(calls, "ellipse").length, 0);
});

test("the round path is the 8 px ball the square was, in the ball's colour", async () => {
  const { calls } = await aFrame();
  const ball = where(calls);
  // The same 8 px footprint the square filled: radius 4, no bigger, no less.
  assert.equal(shown(ball.args[2]), EXTENT, "radius 4 keeps the ball the size it was");
  // The colour is the theme's, as every colour on the canvas is; the theme
  // file is untouched, so it is still --game-ball and nothing new beside it.
  assert.equal(ball.fillStyle, "--game-ball", "the theme's ball colour still paints the ball");
  assert.doesNotMatch(gameSource.replace(/\/\/.*$/gm, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/,
    "the ball brings no colour of its own to the canvas");
});

test("the ball still moves at the speed it always had", async () => {
  const { calls, game } = await aFrame();
  const ball = where(calls);
  // One tick from where the round leaves the ball: 145 px/s across, 175 up. The
  // picture is drawn at whole pixels, as everything on this canvas is, so the
  // centre shown is the centre the game has, to the pixel.
  assert.equal(shown(ball.args[0]), Math.round(START.x + START.vx * TICK), "vx is still 145 px/s");
  assert.equal(shown(ball.args[1]), Math.round(START.y + START.vy * TICK), "vy is still -175 px/s");
  assert.equal(shown(game.x), shown(START.x + START.vx * TICK), "and the round itself moved 5.8 px across");
});

test("the round starts and restarts its ball at the speed it always had", () => {
  // The speed is written into the loop three times: the state the round is born
  // with, the reset that begins one, and the respawn that replaces a lost ball.
  // The frames above read each of those speeds in motion; this reads the two
  // literals beside them, so a speed changed at one of them and left at the other
  // cannot answer for it. The third is read where a lost ball is put back.
  const born = gameCode.match(/const game = \{[^}]*vx: (-?\d+), vy: (-?\d+)[^}]*\}/);
  assert.ok(born, "the round is born with a ball of a stated speed");
  assert.equal(Number(born[1]), 145, "across at 145 px/s as it has always been");
  assert.equal(Number(born[2]), -175, "and up at 175 px/s");
  const reset = gameCode.match(/function resetGame\(\) \{[\s\S]*?Object\.assign\(game, \{([^}]*)\}\)/);
  assert.ok(reset, "a new round resets the ball to a stated speed");
  assert.match(reset[1], /vx: 145, vy: -175/, "at the same speed the round is born with");
  assert.doesNotMatch(reset[1], /vx: (?!145)-?\d+|vy: (?!-175)-?\d+/,
    "and nothing else, which is what lets the two be read as one speed");
});

test("a ball sent up at a piece turns back, and keeps its speed", async () => {
  // A cell of the wall the round really hangs, directly above the ball, and
  // the ball sent up at it from one ball-box and one tick below its underside.
  // The piece goes, the ball turns, and its centre stops one ball-box below
  // the cell: the box that turned it is 4 px about the centre, the same 4 px it
  // is drawn with. Were that box smaller the ball would still be climbing; were
  // it larger it would have turned below where it is put here. The speed it
  // comes back with is the speed it went in with — only the direction changes.
  const lowest = wall.reduce((low, b) => {
    const bottom = Math.max(...b.rects.map((r) => r.y + r.h));
    return !low || bottom > low.bottom ? { bottom, piece: b } : low;
  }, null);
  const cell = lowest.piece.rects.reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a));
  const start = cell.y + cell.h + EXTENT + 175 * TICK;
  const { calls, game } = await aFrame({ standing: [lowest.piece], ball: { x: cell.x + cell.w / 2, y: start, vx: 0, vy: -175 } });
  assert.equal(shown(game.y - (cell.y + cell.h)), EXTENT,
    "the ball stopped one ball-box below the underside, its box flush against the cell");
  assert.ok(start - game.y > 0, "which is below where it was sent up from");
  assert.equal(shown(game.vy), -175, "and it is still coming back down at 175 px/s, in the direction it turned to");
  // The ball is drawn as the disc, at the place the round has it: 4 px clear of
  // the cell's underside, which is where the box that hit it puts its centre.
  const ball = where(calls);
  assert.equal(shown(ball.args[1]), shown(game.y), "and the ball is drawn where the round has it");
  assert.equal(shown(ball.args[1] - (cell.y + cell.h)), EXTENT, "at the reach of its own 4 px");
});

test("the ball is drawn as a disc where the wall has gone", async () => {
  // The only thing left to paint in a frame of a cleared round is the ball, so
  // this frame is the ball and nothing else: the round is over (the wall is
  // gone, which is the round's own end) and the label box and its letters are
  // drawn behind the ball, in the colours of the ground and the paddle. What
  // remains in the ball's colour is the disc, and no square of eight.
  const { calls } = await aFrame({ standing: [], ball: { ...FALLING, x: 40, y: 200 } });
  assert.equal(shapes(calls, "arc").length, 1, "one round path, and it is the ball");
  assert.equal(shapes(calls, "roundRect").length, 0);
  const ball = ballCalls(calls);
  assert.equal(ball.length, 3, "beginPath, the arc and the fill, and nothing else in the ball's colour");
  assert.deepEqual(ball.map((c) => c.name), ["beginPath", "arc", "fill"]);
  assert.equal(where(calls).name, "arc");
});

test("the ball still turns back off the side of a piece, and off the walls", async () => {
  // Off the side of a cell: the ball runs at it from the clear air on its left and
  // is turned back. Only that one piece of the wall stands, so the cell it meets
  // is the one named here. The turn is read in both directions, because the rule
  // that chooses it (the shallower of the two overlaps at game.js:80) decides which
  // axis flips: a frame that only saw the ball stop where its box is flush would
  // also pass with the wrong axis flipped and the ball still running into the cell,
  // since one tick of 145 px/s is well inside the 4 px of that flush.
  const side = wall.find((b) => b.rects.some((r) => r.x === globalThis.BUZZ_BRICK_WALL.LEFT));
  const cell = side.rects.reduce((a, b) => (b.y > a.y ? b : a));
  const from = cell.x + cell.w - EXTENT - 145 * TICK; // a tick short of flush with the cell's right edge
  const sideways = await aFrame({
    standing: [side],
    ball: { x: from, y: cell.y + cell.h / 2, vx: 145, vy: 0 },
  });
  assert.equal(shown(sideways.game.x - (cell.x + cell.w - EXTENT)), 0,
    "the ball stopped with its box flush against the side of the cell");
  assert.ok(sideways.game.x > from, "and it ran to the cell before turning");
  assert.ok(sideways.game.vx < 0, "and it turned back the way it came, sideways and not up");
  assert.equal(shown(Math.abs(sideways.game.vy)), 0, "leaving its sideways speed still at nothing");

  // Off the walls, which are not pieces at all and are unchanged by the ball's
  // shape: the ball is put past a wall, and the frame puts it back at it. Each is
  // put there still travelling into the wall, since a wall both stops the ball at
  // itself and turns it out of the wall, and a frame drawn with the ball already
  // travelling outward would pass on the stop alone. Each is also put well clear of
  // the floor, so the frame shows a wall turning a ball and nothing else.
  const left = await aFrame({ standing: [], ball: { ...FALLING, x: 2, y: 100, vx: -START.vx } });
  assert.equal(shown(where(left.calls).args[0]), 8, "the left wall is 8 px in, as it was");
  assert.ok(left.game.vx > 0, "and turns the ball back into the field from the left");
  const right = await aFrame({ standing: [], ball: { ...FALLING, x: W - 2, y: 100, vx: START.vx } });
  assert.equal(shown(where(right.calls).args[0]), W - 8, "the right wall is 8 px from the edge");
  assert.ok(right.game.vx < 0, "and from the right");
  const top = await aFrame({ standing: [], ball: { ...FALLING, x: 240, y: 2, vy: START.vy } });
  assert.equal(shown(where(top.calls).args[1]), 8, "the top of the canvas is 8 px down");
  assert.ok(top.game.vy > 0, "and turns the ball back down into the field");
});

test("the paddle is still a square, still has its shadow, and still catches", async () => {
  const { calls } = await aFrame();
  const paddle = paddleRects(calls);
  assert.equal(paddle.length, 1, "the paddle is one rectangle, not a rounded one");
  assert.deepEqual(paddle[0].args.slice(2), [PADDLE.w, PADDLE.h], "the paddle keeps its size");
  assert.equal(paddle[0].args[1], PADDLE.y, "the paddle keeps its place");
  assert.ok(shapes(calls, "fillRect").some((c) => c.fillStyle === "--game-shadow"
    && c.args[1] === PADDLE.y + 4 && c.args[2] === PADDLE.w && c.args[3] === PADDLE.h),
    "the paddle still has its hard shadow: offset 4, blurred by nothing");
  // The catch is a band the ball is measured against, not a shape it shares:
  // nothing round is drawn where the paddle is.
  assert.ok(shapes(calls, "arc").every((c) => c.args[1] < PADDLE.y - EXTENT), "the paddle is no round path");
});

test("a ball that comes down on the paddle goes back up, thrown by where it hit", async () => {
  // The paddle is where the round starts with it, in the middle of the floor,
  // and the ball comes down onto the left of it. The catch is the rule at
  // game.js:63-67: the ball is set to the top of the paddle, turned around,
  // and thrown by the side it met. The box that meets the paddle is 4 px about
  // the centre — the same 4 px the ball is drawn with, so the round catches
  // what the player sees. None of it is about the ball's shape.
  const { calls, game } = await aFrame({ standing: [], ball: { x: W / 2 - 18, y: PADDLE.y - EXTENT, vx: 0, vy: 175 } });
  assert.equal(shown(game.y), PADDLE.y, "the catch set the ball to the top of the paddle");
  assert.equal(shown(game.vy), -175, "and turned it around, at the speed it came down with");
  assert.ok(game.vx < 0, "and threw it to the side of the paddle it hit");
  // The picture of it: the ball is painted where the catch puts it, at the top
  // of the paddle and no further down than the paddle's own rectangle.
  const ball = where(calls);
  assert.equal(shown(ball.args[1]), shown(game.y), "the ball is drawn where the round has it");
  assert.ok(ball.args[1] <= PADDLE.y + PADDLE.h, "and no lower than the paddle it was caught on");
});

test("a ball lost off the bottom comes back with the speed it always had", async () => {
  // A ball lost off the bottom, with one more in hand. Two things have to be true
  // for the round to lose one in a single frame, since the loop steps the ball
  // before it looks for a lost one: the ball must end the step below the floor, and
  // it must end it beyond the paddle's reach — 40 px either side of the paddle's
  // centre — or the paddle catches it on the way and the round never loses it.
  // Hence x 400 with the paddle at the middle of the field, and 900 px/s down: at
  // 175 the step only reaches 251, which is neither below the floor nor clear of
  // the paddle.
  //
  // One more ball is held because the round ends itself on the last one it loses
  // (game.js:94) and never puts that one back: a frame with a single ball in hand
  // shows the round over and the ball left where it fell, which is the round's
  // doing but not the thing this frame is here to read.
  //
  // The lost ball then comes back where a round starts one, at the paddle 32 px
  // above the floor, up at 175 px/s and across at 145. That speed is read nowhere
  // else: only a lost ball is put back, and a round that never lost one keeps the
  // ball it had. The direction across is the loop's own coin (game.js:95), held by
  // the rig; the speed, the place and the fact that it was put back at all are not.
  const { calls, game } = await aFrame({ standing: [], ball: { x: 400, y: H + 2, vx: 0, vy: 900, lives: 2 } });
  assert.equal(shown(game.lives), 1, "the round lost a ball, which is the only thing that puts one back");
  assert.equal(shown(game.y), H - 40, "the ball was lost and put back where a round starts one");
  assert.equal(shown(game.x), W / 2, "at the paddle it starts a round on, and not where it was lost");
  assert.equal(shown(game.vy), -175, "the ball comes back up at the speed it always had");
  assert.equal(shown(game.vx), -145, "and across at the speed it always had, to the side the loop's coin held");
  assert.equal(where(calls).name, "arc", "and it is drawn as the same disc");
  assert.equal(shown(where(calls).args[2]), EXTENT, "of the same radius");
});

test("the wall, its shadows, its letters and the floor are all still rectangles", async () => {
  // The whole wall of the round, drawn by the loop: cells, their hard shadows,
  // the letters of them, and the floor. None of it is a path, and the ball is
  // the only round thing in the frame.
  const { calls } = await aFrame({ standing: wall, ball: { ...FALLING, x: 20, y: 210 } });
  const cells = ["piece-1", "piece-2", "piece-3", "piece-4"].flatMap((c) => inColour(calls, "fillRect", c));
  assert.equal(cells.length, wall.length * 4, "every cell of every piece of the wall, as a rectangle");
  for (const cell of cells) assert.deepEqual(cell.args.slice(2), [wall[0].rects[0].w, wall[0].rects[0].h],
    "a cell is still a square cell");
  // Every cell's hard shadow, drawn before the cells so no part of a piece lies
  // in the shade of the piece in front of it, and then the paddle's own.
  const shadowed = shapes(calls, "fillRect").filter((c) => c.fillStyle === "--game-shadow");
  assert.equal(shadowed.length, wall.length * 4 + 1, "every cell has its hard shadow, plus the paddle's");
  const letters = inColour(calls, "fillText", "piece-text");
  assert.equal(letters.length, wall.reduce((n, b) => n + b.letters.filter(Boolean).length, 0),
    "one letter in each cell that carries one, as text and not as a shape");
  assert.ok(shapes(calls, "fillRect").some((c) => c.fillStyle === "--game-floor"
    && c.args[1] === H - 16 && c.args[2] === W && c.args[3] === 16), "the floor is a rectangle");
  assert.equal(shapes(calls, "arc").length, 1, "and the ball is the frame's only round path");
});

test("the page scales the buffer smoothly, so the ball's edge survives it", async () => {
  // The 480 by 272 buffer is shown bigger than it is drawn — about twice the
  // width on a desktop, more on a wide one. Nearest neighbour copies every
  // source pixel as a hard block, which leaves a drawn circle just as stepped
  // as the square ever was; smoothing lets the browser blend across the edge,
  // which is what makes it read as round (MDN: `smooth` is the keyword that
  // accepts bilinear interpolation). So the page asks for smoothing on the
  // canvas it scales, and asks for it once: an inline rule on that same
  // element beats the stylesheet whatever its spelling, since inline styles
  // carry specificity 1-0-0-0 (MDN), and a whole-pixel keyword written there
  // would flatten the ball again while every rule in the file still looked
  // right. So this checks the value the canvas actually ends up with, and that
  // nothing on the element competes with the page's ask.
  const { canvas, drawn } = await aFrame();
  assert.equal(drawn.canvas, canvas, "the loop hands over the canvas it painted");
  const rule = pixelRule(canvas);
  assert.equal(rule.fromCss, "smooth", "the page scales the canvas smoothly");
  assert.deepEqual(rule.fromCsses, ["smooth"], "the canvas is asked to be scaled smoothly, and only once");
  assert.equal(rule.inline, undefined,
    "nothing inline overrides it, which is what flattened the ball");
  // The ball still has its size to be seen at: the cabinet scales the whole
  // buffer up, and the ball is the whole of it at 8 px across.
  assert.match(rule.rule, /width:\s*calc\(100% - 8px\)/, "the buffer is still scaled to the cabinet's width");
  assert.match(rule.rule, /aspect-ratio:\s*480 \/ 272/, "at the shape the buffer is drawn at");
});

test("the loop writes no rule of its own onto the canvas it paints", async () => {
  // The whole-pixel rule the ball is up against lived here once, set on the
  // canvas from game.js, and it is exactly what beat the page's smoothing and
  // re-hardened the disc. So the drawing half of the game keeps its hands off
  // the scaling of the buffer: the page asks once, in game.css, and this file
  // writes no image-rendering of any spelling onto the element — neither the
  // property nor setProperty, since both end up as an inline rule and both
  // would win the cascade. The 16 px letters stay crisp for a different reason:
  // they are painted whole into the buffer, at the buffer's own scale, and
  // nothing softens them on the way out any more than it softens the ball.
  const { canvas } = await aFrame();
  assert.deepEqual(pixelRule(canvas).inline, undefined,
    "the canvas carries no inline scaling rule when a frame has been drawn");
  assert.doesNotMatch(gameCode, /canvas\.style\b|image[-_]rendering|setProperty/,
    "the loop never names the scaling property at all, in either spelling");
  // The disc is still drawn, so the absence above is not the absence of the
  // ball: the fix is a shape and a scaling rule, in the two files that own
  // those two things.
  assert.equal(shapes((await aFrame()).calls, "arc").length, 1,
    "and the ball is still drawn as a disc");
});
