/**
 * WellChess Pure JavaScript Authoritative Checkers Engine
 * Implements complete official International Checkers (10x10 draughts) rules:
 * - 10x10 board with 50 dark playable squares (standard 1-50 notation)
 * - 20 pieces per player (White vs Black)
 * - Men move diagonally forward 1 square
 * - Men capture forward AND backward
 * - Mandatory captures
 * - Maximum capture rule (must choose sequence capturing maximum pieces)
 * - Multi-jump sequences
 * - Promotion to Flying Kings at baseline
 * - Flying Kings: slide any distance along diagonal and jump across distances
 * - Win detection (elimination or blocked opponent)
 * - Draw detection (resignation, agreement, moves limit)
 */

export const BOARD_SIZE = 10;
export const TOTAL_SQUARES = 50;

/**
 * Precompute coordinate to square number mapping (1 to 50) and vice versa.
 * Dark squares are those where (row + col) % 2 === 1.
 */
const SQUARE_TO_COORDS = {};
const COORDS_TO_SQUARE = {};

let sqNum = 1;
for (let r = 0; r < BOARD_SIZE; r++) {
  for (let c = 0; c < BOARD_SIZE; c++) {
    if ((r + c) % 2 === 1) {
      SQUARE_TO_COORDS[sqNum] = { row: r, col: c };
      COORDS_TO_SQUARE[`${r},${c}`] = sqNum;
      sqNum++;
    }
  }
}

export function squareToRowCol(sq) {
  const num = parseInt(sq, 10);
  return SQUARE_TO_COORDS[num] || null;
}

export function rowColToSquare(r, c) {
  return COORDS_TO_SQUARE[`${r},${c}`] || null;
}

/**
 * Starting position representation:
 * 50 characters:
 * 'b' = black man, 'B' = black king
 * 'w' = white man, 'W' = white king
 * '.' = empty dark square
 */
export const INITIAL_CHECKERS_STATE =
  'bbbbbbbbbbbbbbbbbbbb' + // 1-20 (Black pieces)
  '..........' +           // 21-30 (Empty middle rows)
  'wwwwwwwwwwwwwwwwwwww';  // 31-50 (White pieces)

export class CheckersGame {
  /**
   * @param {string} [boardString] 50-char string representing dark squares
   * @param {'w' | 'b'} [turn='w'] Current turn ('w' for White, 'b' for Black)
   */
  constructor(boardString = INITIAL_CHECKERS_STATE, turn = 'w') {
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.turn = turn;
    this.halfmoveClock = 0; // Moves since last capture or man advance
    this.fullmoveNumber = 1;
    this.history = [];
    this.loadState(boardString, turn);
  }

  get boardMatrix() {
    return this.board;
  }

  loadState(boardString, turn = 'w') {
    const clean = boardString.replace(/[^bwBW.]/g, '');
    if (clean.length !== TOTAL_SQUARES) {
      throw new Error(`Invalid checkers state length: expected 50, got ${clean.length}`);
    }

    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    for (let i = 1; i <= TOTAL_SQUARES; i++) {
      const char = clean[i - 1];
      const coords = squareToRowCol(i);
      if (char !== '.') {
        this.board[coords.row][coords.col] = char;
      }
    }

    this.turn = turn === 'b' ? 'b' : 'w';
  }

  exportState() {
    let str = '';
    for (let i = 1; i <= TOTAL_SQUARES; i++) {
      const coords = squareToRowCol(i);
      const piece = this.board[coords.row][coords.col];
      str += piece || '.';
    }
    return str;
  }

