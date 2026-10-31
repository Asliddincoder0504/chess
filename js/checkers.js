import { CHECKERS_SVGS } from '../assets/pieces.js';

// Precompute 10x10 coordinate mappings
const SQUARES_10 = {};
const COORDS_10 = {};
let sq10 = 1;
for (let r = 0; r < 10; r++) {
  for (let c = 0; c < 10; c++) {
    if ((r + c) % 2 === 1) {
      SQUARES_10[sq10] = { row: r, col: c };
      COORDS_10[`${r},${c}`] = sq10;
      sq10++;
    }
  }
}

// Precompute 8x8 coordinate mappings
const SQUARES_8 = {};
const COORDS_8 = {};
let sq8 = 1;
for (let r = 0; r < 8; r++) {
  for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 1) {
      SQUARES_8[sq8] = { row: r, col: c };
      COORDS_8[`${r},${c}`] = sq8;
      sq8++;
    }
  }
}

export class CheckersBoardUI {
  constructor(containerElement, { orientation = 'white', onMove = null, onSelectSquare = null, size = 10 } = {}) {
    this.container = containerElement;
    this.orientation = orientation;
    this.onMove = onMove;
    this.onSelectSquare = onSelectSquare;
    this.size = size;
    this.totalSquares = size === 8 ? 32 : 50;
    this.selectedSquare = null;
    this.validMoves = [];
    this.stateString = null;
    this.boardMatrix = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
    this.lastMove = null;

    this.initDOM();
  }

  getSqCoords(sq) {
    const map = this.size === 8 ? SQUARES_8 : SQUARES_10;
    return map[sq] || null;
  }

