/**
 * WellChess Pure JavaScript Authoritative Chess Engine
 * Implements complete standard FIDE chess rules:
 * - 8x8 board representation
 * - Legal move generation and validation
 * - Check, Checkmate, and Stalemate detection
 * - Castling (Kingside and Queenside) with check-path validation
 * - En passant captures and tracking
 * - Pawn promotions (Queen, Rook, Bishop, Knight)
 * - Fifty-move rule (100 half-moves)
 * - Threefold repetition detection
 * - Insufficient material draws
 * - Full FEN parsing and serialization
 */

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_SYMBOLS = {
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King',
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * Convert algebraic coordinate ('e4') to { row, col } (0-indexed: row 0=rank 8, row 7=rank 1)
 */
export function squareToCoords(square) {
  if (!square || square.length !== 2) return null;
  const col = FILES.indexOf(square[0].toLowerCase());
  const rank = parseInt(square[1], 10);
  if (col === -1 || isNaN(rank) || rank < 1 || rank > 8) return null;
  return { row: 8 - rank, col };
}

/**
 * Convert { row, col } to algebraic coordinate ('e4')
 */
export function coordsToSquare(row, col) {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return `${FILES[col]}${8 - row}`;
}

export class ChessGame {
  /**
   * @param {string} [fen] FEN string (defaults to standard starting position)
   */
  constructor(fen = INITIAL_FEN) {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = 'w'; // 'w' or 'b'
    this.castling = { K: true, Q: true, k: true, q: true };
    this.enPassant = '-'; // e.g., 'e3' or '-'
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.positionHistory = [];
    this.loadFEN(fen);
  }

  /**
   * Load board state from FEN
   * @param {string} fen
   */
  loadFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) {
      throw new Error(`Invalid FEN string: ${fen}`);
    }

    const [placement, turn, castling, enPassant, halfmove, fullmove] = parts;

    // Reset board
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));

    const rows = placement.split('/');
    if (rows.length !== 8) {
      throw new Error(`Invalid FEN row count: ${rows.length}`);
    }

    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const char of rows[r]) {
        if (/\d/.test(char)) {
          c += parseInt(char, 10);
        } else {
          if (c >= 8) throw new Error(`FEN row ${r} exceeds 8 columns`);
          this.board[r][c] = char;
          c++;
        }
      }
      if (c !== 8) throw new Error(`FEN row ${r} does not equal 8 columns (got ${c})`);
    }

    this.turn = turn.toLowerCase() === 'b' ? 'b' : 'w';

    this.castling = {
      K: castling.includes('K'),
      Q: castling.includes('Q'),
      k: castling.includes('k'),
      q: castling.includes('q')
    };

    this.enPassant = enPassant && enPassant !== '-' ? enPassant.toLowerCase() : '-';
    this.halfmoveClock = halfmove ? parseInt(halfmove, 10) : 0;
    this.fullmoveNumber = fullmove ? parseInt(fullmove, 10) : 1;

    this.positionHistory = [this.getPositionKey()];
  }

  /**
   * Export current state to standard FEN
   * @returns {string}
   */
  toFEN() {
    let placement = '';
    for (let r = 0; r < 8; r++) {
      let emptyCount = 0;
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            placement += emptyCount;
            emptyCount = 0;
          }
          placement += piece;
        }
      }
      if (emptyCount > 0) placement += emptyCount;
      if (r < 7) placement += '/';
    }

    let castlingStr = '';
    if (this.castling.K) castlingStr += 'K';
    if (this.castling.Q) castlingStr += 'Q';
    if (this.castling.k) castlingStr += 'k';
    if (this.castling.q) castlingStr += 'q';
    if (!castlingStr) castlingStr = '-';

    return `${placement} ${this.turn} ${castlingStr} ${this.enPassant} ${this.halfmoveClock} ${this.fullmoveNumber}`;
  }

  /**
   * Unique position key used for 3-fold repetition check
   */
  getPositionKey() {
    const fen = this.toFEN();
    const parts = fen.split(' ');
    // Position key comprises: placement, turn, castling rights, and en passant target
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
  }

  /**
   * Clone current game state
   * @returns {ChessGame}
   */
  clone() {
    const next = new ChessGame(this.toFEN());
    next.positionHistory = [...this.positionHistory];
    return next;
  }

  /**
   * Check if a piece at {row, col} belongs to the specified color ('w' or 'b')
   */
  isColor(piece, color) {
    if (!piece) return false;
    return color === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
  }

  getPieceColor(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? 'w' : 'b';
  }

  /**
   * Find king position for a given color
   * @param {'w' | 'b'} color
   * @returns {{ row: number, col: number } | null}
   */
  findKing(color) {
    const target = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === target) return { row: r, col: c };
      }
    }
    return null;
  }

  /**
   * Check if square {row, col} is attacked by opponent of `byColor`
   * @param {number} row
   * @param {number} col
   * @param {'w' | 'b'} byColor The attacking color
   * @returns {boolean}
   */
  isSquareAttacked(row, col, byColor) {
    const enemyPawn = byColor === 'w' ? 'P' : 'p';
    const enemyKnight = byColor === 'w' ? 'N' : 'n';
    const enemyBishop = byColor === 'w' ? 'B' : 'b';
    const enemyRook = byColor === 'w' ? 'R' : 'r';
    const enemyQueen = byColor === 'w' ? 'Q' : 'q';
    const enemyKing = byColor === 'w' ? 'K' : 'k';

    // 1. Pawn attacks
    const pawnRowOffset = byColor === 'w' ? 1 : -1;
    const pRow = row + pawnRowOffset;
    if (pRow >= 0 && pRow < 8) {
      if (col - 1 >= 0 && this.board[pRow][col - 1] === enemyPawn) return true;
      if (col + 1 < 8 && this.board[pRow][col + 1] === enemyPawn) return true;
    }

    // 2. Knight attacks
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        if (this.board[nr][nc] === enemyKnight) return true;
      }
    }

    // 3. Straight rays (Rook & Queen)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of straightDirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const piece = this.board[r][c];
        if (piece) {
          if (piece === enemyRook || piece === enemyQueen) return true;
          break; // Ray blocked
        }
        r += dr;
        c += dc;
      }
    }

    // 4. Diagonal rays (Bishop & Queen)
    const diagonalDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagonalDirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const piece = this.board[r][c];
        if (piece) {
          if (piece === enemyBishop || piece === enemyQueen) return true;
          break; // Ray blocked
        }
        r += dr;
        c += dc;
      }
    }

    // 5. King attacks (adjacent 1 square)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (this.board[nr][nc] === enemyKing) return true;
        }
      }
    }

    return false;
  }

  /**
   * Is the king of `color` in check?
   * @param {'w' | 'b'} [color] Defaults to current turn
   * @returns {boolean}
   */
  inCheck(color = this.turn) {
    const king = this.findKing(color);
    if (!king) return false;
    const enemyColor = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(king.row, king.col, enemyColor);
  }

  /**
   * Generate pseudo-legal moves for piece at {row, col}
   * @param {number} row
   * @param {number} col
   * @returns {Array<Object>}
   */
  getPseudoMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];
    const color = this.getPieceColor(piece);
    if (color !== this.turn) return [];

    const type = piece.toUpperCase();
    const moves = [];
    const fromSquare = coordsToSquare(row, col);

    if (type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;

      // 1 square forward
      const fRow = row + dir;
      if (fRow >= 0 && fRow < 8 && !this.board[fRow][col]) {
        if (fRow === promoRow) {
          for (const promo of ['q', 'r', 'b', 'n']) {
            moves.push({ from: fromSquare, to: coordsToSquare(fRow, col), promotion: promo });
          }
        } else {
          moves.push({ from: fromSquare, to: coordsToSquare(fRow, col) });
          // 2 squares forward
          const doubleRow = row + 2 * dir;
          if (row === startRow && !this.board[doubleRow][col]) {
            moves.push({ from: fromSquare, to: coordsToSquare(doubleRow, col) });
          }
        }
      }

      // Captures (diagonal left & right)
      for (const dc of [-1, 1]) {
        const cCol = col + dc;
        if (cCol >= 0 && cCol < 8 && fRow >= 0 && fRow < 8) {
          const target = this.board[fRow][cCol];
          const toSquare = coordsToSquare(fRow, cCol);

          // Standard capture
          if (target && this.getPieceColor(target) !== color) {
            if (fRow === promoRow) {
              for (const promo of ['q', 'r', 'b', 'n']) {
                moves.push({ from: fromSquare, to: toSquare, promotion: promo, capture: target });
              }
            } else {
              moves.push({ from: fromSquare, to: toSquare, capture: target });
            }
          }

          // En passant capture
          if (this.enPassant && this.enPassant === toSquare) {
            const epPawnRow = row;
            const epPawn = this.board[epPawnRow][cCol];
            if (epPawn && this.getPieceColor(epPawn) !== color) {
              moves.push({ from: fromSquare, to: toSquare, isEnPassant: true, capture: epPawn });
            }
          }
        }
      }
    } else if (type === 'N') {
      const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of offsets) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = this.board[nr][nc];
          if (!target || this.getPieceColor(target) !== color) {
            moves.push({ from: fromSquare, to: coordsToSquare(nr, nc), capture: target || undefined });
          }
        }
      }
    } else if (type === 'B' || type === 'R' || type === 'Q') {
      const dirs = [];
      if (type === 'B' || type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if (type === 'R' || type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

      for (const [dr, dc] of dirs) {
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = this.board[r][c];
          if (!target) {
            moves.push({ from: fromSquare, to: coordsToSquare(r, c) });
          } else {
            if (this.getPieceColor(target) !== color) {
              moves.push({ from: fromSquare, to: coordsToSquare(r, c), capture: target });
            }
            break;
          }
          r += dr;
          c += dc;
        }
      }
    } else if (type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const target = this.board[nr][nc];
            if (!target || this.getPieceColor(target) !== color) {
              moves.push({ from: fromSquare, to: coordsToSquare(nr, nc), capture: target || undefined });
            }
          }
        }
      }

      // Castling
      const enemy = color === 'w' ? 'b' : 'w';
      if (color === 'w' && row === 7 && col === 4) {
        // Kingside castling (O-O: e1 -> g1)
        if (this.castling.K &&
            !this.board[7][5] && !this.board[7][6] &&
            this.board[7][7] === 'R' &&
            !this.inCheck('w') &&
            !this.isSquareAttacked(7, 5, enemy) &&
            !this.isSquareAttacked(7, 6, enemy)) {
          moves.push({ from: 'e1', to: 'g1', isCastling: 'K' });
        }
        // Queenside castling (O-O-O: e1 -> c1)
        if (this.castling.Q &&
            !this.board[7][3] && !this.board[7][2] && !this.board[7][1] &&
            this.board[7][0] === 'R' &&
            !this.inCheck('w') &&
            !this.isSquareAttacked(7, 3, enemy) &&
            !this.isSquareAttacked(7, 2, enemy)) {
          moves.push({ from: 'e1', to: 'c1', isCastling: 'Q' });
        }
      } else if (color === 'b' && row === 0 && col === 4) {
        // Kingside castling (O-O: e8 -> g8)
        if (this.castling.k &&
            !this.board[0][5] && !this.board[0][6] &&
            this.board[0][7] === 'r' &&
            !this.inCheck('b') &&
            !this.isSquareAttacked(0, 5, enemy) &&
            !this.isSquareAttacked(0, 6, enemy)) {
          moves.push({ from: 'e8', to: 'g8', isCastling: 'k' });
        }
        // Queenside castling (O-O-O: e8 -> c8)
        if (this.castling.q &&
            !this.board[0][3] && !this.board[0][2] && !this.board[0][1] &&
            this.board[0][0] === 'r' &&
            !this.inCheck('b') &&
            !this.isSquareAttacked(0, 3, enemy) &&
            !this.isSquareAttacked(0, 2, enemy)) {
          moves.push({ from: 'e8', to: 'c8', isCastling: 'q' });
        }
      }
    }

    return moves;
  }

  /**
   * Apply move tentatively on a board matrix to test king safety
   */
  makeMoveUnchecked(move) {
    const from = squareToCoords(move.from);
    const to = squareToCoords(move.to);
    const piece = this.board[from.row][from.col];
    const isPawn = piece && piece.toUpperCase() === 'P';

    // Move piece
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    // Handle En Passant capture removal
    if (move.isEnPassant) {
      const epRow = from.row;
      const epCol = to.col;
      this.board[epRow][epCol] = null;
    }

    // Handle Castling rook movement
    if (move.isCastling) {
      if (move.isCastling === 'K') { // White kingside
        this.board[7][5] = 'R';
        this.board[7][7] = null;
      } else if (move.isCastling === 'Q') { // White queenside
        this.board[7][3] = 'R';
        this.board[7][0] = null;
      } else if (move.isCastling === 'k') { // Black kingside
        this.board[0][5] = 'r';
        this.board[0][7] = null;
      } else if (move.isCastling === 'q') { // Black queenside
        this.board[0][3] = 'r';
        this.board[0][0] = null;
      }
    }

    // Handle Promotion
    if (move.promotion) {
      const promoPiece = this.turn === 'w' ? move.promotion.toUpperCase() : move.promotion.toLowerCase();
      this.board[to.row][to.col] = promoPiece;
    }

    return piece;
  }

  /**
   * Test if a pseudo-legal move leaves the king in check
   */
  isMoveLegal(move) {
    const clone = this.clone();
    clone.makeMoveUnchecked(move);
    return !clone.inCheck(this.turn);
  }

  /**
   * Generate all strictly legal moves in the current position
   * @returns {Array<Object>}
   */
  getLegalMoves() {
    const legalMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.getPieceColor(piece) === this.turn) {
          const pseudo = this.getPseudoMoves(r, c);
          for (const m of pseudo) {
            if (this.isMoveLegal(m)) {
              legalMoves.push(m);
            }
          }
        }
      }
    }
    return legalMoves;
  }

  /**
   * Execute a move on the game state
   * @param {string | Object} moveInput e.g. "e2e4" or { from: 'e2', to: 'e4', promotion: 'q' }
   * @returns {Object} Move result details
   */
  makeMove(moveInput) {
    if (this.isGameOver().gameOver) {
      throw new Error('Cannot make a move in a finished game');
    }

    let moveObj = null;
    if (typeof moveInput === 'string') {
      const clean = moveInput.trim().toLowerCase();
      const from = clean.slice(0, 2);
      const to = clean.slice(2, 4);
      const promotion = clean.length > 4 ? clean[4] : undefined;
      moveObj = { from, to, promotion };
    } else {
      moveObj = {
        from: moveInput.from.toLowerCase(),
        to: moveInput.to.toLowerCase(),
        promotion: moveInput.promotion ? moveInput.promotion.toLowerCase() : undefined
      };
    }

    // Find matching legal move
    const legalMoves = this.getLegalMoves();
    const matchedMove = legalMoves.find(m => {
      if (m.from !== moveObj.from || m.to !== moveObj.to) return false;
      if (m.promotion && moveObj.promotion) {
        return m.promotion.toLowerCase() === moveObj.promotion.toLowerCase();
      }
      // If move requires promotion but client didn't supply it, default to queen
      if (m.promotion && !moveObj.promotion) {
        return m.promotion.toLowerCase() === 'q';
      }
      return true;
    });

    if (!matchedMove) {
      throw new Error(`Illegal chess move: ${moveObj.from}->${moveObj.to}${moveObj.promotion ? `(${moveObj.promotion})` : ''}`);
    }

    // Actual execution
    const fromCoords = squareToCoords(matchedMove.from);
    const toCoords = squareToCoords(matchedMove.to);
    const piece = this.board[fromCoords.row][fromCoords.col];
    const isPawn = piece.toUpperCase() === 'P';
    const isCapture = Boolean(matchedMove.capture || this.board[toCoords.row][toCoords.col]);

    // Apply board change
    this.makeMoveUnchecked(matchedMove);

    // Update Castling rights
    if (piece === 'K') {
      this.castling.K = false;
      this.castling.Q = false;
    } else if (piece === 'k') {
      this.castling.k = false;
      this.castling.q = false;
    } else if (piece === 'R') {
      if (matchedMove.from === 'h1') this.castling.K = false;
      if (matchedMove.from === 'a1') this.castling.Q = false;
    } else if (piece === 'r') {
      if (matchedMove.from === 'h8') this.castling.k = false;
      if (matchedMove.from === 'a8') this.castling.q = false;
    }

    // If opponent rook is captured in corner, revoke opponent castling
    if (matchedMove.to === 'h8') this.castling.k = false;
    if (matchedMove.to === 'a8') this.castling.q = false;
    if (matchedMove.to === 'h1') this.castling.K = false;
    if (matchedMove.to === 'a1') this.castling.Q = false;

    // Update En Passant square
    if (isPawn && Math.abs(fromCoords.row - toCoords.row) === 2) {
      const epRow = (fromCoords.row + toCoords.row) / 2;
      this.enPassant = coordsToSquare(epRow, fromCoords.col);
    } else {
      this.enPassant = '-';
    }

    // Halfmove clock (reset on pawn move or capture)
    if (isPawn || isCapture) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    // Fullmove number
    if (this.turn === 'b') {
      this.fullmoveNumber++;
    }

    // Switch turn
    this.turn = this.turn === 'w' ? 'b' : 'w';

    // Track position history
    this.positionHistory.push(this.getPositionKey());

    // Generate SAN notation
    const san = this.formatMoveNotation(matchedMove, piece, isCapture);

    const check = this.inCheck(this.turn);
    const gameOver = this.isGameOver();

    return {
      success: true,
      from: matchedMove.from,
      to: matchedMove.to,
      promotion: matchedMove.promotion,
      san,
      fen: this.toFEN(),
      inCheck: check,
      isCheckmate: this.isCheckmate(),
      isStalemate: this.isStalemate(),
      isDraw: this.isDraw(),
      gameOver: gameOver.gameOver,
      winner: gameOver.winner,
      winReason: gameOver.reason
    };
  }

  /**
   * Format move into Standard Algebraic Notation (SAN)
   */
  formatMoveNotation(move, piece, isCapture) {
    if (move.isCastling === 'K' || move.isCastling === 'k') return 'O-O';
    if (move.isCastling === 'Q' || move.isCastling === 'q') return 'O-O-O';

    const pType = piece.toUpperCase();
    let san = '';

    if (pType === 'P') {
      if (isCapture) {
        san += `${move.from[0]}x${move.to}`;
      } else {
        san += move.to;
      }
      if (move.promotion) {
        san += `=${move.promotion.toUpperCase()}`;
      }
    } else {
      san += pType;
      if (isCapture) san += 'x';
      san += move.to;
    }

    // Post-move check / checkmate indicator
    if (this.isCheckmate()) {
      san += '#';
    } else if (this.inCheck(this.turn)) {
      san += '+';
    }

    return san;
  }

  /**
   * Is current player in checkmate?
   * @returns {boolean}
   */
  isCheckmate() {
    return this.inCheck(this.turn) && this.getLegalMoves().length === 0;
  }

  /**
   * Is current player in stalemate?
   * @returns {boolean}
   */
  isStalemate() {
    return !this.inCheck(this.turn) && this.getLegalMoves().length === 0;
  }

  /**
   * Check for draw by fifty-move rule (100 half-moves)
   * @returns {boolean}
   */
  isFiftyMoveDraw() {
    return this.halfmoveClock >= 100;
  }

  /**
   * Check for threefold repetition
   * @returns {boolean}
   */
  isThreefoldRepetition() {
    const currentKey = this.getPositionKey();
    let count = 0;
    for (const key of this.positionHistory) {
      if (key === currentKey) count++;
      if (count >= 3) return true;
    }
    return false;
  }

  /**
   * Check for insufficient material:
   * - K vs K
   * - K+B vs K
   * - K+N vs K
   * - K+B vs K+B with same square color
   * @returns {boolean}
   */
  isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece) {
          pieces.push({ piece, row: r, col: c });
        }
      }
    }

    // King vs King
    if (pieces.length === 2) return true;

    // King + minor vs King
    if (pieces.length === 3) {
      const nonKings = pieces.filter(p => p.piece.toUpperCase() !== 'K');
      if (nonKings.length === 1) {
        const type = nonKings[0].piece.toUpperCase();
        if (type === 'B' || type === 'N') return true;
      }
    }

    // King + Bishop vs King + Bishop (same color bishops)
    if (pieces.length === 4) {
      const bishops = pieces.filter(p => p.piece.toUpperCase() === 'B');
      if (bishops.length === 2) {
        const color1 = this.getPieceColor(bishops[0].piece);
        const color2 = this.getPieceColor(bishops[1].piece);
        if (color1 !== color2) {
          const squareColor1 = (bishops[0].row + bishops[0].col) % 2;
          const squareColor2 = (bishops[1].row + bishops[1].col) % 2;
          if (squareColor1 === squareColor2) return true;
        }
      }
    }

    return false;
  }

  /**
   * General draw check
   */
  isDraw() {
    return (
      this.isStalemate() ||
      this.isFiftyMoveDraw() ||
      this.isThreefoldRepetition() ||
      this.isInsufficientMaterial()
    );
  }

  /**
   * Comprehensive Game Over evaluation
   * @returns {{ gameOver: boolean, winner: 'white' | 'black' | 'draw' | null, reason: string | null }}
   */
  isGameOver() {
    if (this.isCheckmate()) {
      const winner = this.turn === 'w' ? 'black' : 'white';
      return { gameOver: true, winner, reason: 'checkmate' };
    }
    if (this.isStalemate()) {
      return { gameOver: true, winner: 'draw', reason: 'stalemate' };
    }
    if (this.isFiftyMoveDraw()) {
      return { gameOver: true, winner: 'draw', reason: 'fifty_move_rule' };
    }
    if (this.isThreefoldRepetition()) {
      return { gameOver: true, winner: 'draw', reason: 'threefold_repetition' };
    }
    if (this.isInsufficientMaterial()) {
      return { gameOver: true, winner: 'draw', reason: 'insufficient_material' };
    }
    return { gameOver: false, winner: null, reason: null };
  }
}