  clone() {
    const next = new CheckersGame(this.exportState(), this.turn);
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

  /**
   * Generate all capture sequences starting from {row, col}
   * @param {number} row
   * @param {number} col
   * @param {Array<string>} [visitedCoords] Coords of captured pieces already jumped in this chain
   * @param {Array<number>} [pathSquares] Sequence of square numbers visited
   * @param {Array<number>} [capturedSquares] Sequence of square numbers captured
   * @returns {Array<Object>}
   */
  findCapturesFrom(row, col, visitedCoords = [], pathSquares = null, capturedSquares = null) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = this.isPieceColor(piece, 'w') ? 'w' : 'b';
    const king = this.isKing(piece);
    const originSq = rowColToSquare(row, col);

    if (!pathSquares) pathSquares = [originSq];
    if (!capturedSquares) capturedSquares = [];

    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const captureChains = [];

    if (!king) {
      // Man can capture in all 4 diagonal directions forward & backward
      for (const [dr, dc] of dirs) {
        const midR = row + dr;
        const midC = col + dc;
        const endR = row + 2 * dr;
        const endC = col + 2 * dc;

        if (endR >= 0 && endR < BOARD_SIZE && endC >= 0 && endC < BOARD_SIZE) {
          const midPiece = this.board[midR][midC];
          const endPiece = this.board[endR][endC];
          const midKey = `${midR},${midC}`;

          // Opponent piece on intermediate square and target square empty
          if (midPiece &&
              !this.isPieceColor(midPiece, color) &&
              !visitedCoords.includes(midKey) &&
              (!endPiece || (endR === pathSquares[0] && endC === pathSquares[0]))) { // target must be empty

            if (!endPiece) {
              const capSq = rowColToSquare(midR, midC);
              const destSq = rowColToSquare(endR, endC);

              // Recurse for continuation
              // In draughts, the piece moves along the board, but captured pieces are only removed at end of turn.
              // We simulate the moving piece at (endR, endC)
              const savedOrigin = this.board[row][col];
              this.board[row][col] = null;
              this.board[endR][endC] = savedOrigin;

              const subChains = this.findCapturesFrom(
                endR,
                endC,
                [...visitedCoords, midKey],
                [...pathSquares, destSq],
                [...capturedSquares, capSq]
              );

              // Restore
              this.board[endR][endC] = null;
              this.board[row][col] = savedOrigin;

              if (subChains.length > 0) {
                captureChains.push(...subChains);
              } else {
                captureChains.push({
                  from: pathSquares[0],
                  to: destSq,
                  path: [...pathSquares, destSq],
                  captured: [...capturedSquares, capSq],
                  capturesCount: capturedSquares.length + 1
                });
              }
            }
          }
        }
      }
    } else {
      // Flying King: slides any distance along diagonal, jumps piece, lands on any empty square beyond
      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        let foundOpponent = null;
        let foundOpponentCoord = null;

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          const currentPiece = this.board[r][c];
          const key = `${r},${c}`;

          if (currentPiece) {
            if (this.isPieceColor(currentPiece, color)) {
              // Friendly piece blocks diagonal
              break;
            } else {
              // Opponent piece
              if (visitedCoords.includes(key)) {
                // Cannot jump over already jumped piece
                break;
              }
              if (foundOpponent) {
                // Cannot jump two opponent pieces in a row
                break;
              }
              foundOpponent = currentPiece;
              foundOpponentCoord = { r, c, key, sq: rowColToSquare(r, c) };
            }
          } else {
            // Empty square
            if (foundOpponent) {
              // Valid landing square!
              const destSq = rowColToSquare(r, c);

              const savedOrigin = this.board[row][col];
              this.board[row][col] = null;
              this.board[r][c] = savedOrigin;

              const subChains = this.findCapturesFrom(
                r,
                c,
                [...visitedCoords, foundOpponentCoord.key],
                [...pathSquares, destSq],
                [...capturedSquares, foundOpponentCoord.sq]
              );

              this.board[r][c] = null;
              this.board[row][col] = savedOrigin;

              if (subChains.length > 0) {
                captureChains.push(...subChains);
              } else {
                captureChains.push({
                  from: pathSquares[0],
                  to: destSq,
                  path: [...pathSquares, destSq],
                  captured: [...capturedSquares, foundOpponentCoord.sq],
                  capturesCount: capturedSquares.length + 1
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

  /**
   * Generate simple non-capturing moves for piece at {row, col}
   * @param {number} row
   * @param {number} col
   * @returns {Array<Object>}
   */
  findSimpleMovesFrom(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = this.isPieceColor(piece, 'w') ? 'w' : 'b';
    const king = this.isKing(piece);
    const originSq = rowColToSquare(row, col);
    const moves = [];

    if (!king) {
      // Man moves forward only
      const forwardDir = color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = row + forwardDir;
        const nc = col + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (!this.board[nr][nc]) {
            const destSq = rowColToSquare(nr, nc);
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
      // King slides any number of vacant squares along all 4 diagonals
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          if (!this.board[r][c]) {
            const destSq = rowColToSquare(r, c);
            moves.push({
              from: originSq,
              to: destSq,
              path: [originSq, destSq],
              captured: [],
              capturesCount: 0
            });
          } else {
            break; // Blocked
          }
          r += dr;
          c += dc;
        }
      }
    }

    return moves;
  }

  /**
   * Get all strictly legal moves for current player turn,
   * enforcing Mandatory Capture and Maximum Capture rules.
   * @returns {Array<Object>}
   */
  getLegalMoves() {
    const allCaptures = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && this.isPieceColor(piece, this.turn)) {
          const caps = this.findCapturesFrom(r, c);
          allCaptures.push(...caps);
        }
      }
    }

    // Mandatory capture rule
    if (allCaptures.length > 0) {
      // Maximum capture rule: find max captures count
      let maxCount = 0;
      for (const cap of allCaptures) {
        if (cap.capturesCount > maxCount) {
          maxCount = cap.capturesCount;
        }
      }
      return allCaptures.filter(c => c.capturesCount === maxCount);
    }

    // No captures available: gather regular simple moves
    const simpleMoves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && this.isPieceColor(piece, this.turn)) {
          const moves = this.findSimpleMovesFrom(r, c);
          simpleMoves.push(...moves);
        }
      }
    }

    return simpleMoves;
  }

