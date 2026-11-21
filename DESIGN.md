# Design

A 16-bit arcade cabinet standing on a grass field: square corners, flat fills,
hard shadows and one bitmap typeface. The look is the pixel theme of
[tehas](https://github.com/tehas-app/tehas), which the game was taken from.

## Type

One typeface, Topaz, at two sizes: 32 px for the title and the readout, 16 px
for everything else. Courier New and the system monospace stand in until it
loads. The canvas waits for it before its first round.

## Colour

Every colour is a token of `src/theme-pixel.css`, written in twelve bits
(`#RGB`): muted and metallic, like a game of the early nineties. The canvas
cannot read `var()`, so `src/theme.js` reads the tokens it paints with
(`--piece-*`, `--game-*`) once and keeps them.

| Token | Use |
| --- | --- |
| `--field`, `--field-pattern` | The grass the page stands on |
| `--surface`, `--surface-quiet`, `--surface-head` | Panels, the panel's ground, its head |
| `--accent`, `--accent-soft` | The play button, at rest and pointed at |
| `--screen` | The cabinet around the canvas |
| `--piece-1` to `--piece-4` | The colours of the words on the wall |
| `--game-*` | The canvas: ground, floor, shadows, ball, paddle |

## Depth and movement

Shadows are hard offsets with no blur. A button lifts 4 px toward the pointer
and is pressed 4 px onto its shadow. With `prefers-reduced-motion`, a busted
piece leaves no debris.

## The cabinet

A full-width panel on a Bone Shade ground with a Steel head. Inside it a CRT
Black cabinet: the 480 by 272 canvas scaled to fill the width, beside a bone
panel with the readout and one play button. On a narrow screen the bone panel
goes below the canvas.

## The wall

The wall is a grid of 28 by 28 pixel cells, sixteen columns by six rows, one
letter in each. A word is written on tetrominoes: one of the seven pieces for
its first four letters, another for the next four, a third for nine or ten. The
pieces of a word touch one another and share a colour; pieces of words that
touch differ in colour. With words enough for the wall a round picks the ones
whose pieces fill it exactly, so it is a packed rectangle with no holes, hanging
from the top of the canvas, and never bigger than those twenty-four pieces
however many words there are; with a small pool every word goes on the wall and
its lower edge may be uneven. A hit takes the one piece it touched, and a word
is busted, and scores, when its last piece goes.

## Do's and don'ts

- **Do** keep corners square and shadows hard.
- **Do** keep sizes and positions on the 8 px grid, and draw sprites at whole
  multiples of their size.
- **Do** take any new colour in the same muted twelve-bit spirit, as a token.
- **Don't** add gradients, soft shadows, rounded corners or smooth shading.
- **Don't** add a second typeface.
