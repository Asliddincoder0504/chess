import test from 'node:test';
import assert from 'node:assert';
import {
  CheckersGame,
  INITIAL_CHECKERS_8_STATE,
  TOTAL_SQUARES_8,
  BOARD_SIZE_8,
  squareToRowCol,
  rowColToSquare
} from '../backend/core/checkers.js';

test('Checkers 8x8: 32 dark squares and coordinate mappings (1-32)', () => {
  assert.strictEqual(TOTAL_SQUARES_8, 32);
  assert.strictEqual(BOARD_SIZE_8, 8);

  // Square 1 is at (0, 1)
  const sq1 = squareToRowCol(1, 8);
  assert.deepStrictEqual(sq1, { row: 0, col: 1 });
  assert.strictEqual(rowColToSquare(0, 1, 8), 1);

  // Square 32 is at (7, 6)
  const sq32 = squareToRowCol(32, 8);
  assert.deepStrictEqual(sq32, { row: 7, col: 6 });
  assert.strictEqual(rowColToSquare(7, 6, 8), 32);
});

test('Checkers 8x8: starting position has exactly 12 white and 12 black pieces', () => {
  const game = new CheckersGame(INITIAL_CHECKERS_8_STATE, 'w', 8);
  const counts = game.countPieces();

  assert.strictEqual(counts.white, 12, 'White should start with exactly 12 pieces in 8x8 checkers');
  assert.strictEqual(counts.black, 12, 'Black should start with exactly 12 pieces in 8x8 checkers');
  assert.strictEqual(counts.whiteKings, 0);
  assert.strictEqual(counts.blackKings, 0);
  assert.strictEqual(game.boardSize, 8);
  assert.strictEqual(game.totalSquares, 32);
});

test('Checkers 8x8: standard forward non-capturing move', () => {
  const game = new CheckersGame(INITIAL_CHECKERS_8_STATE, 'w', 8);
  // White piece at square 21 moves to square 17
  const res = game.makeMove({ from: 21, to: 17 });
  assert.strictEqual(res.success, true);
  assert.strictEqual(game.turn, 'b');
  assert.strictEqual(game.board[4][1], 'w');
});

test('Checkers 8x8: men can capture backwards', () => {
  // Setup white man at square 17 (row 4, col 1) and black man behind it at square 21 (row 5, col 0)
  // Landing square 26 (row 6, col 3) or backward jump
  let board = '.'.repeat(32);
  // White at sq 18 (row 4, col 3), Black at sq 22 (row 5, col 2), target sq 25 (row 6, col 1)
  const arr = board.split('');
  arr[17] = 'w'; // Sq 18
  arr[21] = 'b'; // Sq 22
  // Sq 25 is index 24 (row 6, col 1), empty

  const game = new CheckersGame(arr.join(''), 'w', 8);
  const legalMoves = game.getLegalMoves();
  const backwardCap = legalMoves.find(m => m.from === 18 && m.to === 25);
  assert.ok(backwardCap, 'White man must be able to capture backwards to square 25');

  const res = game.makeMove({ from: 18, to: 25 });
  assert.strictEqual(res.captured.length, 1);
  assert.strictEqual(res.captured[0], 22);
  assert.strictEqual(game.countPieces().black, 0);
});

test('Checkers 8x8: promotion to King at opposite baseline', () => {
  let board = '.'.repeat(32);
  const arr = board.split('');
  arr[4] = 'w'; // Sq 5 at row 1, col 0
  arr[31] = 'b'; // Black piece at sq 32 so game is not finished
  const game = new CheckersGame(arr.join(''), 'w', 8);

  // Move from sq 5 to sq 1 (row 0, col 1) -> baseline!
  const res = game.makeMove({ from: 5, to: 1 });
  assert.strictEqual(res.promoted, true);
  assert.strictEqual(game.board[0][1], 'W');
});
