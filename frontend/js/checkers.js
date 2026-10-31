import { CHECKERS_SVGS } from '../assets/pieces.js';

const BOARD_SIZE = 10;
const TOTAL_SQUARES = 50;

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

export class CheckersBoardUI {
  constructor(containerElement, { orientation = 'white', onMove = null } = {}) {
    this.container = containerElement;
    this.orientation = orientation; // 'white' or 'black'
    this.onMove = onMove;
    this.selectedSquare = null;
    this.validMoves = [];
    this.stateString = null; // 50-char string
    this.boardMatrix = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.lastMove = null;

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="checkers-board-wrapper">
        <div class="chessboard checkers-10x10" id="checkers-grid"></div>
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
    this.stateString = stateString.replace(/[^bwBW.]/g, '');
    this.boardMatrix = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    for (let i = 1; i <= TOTAL_SQUARES; i++) {
      const char = this.stateString[i - 1];
      const coords = SQUARE_TO_COORDS[i];
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
    this.grid.innerHTML = '';

    const isWhite = this.orientation === 'white';
    const rowRange = isWhite
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      : [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    const colRange = isWhite
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      : [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

    for (const r of rowRange) {
      for (const c of colRange) {
        const isDark = (r + c) % 2 === 1;
        const sq = isDark ? COORDS_TO_SQUARE[`${r},${c}`] : null;

        const cell = document.createElement('div');
        cell.className = `checkers-cell ${isDark ? 'dark' : 'light'}`;
        if (sq) {
          cell.dataset.square = sq;
          cell.dataset.row = r;
          cell.dataset.col = c;

          // Square number badge for dark squares
          const numBadge = document.createElement('span');
          numBadge.className = 'checkers-sq-num';
          numBadge.textContent = sq;
          cell.appendChild(numBadge);

          // Render checkers piece
          const piece = this.boardMatrix[r][c];
          if (piece && CHECKERS_SVGS[piece]) {
            const pieceEl = document.createElement('div');
            pieceEl.className = 'checkers-piece';
            pieceEl.innerHTML = CHECKERS_SVGS[piece];
            cell.appendChild(pieceEl);
          }

          cell.addEventListener('click', () => this.handleCellClick(sq, r, c));
        }

        this.grid.appendChild(cell);
      }
    }

    this.renderHighlights();
  }

  renderHighlights() {
    const cells = this.grid.querySelectorAll('.checkers-cell');
    cells.forEach(cell => {
      cell.classList.remove('selected', 'last-move');
      const dot = cell.querySelector('.move-indicator');
      if (dot) dot.remove();

      const sq = parseInt(cell.dataset.square, 10);
      if (!sq) return;

      if (this.selectedSquare === sq) {
        cell.classList.add('selected');
      }

      if (this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq)) {
        cell.classList.add('last-move');
      }

      const matchingMove = this.validMoves.find(m => m.to === sq);
      if (matchingMove) {
        const isCap = matchingMove.captured && matchingMove.captured.length > 0;
        const indicator = document.createElement('div');
        indicator.className = `move-indicator ${isCap ? 'capture-ring' : 'dest-dot'}`;
        cell.appendChild(indicator);
      }
    });
  }

  handleCellClick(sq, r, c) {
    const piece = this.boardMatrix[r][c];
    const isPlayerPiece = piece && (
      (this.orientation === 'white' && (piece === 'w' || piece === 'W')) ||
      (this.orientation === 'black' && (piece === 'b' || piece === 'B'))
    );

    // 1. If clicking a valid destination for selected piece
    const matchingMove = this.validMoves.find(m => m.to === sq);
    if (this.selectedSquare && matchingMove) {
      if (this.onMove) {
        this.onMove(matchingMove);
      }
      this.selectedSquare = null;
      this.validMoves = [];
      this.renderHighlights();
      return;
    }

    // 2. If clicking own piece
    if (isPlayerPiece) {
      if (this.selectedSquare === sq) {
        this.selectedSquare = null;
        this.validMoves = [];
      } else {
        this.selectedSquare = sq;
        if (this.onSelectSquare) {
          this.validMoves = this.onSelectSquare(sq) || [];
        }
      }
      this.renderHighlights();
      return;
    }

    // 3. Clear selection
    this.selectedSquare = null;
    this.validMoves = [];
    this.renderHighlights();
  }
}
