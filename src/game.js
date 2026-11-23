// Buzzword Buster: the loop, the input and the drawing. The wall a round is
// played on comes from brick-wall.js and the words from words.js; both are pure
// and tested in node. This file is the part that needs a browser.
import { wordsFrom } from "./words.js";

const $ = (id) => document.getElementById(id);
const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
const { words, source } = wordsFrom(location.search);

const ROUND_SECONDS = 45;
const BALLS = 3;

const canvas = $("brick-canvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const game = { mode: "ready", score: 0, lives: BALLS, time: ROUND_SECONDS, paddleX: W / 2, paddleW: 72, x: W / 2, y: H - 40, vx: 145, vy: -175, bricks: [] };
// The best of this page's rounds, kept here beside what localStorage holds: where
// storage is unavailable the game still plays and BEST still shows this.
const played = { best: 0 };
let last = performance.now(), leftHeld = false, rightHeld = false;
let debris = [], paddleFlash = 0;

function gameUi(message) {
  $("brick-score").textContent = String(game.score).padStart(3, "0");
  $("brick-best").textContent = String(bestNow()).padStart(3, "0");
  $("brick-time").textContent = String(Math.ceil(game.time)).padStart(2, "0");
  $("brick-lives").textContent = game.lives;
  const play = $("brick-play");
  play.disabled = !words.length;
  play.textContent = game.mode === "playing" ? "PAUSE" : game.mode === "paused" ? "RESUME" : game.mode === "over" ? "PLAY AGAIN" : "PLAY";
  if (message) $("brick-message").textContent = message;
}

function resetGame() {
  Object.assign(game, { mode: "ready", score: 0, lives: BALLS, time: ROUND_SECONDS, paddleX: W / 2, x: W / 2, y: H - 40, vx: 145, vy: -175 });
  // A new wall every round: other words, other tetrominoes, other places, and
  // never more pieces than the wall has room for (brick-wall.js).
  game.bricks = window.BUZZ_BRICK_WALL.build(words).map((piece) => ({ ...piece, alive: true }));
  $("brick-word").textContent = "NO WORD BUSTED YET";
  gameUi(`${ROUND_SECONDS} seconds, ${BALLS} balls.`);
}

// The best of any round played in this browser: what localStorage holds and the
// best of this page's own rounds, whichever is higher (best-score.js).
const bestNow = () => BUZZ_BEST.bestOf(BUZZ_BEST.readBest(storage()), played.best);

// The one place a round ends, so the one place a score becomes a best. A new
// round keeps it: resetGame() has no part in it.
function endGame(message) { game.mode = "over"; recordBest(); gameUi(`${message} Score ${game.score}.`); }

function recordBest() {
  const best = BUZZ_BEST.recordScore(storage(), game.score);
  // What the storage answered with is no best of its own: only the higher of it
  // and this round counts, so a box that cannot be read cannot lower what is shown.
  played.best = BUZZ_BEST.bestOf(played.best, game.score, best);
}

// Where storage is unavailable (no localStorage, or a browser that answers with
// an error for it), it is absent: the best of this page's rounds is what is left.
function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function toggleGame() {
  if (!words.length) return;
  if (game.mode === "playing") { game.mode = "paused"; gameUi("Paused."); return; }
  if (game.mode === "over") resetGame();
  game.mode = "playing";
  gameUi("Playing.");
}

function stepGame(dt) {
  game.time = Math.max(0, game.time - dt);
  if (game.time === 0) return endGame("Time is up.");
  const half = game.paddleW / 2;
  game.paddleX = Math.max(half + 8, Math.min(W - half - 8, game.paddleX + (Number(rightHeld) - Number(leftHeld)) * 270 * dt));
  game.x += game.vx * dt;
  game.y += game.vy * dt;
  if (game.x < 8) { game.x = 8; game.vx = Math.abs(game.vx); }
  if (game.x > W - 8) { game.x = W - 8; game.vx = -Math.abs(game.vx); }
  if (game.y < 8) { game.y = 8; game.vy = Math.abs(game.vy); }
  if (game.vy > 0 && game.y >= H - 32 && game.y <= H - 16 && Math.abs(game.x - game.paddleX) < half + 4) {
    game.y = H - 32;
    paddleFlash = 0.08;
    game.vy = -Math.abs(game.vy);
    game.vx = 165 * (game.x - game.paddleX) / half + Math.sign(game.vx) * 55;
  }
  for (const b of game.bricks) {
    // A piece is hit where one of its cells is, and that one piece goes.
    const hit = b.alive && b.rects.find((r) => game.x + 4 > r.x && game.x - 4 < r.x + r.w && game.y + 4 > r.y && game.y - 4 < r.y + r.h);
    if (!hit) continue;
    b.alive = false;
    if (!calm.matches) {
      for (let i = 0; i < 4; i++) {
        debris.push({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, vx: (i - 1.5) * 40, vy: -70 - (i % 3) * 30, life: 0.4, color: b.color });
      }
    }
    // The ball turns back the way it came in: off a side when it is less
    // deep in the cell sideways than up or down, as it is in a notch.
    const deepX = Math.min(game.x + 4 - hit.x, hit.x + hit.w - (game.x - 4));
    const deepY = Math.min(game.y + 4 - hit.y, hit.y + hit.h - (game.y - 4));
    if (deepX < deepY) game.vx *= -1; else game.vy *= -1;
    // The word scores when its last piece goes, not at the first one.
    if (game.bricks.every((o) => o.wordKey !== b.wordKey || !o.alive)) {
      game.score += 10;
      $("brick-word").textContent = `BUSTED: ${b.word.word.toUpperCase()} (${b.word.count}×)`;
    }
    break;
  }
  if (game.y > H + 8) {
    game.lives--;
    if (game.lives <= 0) return endGame("Out of balls.");
    Object.assign(game, { x: game.paddleX, y: H - 40, vx: (Math.random() < 0.5 ? -1 : 1) * 145, vy: -175 });
  }
  if (game.bricks.every((b) => !b.alive)) return endGame("Wall cleared.");
  gameUi();
}

function drawGame() {
  const paint = window.BUZZ_THEME.token;
  ctx.fillStyle = paint("game-ground");
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = paint("game-floor");
  ctx.fillRect(0, H - 16, W, 16);
  ctx.font = "16px " + paint("font-code");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of game.bricks) {
    if (!b.alive) continue;
    // Every shadow first, so no part of a piece lies in its own shade.
    ctx.fillStyle = paint("game-shadow");
    for (const r of b.rects) ctx.fillRect(r.x + 4, r.y + 4, r.w, r.h);
    ctx.fillStyle = paint(b.color);
    for (const r of b.rects) ctx.fillRect(r.x, r.y, r.w, r.h);
    // One letter in each cell it has one. The gap between the cells is drawn
    // inside a word too, so its pieces can still be told apart.
    ctx.fillStyle = paint("piece-text");
    for (const [i, letter] of b.letters.entries()) {
      if (!letter) continue;
      const cell = b.rects[i];
      ctx.fillText(letter.toUpperCase(), cell.x + cell.w / 2, cell.y + cell.h / 2 + 1);
    }
  }
  const left = Math.round(game.paddleX - game.paddleW / 2);
  ctx.fillStyle = paint("game-shadow");
  ctx.fillRect(left + 4, H - 28, game.paddleW, 8);
  ctx.fillStyle = paint(paddleFlash > 0 ? "game-flash" : "game-paddle");
  ctx.fillRect(left, H - 32, game.paddleW, 8);
  for (const d of debris) {
    ctx.fillStyle = paint(d.color);
    ctx.fillRect(Math.round(d.x / 4) * 4, Math.round(d.y / 4) * 4, 4, 4);
  }
  ctx.fillStyle = paint("game-ball");
  ctx.fillRect(Math.round(game.x) - 4, Math.round(game.y) - 4, 8, 8);
  if (game.mode !== "playing") {
    const label = game.mode === "over" ? "ROUND OVER" : game.mode === "paused" ? "PAUSED" : "BUZZWORD BUSTER";
    ctx.fillStyle = paint("game-ground");
    ctx.fillRect(W / 2 - 136, H / 2 + 28, 272, 40);
    ctx.fillStyle = paint("game-paddle");
    ctx.fillText(label, W / 2, H / 2 + 49);
  }
}

