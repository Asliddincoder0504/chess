import test from 'node:test';
import assert from 'node:assert/strict';
import { ChessGame, INITIAL_FEN } from '../backend/core/chess.js';

test('Chess: starting position matches standard FEN', () => {
  const game = new ChessGame();
  assert.equal(game.toFEN(), INITIAL_FEN);
  assert.equal(game.turn, 'w');
  assert.equal(game.getLegalMoves().length, 20); // 16 pawn moves + 4 knight moves
});

test('Chess: pawn standard single and double move', () => {
  const game = new ChessGame();
  const res1 = game.makeMove('e2e4');
  assert.ok(res1.success);
  assert.equal(game.turn, 'b');
  assert.equal(game.enPassant, 'e3');

  const res2 = game.makeMove('e7e5');
  assert.ok(res2.success);
  assert.equal(game.turn, 'w');
});

test('Chess: en passant capture', () => {
  // Setup position where white pawn is on e5 and black plays d7d5
  const game = new ChessGame('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
  const moves = game.getLegalMoves();
  const epMove = moves.find(m => m.from === 'e5' && m.to === 'd6');
  assert.ok(epMove, 'En passant move e5xd6 must be generated');

  const res = game.makeMove('e5d6');
  assert.ok(res.success);
  // Black pawn at d5 must be removed
  assert.equal(game.board[3][3], null, 'Captured black pawn at d5 must be removed from board');
});

test('Chess: castling kingside (O-O) and queenside (O-O-O)', () => {
  // White kingside castling ready
  const game = new ChessGame('rnbqk2r/pppp1ppp/5n2/2b1p3/4P3/5N2/PPPPBPPP/RNBQK2R w KQkq - 4 4');
  const res = game.makeMove('e1g1');
  assert.ok(res.success);
  assert.equal(res.san, 'O-O');
  assert.equal(game.board[7][6], 'K');
  assert.equal(game.board[7][5], 'R');
  assert.equal(game.board[7][4], null);
  assert.equal(game.board[7][7], null);
});

test('Chess: castling through check is illegal', () => {
  // White e1->g1 passes through f1. Place black rook attacking f1 on an open f-file
  const game = new ChessGame('rnbqk2r/pppp2pp/8/4p3/8/8/PPPPBPPP/RNBQK2R w KQkq - 0 1');
  // Rook on f8 attacks f1
  game.board[0][5] = 'r';
  game.board[1][5] = null; // Clear f7 pawn so rook file is open
  game.board[6][5] = null; // Clear f2 pawn so f1 is exposed to attack
  // Clear path between e1 and h1
  game.board[7][5] = null;
  game.board[7][6] = null;

  const legalMoves = game.getLegalMoves();
  const castle = legalMoves.find(m => m.from === 'e1' && m.to === 'g1');
  assert.equal(castle, undefined, 'Cannot castle through attacked f1 square');
});

test('Chess: pawn promotion to Queen', () => {
  const game = new ChessGame('8/4P3/8/8/8/8/k6K/8 w - - 0 1');
  const res = game.makeMove({ from: 'e7', to: 'e8', promotion: 'q' });
  assert.ok(res.success);
  assert.equal(game.board[0][4], 'Q');
});

test('Chess: Scholar’s Mate detected as Checkmate', () => {
  const game = new ChessGame();
  game.makeMove('e2e4');
  game.makeMove('e7e5');
  game.makeMove('f1c4');
  game.makeMove('b8c6');
  game.makeMove('d1h5');
  game.makeMove('g8f6');
  const finalMove = game.makeMove('h5f7');

  assert.ok(finalMove.isCheckmate, '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# must be checkmate');
  assert.equal(finalMove.gameOver, true);
  assert.equal(finalMove.winner, 'white');
  assert.equal(finalMove.winReason, 'checkmate');
});

test('Chess: Stalemate detected as Draw', () => {
  // Stalemate setup: Black king on a8, White king on c7, White queen on b1 moving to b6
  const game = new ChessGame('k7/2K5/8/8/8/8/8/1Q6 w - - 0 1');
  const res = game.makeMove('b1b6');
  assert.ok(res.success);
  assert.ok(game.isStalemate(), 'Black king should be stalemated');
  assert.equal(game.isGameOver().gameOver, true);
  assert.equal(game.isGameOver().winner, 'draw');
  assert.equal(game.isGameOver().reason, 'stalemate');
});

test('Chess: Insufficient material (K vs K)', () => {
  const game = new ChessGame('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
  assert.ok(game.isInsufficientMaterial(), 'King vs King is insufficient material');
  assert.equal(game.isGameOver().winner, 'draw');
  assert.equal(game.isGameOver().reason, 'insufficient_material');
});

test('Chess: 50-move rule draw detection', () => {
  const game = new ChessGame('8/8/8/4k3/8/8/4K3/8 w - - 100 50');
  assert.ok(game.isFiftyMoveDraw(), '100 half-moves without pawn move or capture triggers fifty-move rule');
  assert.equal(game.isGameOver().winner, 'draw');
});
