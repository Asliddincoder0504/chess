/**
 * WellChess Pure JavaScript Authoritative Checkers Engine
 * Supports both:
 * 1. International Checkers (10x10, 50 dark squares, 20 pieces per player)
 * 2. Classic / Russian Checkers (8x8, 32 dark squares, 12 pieces per player)
 */

export const BOARD_SIZE = 10;
export const TOTAL_SQUARES = 50;

export const BOARD_SIZE_8 = 8;
export const TOTAL_SQUARES_8 = 32;

// Precompute 10x10 coordinate mappings (1-50)
const SQUARE_TO_COORDS_10 = {};
const COORDS_TO_SQUARE_10 = {};
let sqNum10 = 1;
for (let r = 0; r < 10; r++) {
  for (let c = 0; c < 10; c++) {
    if ((r + c) % 2 === 1) {
      SQUARE_TO_COORDS_10[sqNum10] = { row: r, col: c };
      COORDS_TO_SQUARE_10[`${r},${c}`] = sqNum10;
      sqNum10++;
    }
  }
}

// Precompute 8x8 coordinate mappings (1-32)
const SQUARE_TO_COORDS_8 = {};
const COORDS_TO_SQUARE_8 = {};
let sqNum8 = 1;
for (let r = 0; r < 8; r++) {
  for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 1) {
      SQUARE_TO_COORDS_8[sqNum8] = { row: r, col: c };
      COORDS_TO_SQUARE_8[`${r},${c}`] = sqNum8;
      sqNum8++;
    }
  }
}

export function squareToRowCol(sq, size = 10) {
  const num = parseInt(sq, 10);
  const map = size === 8 ? SQUARE_TO_COORDS_8 : SQUARE_TO_COORDS_10;
  return map[num] || null;
}

export function rowColToSquare(r, c, size = 10) {
  const map = size === 8 ? COORDS_TO_SQUARE_8 : COORDS_TO_SQUARE_10;
  return map[`${r},${c}`] || null;
}

// 10x10 starting position (50 dark squares, 20 black pieces, 20 white pieces)
export const INITIAL_CHECKERS_STATE =
  'bbbbbbbbbbbbbbbbbbbb' + // 1-20
  '..........' +           // 21-30
  'wwwwwwwwwwwwwwwwwwww';  // 31-50

// 8x8 starting position (32 dark squares, 12 black pieces, 12 white pieces)
export const INITIAL_CHECKERS_8_STATE =
  'bbbbbbbbbbbb' + // 1-12 (Black pieces on rows 0, 1, 2)
  '........' +     // 13-20 (Empty rows 3, 4)
  'wwwwwwwwwwww';  // 21-32 (White pieces on rows 5, 6, 7)

export class CheckersGame {
  /**
   * @param {string} [boardString] 50-char (10x10) or 32-char (8x8) string
   * @param {'w' | 'b'} [turn='w'] Current turn
   * @param {number} [boardSize=null] Optional explicit board size (8 or 10)
   */
  constructor(boardString = INITIAL_CHECKERS_STATE, turn = 'w', boardSize = null) {
    const clean = (boardString || '').replace(/[^bwBW.]/g, '');
    this.boardSize = boardSize || (clean.length === 32 ? 8 : 10);
    this.totalSquares = this.boardSize === 8 ? 32 : 50;
    this.sqToCoords = this.boardSize === 8 ? SQUARE_TO_COORDS_8 : SQUARE_TO_COORDS_10;
    this.coordsToSq = this.boardSize === 8 ? COORDS_TO_SQUARE_8 : COORDS_TO_SQUARE_10;

    this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
    this.turn = turn;
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.history = [];

    const defaultState = this.boardSize === 8 ? INITIAL_CHECKERS_8_STATE : INITIAL_CHECKERS_STATE;
    this.loadState(clean || defaultState, turn);
  }

  get boardMatrix() {
    return this.board;
  }

  squareToRowCol(sq) {
    const num = parseInt(sq, 10);
    return this.sqToCoords[num] || null;
  }

  rowColToSquare(r, c) {
    return this.coordsToSq[`${r},${c}`] || null;
  }

