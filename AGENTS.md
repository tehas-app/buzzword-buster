# AGENTS.md

Rules for agents working in this repository. `README.md` says what the game
is; `DESIGN.md` says how it looks and why.

## What this is

Buzzword Buster is a small browser game: a 45 second breakout whose bricks are
buzzwords written on tetrominoes. It is plain HTML, CSS and JavaScript with no
build step and no dependencies, served as static files.

| Path | What it is |
| --- | --- |
| `index.html` | The one page. Loads the theme, the stylesheet and the scripts in that order |
| `src/brick-wall.js` | The wall of a round: which words, which tetrominoes, where. Pure, no DOM |
| `src/words.js` | Where a round's words come from and how they are cleaned. Pure, no DOM |
| `src/game.js` | The loop, the input and the drawing. The only part that needs a browser |
| `src/theme-pixel.css` | Every colour, typeface and shadow, as tokens |
| `src/theme.js` | Reads the tokens the canvas paints with |
| `src/game.css` | Layout of the page around the cabinet |
| `fonts/` | The Topaz Plus typeface. Third-party: see `NOTICE` |
| `test/` | `node --test` tests, one file per module |
| `scripts/serve.mjs` | A static server for development and the smoke test |
| `scripts/smoke.mjs` | Serves the page and checks every file it names answers |
| `preview/` | The image a pull request preview is built from |

## How to verify

    node --test test/*_test.mjs      # the gate (.pi/verify-cmd)
    node scripts/smoke.mjs           # the page is served whole (.pi/smoke-cmd)
    node scripts/serve.mjs           # play it at http://127.0.0.1:8080/

Node 22 or later. There is nothing to install.

## Rules

1. **No build step and no dependencies.** The page runs as the files are.
   No bundler, no framework, no package from npm, no file from a CDN. If a
   change seems to need one, say so in the pull request and do without it.
2. **Keep the logic pure and tested.** A decision the game makes (which words,
   where a piece goes, how a score is counted, when a round ends) belongs in a
   module with no DOM that `node --test` can run, as `brick-wall.js` and
   `words.js` are. `game.js` reads input, steps the loop and draws; when it
   grows a rule worth testing, move the rule out and test it.
3. **Tests check behaviour, not source text.** Seed the randomness (see
   `seeded()` in `test/brick_wall_test.mjs`) so a failure names the round
   that broke. Do not weaken a test to make a change pass.
4. **One theme file.** Only `src/theme-pixel.css` names a colour, a typeface
   or a shadow. The canvas paints with tokens through `BUZZ_THEME.token()`.
   `test/theme_test.mjs` enforces this. Every colour is twelve bits (`#RGB`).
5. **Pixel rules.** Square corners, hard shadows with no blur, sizes on the
   8 px grid, text at 16 px and 32 px only. `DESIGN.md` has the rest.
6. **Text from the address is untrusted.** Words from `?words=` reach the page
   only through `textContent` or `fillText`, never as HTML.
7. **Accessible input.** Everything playable with a pointer is playable with
   the keyboard, and the reverse. Respect `prefers-reduced-motion`.
8. **Keep the credit.** The Topaz credit in the footer and `NOTICE` stay.

## Commits and pull requests

- One change per pull request, with a test for what it changes where the
  change is testable.
- Commit messages in the imperative: `Add a speed-up as the wall clears`.
- Say in the pull request how it was played to check it, not only tested.
