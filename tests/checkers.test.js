import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CheckersGame,
  INITIAL_CHECKERS_STATE,
  squareToRowCol,
  rowColToSquare
} from '../backend/core/checkers.js';

test('Checkers: 10x10 board coordinate and square mappings (1-50)', () => {
  assert.deepEqual(squareToRowCol(1), { row: 0, col: 1 });
  assert.deepEqual(squareToRowCol(5), { row: 0, col: 9 });
  assert.deepEqual(squareToRowCol(46), { row: 9, col: 0 });
  assert.deepEqual(squareToRowCol(50), { row: 9, col: 8 });

  assert.equal(rowColToSquare(0, 1), 1);
  assert.equal(rowColToSquare(9, 8), 50);
});

test('Checkers: starting position has 20 white and 20 black pieces', () => {
  const game = new CheckersGame();
  const counts = game.countPieces();
  assert.equal(counts.white, 20);
  assert.equal(counts.black, 20);
  assert.equal(counts.whiteKings, 0);
  assert.equal(counts.blackKings, 0);
  assert.equal(game.turn, 'w');
});

test('Checkers: standard forward non-capturing move', () => {
  const game = new CheckersGame();
  // Square 32 (row 6, col 2) moving forward to square 28 (row 5, col 4) or 27 (row 5, col 2)
  const legalMoves = game.getLegalMoves();
  const move32_28 = legalMoves.find(m => m.from === 32 && (m.to === 28 || m.to === 27));
  assert.ok(move32_28, 'White man at 32 should have legal forward moves');

  const res = game.makeMove({ from: move32_28.from, to: move32_28.to });
  assert.ok(res.success);
  assert.equal(game.turn, 'b');
});

test('Checkers: men can capture backwards (International rule)', () => {
  // Place white man on square 28 and black man on square 22 (behind it) or square 33
  // Square 28: (5, 5). Diagonal backward is (6, 4)=32 or (6, 6)=33.
  // Place white man on sq 28, black man on sq 33 (row 6, col 6).
  // Landing square is (7, 7) = sq 39.
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');
  chars[28 - 1] = 'w'; // White man on 28
  chars[33 - 1] = 'b'; // Black man on 33 (behind white man)
  // Landing square 39 is empty '.'
  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'w');
  const legalMoves = game.getLegalMoves();
  const backwardCap = legalMoves.find(m => m.from === 28 && m.to === 39);

  assert.ok(backwardCap, 'White man must be able to jump backwards over square 33 to square 39');
  const res = game.makeMove({ from: 28, to: 39 });
  assert.ok(res.success);
  assert.deepEqual(res.captured, [33], 'Captured piece at square 33 must be recorded');
  assert.equal(game.boardMatrix[6][6], null, 'Captured piece at square 33 must be removed');
});

test('Checkers: mandatory capture rule prohibits non-capturing moves', () => {
  // If a capture is available, all returned legal moves must be captures
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');
  chars[32 - 1] = 'w';
  chars[28 - 1] = 'b'; // Opponent in front of white
  // Square 23 is empty landing square
  chars[45 - 1] = 'w'; // Another white piece with simple move available
  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'w');
  const legalMoves = game.getLegalMoves();

  // All legal moves MUST be captures
  assert.ok(legalMoves.length > 0);
  assert.ok(legalMoves.every(m => m.captured.length > 0), 'Every legal move must be a capture');
  assert.ok(legalMoves.some(m => m.from === 32 && m.to === 23));
});

test('Checkers: maximum capture rule (majority rule)', () => {
  // Setup position where one piece can capture 1 piece, and another piece can capture 2 pieces.
  // Piece 1 on sq 30 can jump over sq 25 to 20 (1 capture).
  // Piece 2 on sq 40 can jump over sq 34 to 29, then over sq 24 to 20 (2 captures).
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');

  // 1-capture path
  chars[30 - 1] = 'w';
  chars[25 - 1] = 'b'; // target

  // 2-capture path
  chars[40 - 1] = 'w';
  chars[34 - 1] = 'b'; // target 1
  chars[24 - 1] = 'b'; // target 2

  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'w');
  const legalMoves = game.getLegalMoves();

  // The engine must enforce maximum capture: only the 2-capture path is legal!
  assert.ok(legalMoves.length > 0);
  assert.ok(legalMoves.every(m => m.capturesCount === 2), 'Only the maximum capture sequence (2 captures) is legal');
  assert.equal(legalMoves[0].from, 40);
});

test('Checkers: promotion to Flying King at opposite baseline', () => {
  // White man on square 6 (row 1, col 0) moves forward to square 1 (row 0, col 1) -> King
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');
  chars[6 - 1] = 'w';
  chars[20 - 1] = 'b'; // Opponent piece elsewhere
  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'w');
  const res = game.makeMove({ from: 6, to: 1 });
  assert.ok(res.success);
  assert.equal(res.promoted, true);
  assert.equal(game.boardMatrix[0][1], 'W', 'Piece promoted to White King "W"');
});

test('Checkers: Flying King long-range sliding and jumping', () => {
  // White King on square 46 (row 9, col 0) can slide along entire diagonal to empty square 5 (row 0, col 9)
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');
  chars[46 - 1] = 'W'; // King
  chars[20 - 1] = 'b'; // Opponent piece elsewhere
  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'w');
  const legalMoves = game.getLegalMoves();

  // Long diagonal from 46: (9,0) -> (8,1)=41, (7,2)=37, (6,3)=32, (5,4)=28, (4,5)=23, (3,6)=19, (2,7)=14, (1,8)=10, (0,9)=5
  const slideTo5 = legalMoves.find(m => m.from === 46 && m.to === 5);
  assert.ok(slideTo5, 'Flying king should be able to slide across the entire board diagonal to square 5');
});

test('Checkers: win by elimination', () => {
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');
  chars[28 - 1] = 'w';
  chars[22 - 1] = 'b'; // Only black piece
  // Landing square 17
  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'w');
  const res = game.makeMove({ from: 28, to: 17 });
  assert.ok(res.success);
  assert.equal(res.gameOver, true);
  assert.equal(res.winner, 'white');
  assert.equal(res.winReason, 'elimination');
});

test('Checkers: win by blocking all opponent moves', () => {
  // Black piece trapped with no legal moves
  let boardStr = '.'.repeat(50);
  const chars = boardStr.split('');
  chars[1 - 1] = 'b'; // Black man at row 0, col 1
  chars[6 - 1] = 'w'; // White man at row 1, col 0 blocks (1,0)
  chars[7 - 1] = 'w'; // White man at row 1, col 2 blocks (1,2)
  chars[11 - 1] = 'w'; // Blocks jump
  chars[12 - 1] = 'w'; // Blocks jump
  boardStr = chars.join('');

  const game = new CheckersGame(boardStr, 'b');
  const gameOver = game.isGameOver();
  assert.equal(gameOver.gameOver, true);
  assert.equal(gameOver.winner, 'white');
  assert.equal(gameOver.reason, 'blocked');
});