  getCoordsSq(r, c) {
    const map = this.size === 8 ? COORDS_8 : COORDS_10;
    return map[`${r},${c}`] || null;
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="checkers-board-wrapper">
        <div class="chessboard ${this.size === 8 ? 'checkers-8x8' : 'checkers-10x10'}" id="checkers-grid"></div>
      </div>
    `;
    this.grid = this.container.querySelector('#checkers-grid');
    this.render();
  }

  setOrientation(color) {
    this.orientation = color === 'black' ? 'black' : 'white';
    this.render();
  }

  loadState(stateString) {
    const clean = (stateString || '').replace(/[^bwBW.]/g, '');
    this.stateString = clean;

    const detectedSize = clean.length === 32 ? 8 : 10;
    if (this.size !== detectedSize) {
      this.size = detectedSize;
      this.totalSquares = this.size === 8 ? 32 : 50;
      if (this.grid) {
        this.grid.className = `chessboard ${this.size === 8 ? 'checkers-8x8' : 'checkers-10x10'}`;
      }
    }

    this.boardMatrix = Array(this.size).fill(null).map(() => Array(this.size).fill(null));

    for (let i = 1; i <= this.totalSquares; i++) {
      const char = this.stateString[i - 1];
      const coords = this.getSqCoords(i);
      if (char !== '.' && coords) {
        this.boardMatrix[coords.row][coords.col] = char;
      }
    }

    this.render();
  }

  setLastMove(from, to) {
    this.lastMove = from && to ? { from, to } : null;
    this.renderHighlights();
  }

  setValidMoves(moves) {
    this.validMoves = moves || [];
    this.renderHighlights();
  }

  render() {
    if (!this.grid) return;
    this.grid.innerHTML = '';
    this.grid.className = `chessboard ${this.size === 8 ? 'checkers-8x8' : 'checkers-10x10'}`;

    const isWhite = this.orientation === 'white';
    const rowRange = [];
    const colRange = [];

    for (let i = 0; i < this.size; i++) {
      rowRange.push(isWhite ? i : this.size - 1 - i);
      colRange.push(isWhite ? i : this.size - 1 - i);
    }

    for (const r of rowRange) {
      for (const c of colRange) {
        const isDark = (r + c) % 2 === 1;
        const sq = isDark ? this.getCoordsSq(r, c) : null;

        const cell = document.createElement('div');
        cell.className = `checkers-cell ${isDark ? 'dark' : 'light'}`;
        if (sq) {
          cell.dataset.square = sq;
          cell.dataset.row = r;
          cell.dataset.col = c;

          const numBadge = document.createElement('span');
          numBadge.className = 'checkers-sq-num';
          numBadge.textContent = sq;
          cell.appendChild(numBadge);

          const pieceChar = this.boardMatrix[r]?.[c];
          if (pieceChar && CHECKERS_SVGS[pieceChar]) {
            const pieceEl = document.createElement('div');
            pieceEl.className = `checkers-piece piece-${pieceChar.toLowerCase()} ${pieceChar === pieceChar.toUpperCase() ? 'is-king' : ''}`;
            pieceEl.innerHTML = CHECKERS_SVGS[pieceChar];
            cell.appendChild(pieceEl);
          }

          cell.addEventListener('click', (e) => this.handleCellClick(sq, r, c, e));
        }

        this.grid.appendChild(cell);
      }
    }

    this.renderHighlights();
  }

  handleCellClick(sq, row, col, event) {
    const piece = this.boardMatrix[row]?.[col];
    const playerColor = this.orientation === 'white' ? 'w' : 'b';
    const isOwnPiece = piece && (playerColor === 'w' ? (piece === 'w' || piece === 'W') : (piece === 'b' || piece === 'B'));

    // 1. If currently a piece is selected and player clicks a destination square
    if (this.selectedSquare !== null) {
      const numSel = Number(this.selectedSquare);
      const numSq = Number(sq);

      const matchedMove = this.validMoves.find(m => Number(m.from) === numSel && Number(m.to) === numSq);
      if (matchedMove) {
        const from = numSel;
        this.selectedSquare = null;
        this.validMoves = [];
        this.renderHighlights();
        if (typeof this.onMove === 'function') {
          this.onMove({
            from,
            to: numSq,
            path: matchedMove.path,
            captured: matchedMove.captured
          });
        }
        return;
      }

      // If clicked the same selected piece again: deselect
      if (numSel === numSq) {
        this.selectedSquare = null;
        this.validMoves = [];
        this.renderHighlights();
        return;
      }
    }

    // 2. If clicking an own piece: select it and calculate its valid moves
    if (isOwnPiece) {
      this.selectedSquare = Number(sq);
      if (typeof this.onSelectSquare === 'function') {
        this.validMoves = this.onSelectSquare(this.selectedSquare) || [];
      } else {
        this.validMoves = [];
      }
      this.renderHighlights();
      return;
    }

    // 3. Clicked empty square or opponent piece with no valid move: clear selection
    this.selectedSquare = null;
    this.validMoves = [];
    this.renderHighlights();
  }

  renderHighlights() {
    if (!this.grid) return;

    this.grid.querySelectorAll('.checkers-cell').forEach(cell => {
      cell.classList.remove('selected', 'valid-dest', 'capture-dest', 'last-move');
      const dot = cell.querySelector('.move-indicator');
      if (dot) dot.remove();
    });

    if (this.lastMove) {
      const fromEl = this.grid.querySelector(`[data-square="${this.lastMove.from}"]`);
      const toEl = this.grid.querySelector(`[data-square="${this.lastMove.to}"]`);
      if (fromEl) fromEl.classList.add('last-move');
      if (toEl) toEl.classList.add('last-move');
    }

    if (this.selectedSquare !== null) {
      const selEl = this.grid.querySelector(`[data-square="${this.selectedSquare}"]`);
      if (selEl) selEl.classList.add('selected');

      const dests = this.validMoves.filter(m => Number(m.from) === Number(this.selectedSquare));
      for (const move of dests) {
        const destEl = this.grid.querySelector(`[data-square="${move.to}"]`);
        if (destEl) {
          const isCapture = move.captured && move.captured.length > 0;
          destEl.classList.add(isCapture ? 'capture-dest' : 'valid-dest');

          const indicator = document.createElement('div');
          indicator.className = `move-indicator ${isCapture ? 'capture-ring' : 'dest-dot'}`;
          destEl.appendChild(indicator);
        }
      }
    }
  }

  clearSelection() {
    this.selectedSquare = null;
    this.validMoves = [];
    this.renderHighlights();
  }
}
