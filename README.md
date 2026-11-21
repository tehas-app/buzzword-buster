# Buzzword Buster

A 45 second breakout game. The bricks are buzzwords, each written letter by
letter on tetrominoes, and a word is busted when its last piece goes.

    node scripts/serve.mjs        # then open http://127.0.0.1:8080/

Arrow keys or a pointer steer the paddle; P pauses. Bring your own words with
the address: `/?words=synergy,pivot,leverage`.

No build step and no dependencies: Node 22 is needed only for the tests and
the development server.

## Why this repository exists

Buzzword Buster started as the breakroom game of
[tehas](https://github.com/tehas-app/tehas), the lean software factory, where
its bricks were the commonest words in the factory's ticket titles. Here it
stands alone, as a product tehas can work on. It shows the factory on work
that is not a form over a database: game rules, a packing algorithm,
rendering, input and feel. The repository carries the contract a tehas
instance reads:

| File | For tehas |
| --- | --- |
| `AGENTS.md` | The rules agents work under |
| `.pi/verify-cmd` | The fast gate: `node --test test/*_test.mjs` |
| `.pi/verify-cmd-full` | The tests and the smoke test |
| `.pi/smoke-cmd` | The page is served with every file it names |
| `preview/Dockerfile` | A playable preview of every pull request |

`docs/demo-issues.md` has issues to file for a demonstration.

## Tests

    node --test test/*_test.mjs
    node scripts/smoke.mjs

The wall's tests run 300 seeded rounds each, so a failure names its round.

## Licence

Apache-2.0, see `LICENSE`. The Topaz Plus a1200 typeface in `fonts/` is
third-party work under its own terms; see `NOTICE`.