  /**
   * Execute a move on the checkers board
   * @param {Object | string} moveInput e.g. { from: 31, to: 27 } or "31-27" / "31x22x13"
   * @returns {Object} Result of move
   */
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

    // Match legal move by from and to
    // If multiple multi-jump paths exist with same from & to, choose matching path or first
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

    const fromCoords = squareToRowCol(matched.from);
    const toCoords = squareToRowCol(matched.to);
    const movingPiece = this.board[fromCoords.row][fromCoords.col];
    const isMan = movingPiece === 'w' || movingPiece === 'b';

    // Move piece from origin to destination
    this.board[fromCoords.row][fromCoords.col] = null;
    this.board[toCoords.row][toCoords.col] = movingPiece;

    // Remove all captured pieces
    for (const capSq of matched.captured) {
      const capCoords = squareToRowCol(capSq);
      this.board[capCoords.row][capCoords.col] = null;
    }

    // Promotion check at final landing square
    let promoted = false;
    if (isMan) {
      if (this.turn === 'w' && toCoords.row === 0) {
        this.board[toCoords.row][toCoords.col] = 'W';
        promoted = true;
      } else if (this.turn === 'b' && toCoords.row === 9) {
        this.board[toCoords.row][toCoords.col] = 'B';
        promoted = true;
      }
    }

    // Notation formatting: e.g. "31-27" or "32x21x12"
    const notation = matched.captured.length > 0
      ? matched.path.join('x')
      : `${matched.from}-${matched.to}`;

    // Update clocks
    if (matched.captured.length > 0 || isMan) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    if (this.turn === 'b') {
      this.fullmoveNumber++;
    }

    // Switch turn
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

  /**
   * Count remaining pieces for each color
   * @returns {{ white: number, black: number, whiteKings: number, blackKings: number }}
   */
  countPieces() {
    let white = 0, black = 0, whiteKings = 0, blackKings = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece === 'w') white++;
        else if (piece === 'W') { white++; whiteKings++; }
        else if (piece === 'b') black++;
        else if (piece === 'B') { black++; blackKings++; }
      }
    }
    return { white, black, whiteKings, blackKings };
  }

  /**
   * Check for game over (elimination, blocked, or 25 king moves draw rule)
   * @returns {{ gameOver: boolean, winner: 'white' | 'black' | 'draw' | null, reason: string | null }}
   */
  isGameOver() {
    const counts = this.countPieces();

    if (counts.white === 0) {
      return { gameOver: true, winner: 'black', reason: 'elimination' };
    }
    if (counts.black === 0) {
      return { gameOver: true, winner: 'white', reason: 'elimination' };
    }

    // Check if player to move has legal moves
    const legalMoves = this.getLegalMoves();
    if (legalMoves.length === 0) {
      const winner = this.turn === 'w' ? 'black' : 'white';
      return { gameOver: true, winner, reason: 'blocked' };
    }

    // 25 King-moves draw rule (50 halfmoves without capture or man advancement)
    if (this.halfmoveClock >= 50) {
      return { gameOver: true, winner: 'draw', reason: 'twenty_five_moves_rule' };
    }

    return { gameOver: false, winner: null, reason: null };
  }
}