function frame(now) {
  const dt = Math.min(0.04, (now - last) / 1000 || 0);
  last = now;
  if (game.mode === "playing") stepGame(dt);
  paddleFlash = Math.max(0, paddleFlash - dt);
  for (const d of debris) { d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 420 * dt; }
  debris = debris.filter((d) => d.life > 0);
  drawGame();
  requestAnimationFrame(frame);
}

const paddleTo = (event) => {
  const rect = canvas.getBoundingClientRect();
  const half = game.paddleW / 2;
  game.paddleX = Math.max(half + 8, Math.min(W - half - 8, (event.clientX - rect.left) * W / rect.width));
};
$("brick-play").addEventListener("click", toggleGame);
canvas.addEventListener("pointermove", paddleTo);
canvas.addEventListener("pointerdown", (event) => { paddleTo(event); if (game.mode !== "playing") toggleGame(); });
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, select, textarea")) return;
  if ((event.key === "p" || event.key === "P") && game.mode !== "ready" && game.mode !== "over") { toggleGame(); return; }
  if (game.mode !== "playing") return;
  if (event.key === "ArrowLeft") { leftHeld = true; event.preventDefault(); }
  if (event.key === "ArrowRight") { rightHeld = true; event.preventDefault(); }
});
document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") leftHeld = false;
  if (event.key === "ArrowRight") rightHeld = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.mode === "playing") { game.mode = "paused"; gameUi("Paused while the page was away."); }
});

if (source === "address") {
  $("brick-source").textContent = "Words from this page's address.";
} else {
  const example = document.createElement("code");
  example.textContent = "?words=a,b,c";
  $("brick-source").replaceChildren("The office classics. Add ", example, " to the address for your own.");
}
// The font is a bitmap face the canvas draws with: wait for it, or the first
// frames are drawn in the fallback.
document.fonts.load("16px Topaz").finally(() => { resetGame(); requestAnimationFrame(frame); });
