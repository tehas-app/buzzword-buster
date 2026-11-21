// How fast the ball travels as the wall of Buzzword Buster clears. The wall
// itself comes from brick-wall.js and the words from words.js; both are pure
// and tested in node. So is this: it answers one question about the ball and
// draws nothing (test/ball_speed_test.mjs). game.js asks it and paints.
//
// The ball starts at its starting speed and ends at SPEED_AT_EMPTY times that
// when the last piece goes, and the step between one piece and the next is the
// same all the way down: 1.0 at a whole wall, 1.5 at an empty one, and a step
// of a forty-eighth between the two. The last bricks are not as easy as the
// first.
//
// The rule is written as the pieces the wall has left, not the pieces busted,
// so a wall that was never full rises just as fast: one piece left of two is
// half way to the top speed, as one piece left of twenty-four is.
//
// It is a function of the wall alone, so game.js reads it at the top of every
// frame the ball flies: the last piece of the wall is busted by a ball at 1.5
// times its starting speed, not by one a step short of it.
(() => {
  const START = 1;
  const SPEED_AT_EMPTY = 1.5;

  // The number the ball's speed is multiplied by. game.js takes the ball's whole
  // velocity from it at the top of every frame, so a faster ball still travels
  // the same way, and the paddle bounce keeps the angle of the ball it is given.
  // The pieces a round is measured against are counted out of an array, so both
  // arguments are integers; the tidying below is there so that no number this is
  // ever handed, not even one that is not a count, leaves the page without a
  // speed to play with.
  //
  // A wall with no room to rise (nothing left to bust, or no pieces to bust)
  // gives the starting speed, and a count outside the wall is read as the edge
  // it lies beyond: the page is never left without a number to multiply by.
  function speedFactor(piecesLeft, piecesAtStart) {
    const total = Number(piecesAtStart);
    if (!(total > 0)) return START;
    if (!Number.isFinite(total)) return START;
    // Whole pieces only: the count is a number of pieces, not a fraction of
    // one, and the wall's top and bottom are its ends rather than a crash.
    const left = Math.min(total, Math.max(0, Math.floor(Number(piecesLeft)) || 0));
    return START + (SPEED_AT_EMPTY - START) * ((total - left) / total);
  }

  globalThis.BUZZ_BALL_SPEED = { speedFactor, START, SPEED_AT_EMPTY };
})();
