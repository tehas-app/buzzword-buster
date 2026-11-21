# Issues for a demonstration

Ready-to-file issues that show tehas on game work: rules, feel, rendering and
input, not forms and tables. Each one is small enough for one cycle and says
how to know it is done. File them as they are, then label one `tehas:ready`.

## Speed up as the wall clears

The ball keeps one speed all round, so the last bricks are as easy as the
first. Make it faster as pieces go: from its starting speed to 1.5 times that
when the wall is empty, rising evenly with each piece busted.

- Put the rule in a pure function with a test (pieces left, pieces at the
  start → speed factor), not inline in `game.js`.
- The paddle's bounce angle does not change.

## A best score kept in this browser

Show BEST beside SCORE in the readout: the highest score of any round played
in this browser. Keep it in `localStorage`; where storage is unavailable the
game still plays and BEST shows the best of this page's rounds.

- A test covers reading a missing, malformed or negative stored value.

## Touch: tap the canvas to launch, drag to steer

On a phone the paddle can be dragged, but a tap that starts a round also
moves the paddle under the finger. Make the first tap only start the round,
and let a drag anywhere on the canvas steer, not only on the paddle.

- Keyboard and mouse behave as before.

## Combo for a word busted with one ball

When every piece of a word is busted without the ball touching the paddle in
between, score it 20 and not 10, and say `COMBO` in the word line.

- Pure scoring rule with tests; `game.js` only reports the events.

## Sound effects, off by default

A short square-wave blip for the paddle, a lower one for a piece, a chord for
a busted word, made with the Web Audio API (no sound files). A SOUND ON/OFF
button beside PLAY; off until the player turns it on.

- No file from outside the repository.

## Levels: a second wall after a cleared one

Clearing the wall before the time runs out starts a new wall with the time
left plus 15 seconds, and the ball 10 % faster. The readout shows LEVEL.

- The round still ends on time or on the last ball.

## A wall of the words of a GitHub repository

`?repo=owner/name` builds the wall from the commonest words in that public
repository's open issue titles, fetched from the GitHub API in the browser,
falling back to the built-in words if the fetch fails or is rate limited.

- Counting and cleaning the words is pure and tested with recorded titles; no
  test reaches the network.