  loadState(boardString, turn = 'w') {
    const clean = boardString.replace(/[^bwBW.]/g, '');
    if (clean.length !== this.totalSquares) {
      if (clean.length === 32 && this.boardSize !== 8) {
        this.boardSize = 8;
        this.totalSquares = 32;
        this.sqToCoords = SQUARE_TO_COORDS_8;
        this.coordsToSq = COORDS_TO_SQUARE_8;
      } else if (clean.length === 50 && this.boardSize !== 10) {
        this.boardSize = 10;
        this.totalSquares = 50;
        this.sqToCoords = SQUARE_TO_COORDS_10;
        this.coordsToSq = COORDS_TO_SQUARE_10;
      } else {
        throw new Error(`Invalid checkers state length: expected ${this.totalSquares}, got ${clean.length}`);
      }
    }

    this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));

    for (let i = 1; i <= this.totalSquares; i++) {
      const char = clean[i - 1];
      const coords = this.squareToRowCol(i);
      if (char !== '.' && coords) {
        this.board[coords.row][coords.col] = char;
      }
    }

    this.turn = turn === 'b' ? 'b' : 'w';
  }

  exportState() {
    let str = '';
    for (let i = 1; i <= this.totalSquares; i++) {
      const coords = this.squareToRowCol(i);
      const piece = coords ? this.board[coords.row][coords.col] : null;
      str += piece || '.';
    }
    return str;
  }

  clone() {
    const next = new CheckersGame(this.exportState(), this.turn, this.boardSize);
    next.halfmoveClock = this.halfmoveClock;
    next.fullmoveNumber = this.fullmoveNumber;
    next.history = [...this.history];
    return next;
  }

  isPieceColor(piece, color) {
    if (!piece) return false;
    return color === 'w' ? (piece === 'w' || piece === 'W') : (piece === 'b' || piece === 'B');
  }

  isKing(piece) {
    return piece === 'W' || piece === 'B';
  }

  findCapturesFrom(row, col, visitedCoords = [], pathSquares = null, capturedSquares = null) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = this.isPieceColor(piece, 'w') ? 'w' : 'b';
    const king = this.isKing(piece);
    const originSq = this.rowColToSquare(row, col);

    if (!pathSquares) pathSquares = [originSq];
    if (!capturedSquares) capturedSquares = [];

    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const captureChains = [];

    if (!king) {
      for (const [dr, dc] of dirs) {
        const midR = row + dr;
        const midC = col + dc;
        const endR = row + 2 * dr;
        const endC = col + 2 * dc;

        if (endR >= 0 && endR < this.boardSize && endC >= 0 && endC < this.boardSize) {
          const midPiece = this.board[midR][midC];
          const endPiece = this.board[endR][endC];
          const midKey = `${midR},${midC}`;

          if (midPiece &&
              !this.isPieceColor(midPiece, color) &&
              !visitedCoords.includes(midKey) &&
              (!endPiece || (endR === pathSquares[0] && endC === pathSquares[0]))) {
            if (!endPiece) {
              const targetSq = this.rowColToSquare(endR, endC);
              const capturedSq = this.rowColToSquare(midR, midC);
              const nextVisited = [...visitedCoords, midKey];
              const nextPath = [...pathSquares, targetSq];
              const nextCaps = [...capturedSquares, capturedSq];

              const cloned = this.clone();
              cloned.board[row][col] = null;
              cloned.board[midR][midC] = null;
              cloned.board[endR][endC] = piece;

              // King promotion mid-jump or at baseline
              const baseline = color === 'w' ? 0 : this.boardSize - 1;
              if (endR === baseline) {
                cloned.board[endR][endC] = color === 'w' ? 'W' : 'B';
              }

              const further = cloned.findCapturesFrom(endR, endC, nextVisited, nextPath, nextCaps);
              if (further.length > 0) {
                captureChains.push(...further);
              } else {
                captureChains.push({
                  from: pathSquares[0],
                  to: targetSq,
                  path: nextPath,
                  captured: nextCaps,
                  capturesCount: nextCaps.length
                });
              }
            }
          }
        }
      }
    } else {
      // Flying King captures
      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        let capturedCoord = null;
        let capturedSq = null;

        while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
          const midKey = `${r},${c}`;
          const currentPiece = this.board[r][c];

          if (!capturedCoord) {
            if (currentPiece) {
              if (this.isPieceColor(currentPiece, color) || visitedCoords.includes(midKey)) {
                break;
              } else {
                capturedCoord = midKey;
                capturedSq = this.rowColToSquare(r, c);
              }
            }
          } else {
            if (currentPiece) {
              break;
            } else {
              const targetSq = this.rowColToSquare(r, c);
              const nextVisited = [...visitedCoords, capturedCoord];
              const nextPath = [...pathSquares, targetSq];
              const nextCaps = [...capturedSquares, capturedSq];

              const [capR, capC] = capturedCoord.split(',').map(Number);
              const cloned = this.clone();
              cloned.board[row][col] = null;
              cloned.board[capR][capC] = null;
              cloned.board[r][c] = piece;

              const further = cloned.findCapturesFrom(r, c, nextVisited, nextPath, nextCaps);
              if (further.length > 0) {
                captureChains.push(...further);
              } else {
                captureChains.push({
                  from: pathSquares[0],
                  to: targetSq,
                  path: nextPath,
                  captured: nextCaps,
                  capturesCount: nextCaps.length
                });
              }
            }
          }
          r += dr;
          c += dc;
        }
      }
    }

    return captureChains;
  }

  findSimpleMovesFrom(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = this.isPieceColor(piece, 'w') ? 'w' : 'b';
    const king = this.isKing(piece);
    const originSq = this.rowColToSquare(row, col);
    const moves = [];

    if (!king) {
      const forwardDir = color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = row + forwardDir;
        const nc = col + dc;
        if (nr >= 0 && nr < this.boardSize && nc >= 0 && nc < this.boardSize) {
          if (!this.board[nr][nc]) {
            const destSq = this.rowColToSquare(nr, nc);
            moves.push({
              from: originSq,
              to: destSq,
              path: [originSq, destSq],
              captured: [],
              capturesCount: 0
            });
          }
        }
      }
    } else {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
          if (!this.board[r][c]) {
            const destSq = this.rowColToSquare(r, c);
            moves.push({
              from: originSq,
              to: destSq,
              path: [originSq, destSq],
              captured: [],
              capturesCount: 0
            });
          } else {
            break;
          }
          r += dr;
          c += dc;
        }
      }
    }

    return moves;
  }

  getLegalMoves() {
    const allCaptures = [];

    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        const piece = this.board[r][c];
        if (piece && this.isPieceColor(piece, this.turn)) {
          const caps = this.findCapturesFrom(r, c);
          allCaptures.push(...caps);
        }
      }
    }

    // Mandatory capture rule
    if (allCaptures.length > 0) {
      // In International Checkers (10x10), maximum captures rule is strictly required
      if (this.boardSize === 10) {
        let maxCount = 0;
        for (const cap of allCaptures) {
          if (cap.capturesCount > maxCount) {
            maxCount = cap.capturesCount;
          }
        }
        return allCaptures.filter(c => c.capturesCount === maxCount);
      }
      // In 8x8 checkers, any capture chain is allowed
      return allCaptures;
    }

    // If no captures, simple forward moves
    const allSimpleMoves = [];
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        const piece = this.board[r][c];
        if (piece && this.isPieceColor(piece, this.turn)) {
          allSimpleMoves.push(...this.findSimpleMovesFrom(r, c));
        }
      }
    }

    return allSimpleMoves;
  }

  makeMove(moveInput) {
    if (this.isGameOver().gameOver) {
      throw new Error('Cannot make a move in a finished checkers game');
    }

    let parsedFrom, parsedTo;
    if (typeof moveInput === 'string') {
      const parts = moveInput.split(/[-x]/).map(s => parseInt(s.trim(), 10));
      parsedFrom = parts[0];
      parsedTo = parts[parts.length - 1];
    } else {
      parsedFrom = parseInt(moveInput.from, 10);
      parsedTo = parseInt(moveInput.to, 10);
    }

    const legalMoves = this.getLegalMoves();
    if (legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    const matched = legalMoves.find(m => {
      if (m.from !== parsedFrom || m.to !== parsedTo) return false;
      if (moveInput.path && Array.isArray(moveInput.path)) {
        return m.path.join('-') === moveInput.path.join('-');
      }
      return true;
    });

    if (!matched) {
      throw new Error(`Illegal checkers move: ${parsedFrom}->${parsedTo}`);
    }

    const fromCoords = this.squareToRowCol(matched.from);
    const toCoords = this.squareToRowCol(matched.to);
    const movingPiece = this.board[fromCoords.row][fromCoords.col];
    const isMan = movingPiece === 'w' || movingPiece === 'b';

    this.board[fromCoords.row][fromCoords.col] = null;
    this.board[toCoords.row][toCoords.col] = movingPiece;

    for (const capSq of matched.captured) {
      const capCoords = this.squareToRowCol(capSq);
      if (capCoords) {
        this.board[capCoords.row][capCoords.col] = null;
      }
    }

    let promoted = false;
    const baseline = this.turn === 'w' ? 0 : this.boardSize - 1;
    if (isMan && toCoords.row === baseline) {
      this.board[toCoords.row][toCoords.col] = this.turn === 'w' ? 'W' : 'B';
      promoted = true;
    }

    const notation = matched.captured.length > 0
      ? matched.path.join('x')
      : `${matched.from}-${matched.to}`;

    if (matched.captured.length > 0 || isMan) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    if (this.turn === 'b') {
      this.fullmoveNumber++;
    }

    this.turn = this.turn === 'w' ? 'b' : 'w';
    const gameOver = this.isGameOver();

    return {
      success: true,
      from: matched.from,
      to: matched.to,
      path: matched.path,
      captured: matched.captured,
      promoted,
      notation,
      state: this.exportState(),
      gameOver: gameOver.gameOver,
      winner: gameOver.winner,
      winReason: gameOver.reason
    };
  }

  countPieces() {
    let white = 0, black = 0, whiteKings = 0, blackKings = 0;
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        const piece = this.board[r][c];
        if (piece === 'w') white++;
        else if (piece === 'W') { white++; whiteKings++; }
        else if (piece === 'b') black++;
        else if (piece === 'B') { black++; blackKings++; }
      }
    }
    return { white, black, whiteKings, blackKings };
  }

  isGameOver() {
    const counts = this.countPieces();

    if (counts.white === 0) {
      return { gameOver: true, winner: 'black', reason: 'elimination' };
    }
    if (counts.black === 0) {
      return { gameOver: true, winner: 'white', reason: 'elimination' };
    }

    const legalMoves = this.getLegalMoves();
    if (legalMoves.length === 0) {
      const winner = this.turn === 'w' ? 'black' : 'white';
      return { gameOver: true, winner, reason: 'blocked' };
    }

    if (this.halfmoveClock >= 50) {
      return { gameOver: true, winner: 'draw', reason: 'twenty_five_moves_rule' };
    }

    return { gameOver: false, winner: null, reason: null };
  }
}
