import { CHESS_SVGS } from '../assets/pieces.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export class ChessBoardUI {
  constructor(containerElement, { orientation = 'white', onMove = null } = {}) {
    this.container = containerElement;
    this.orientation = orientation; // 'white' or 'black'
    this.onMove = onMove;
    this.selectedSquare = null;
    this.validMoves = [];
    this.boardState = null; // 8x8 array of pieces
    this.lastMove = null; // { from: 'e2', to: 'e4' }
    this.checkSquare = null; // 'e1'
    this.pendingPromotion = null; // { from, to }

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="chessboard-wrapper">
        <div class="chessboard chess-8x8" id="chessboard-grid"></div>
        <div class="promotion-modal hidden" id="chess-promotion-modal">
          <div class="promotion-title">Promote Pawn</div>
          <div class="promotion-choices" id="promotion-choices"></div>
        </div>
      </div>
    `;

    this.grid = this.container.querySelector('#chessboard-grid');
    this.promoModal = this.container.querySelector('#chess-promotion-modal');
    this.promoChoices = this.container.querySelector('#promotion-choices');

    this.render();
  }

  setOrientation(color) {
    this.orientation = color === 'black' ? 'black' : 'white';
    this.render();
  }

  loadFEN(fen) {
    const parts = fen.trim().split(' ');
    const rows = parts[0].split('/');
    this.boardState = Array(8).fill(null).map(() => Array(8).fill(null));

    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const char of rows[r]) {
        if (/\d/.test(char)) {
          c += parseInt(char, 10);
        } else {
          this.boardState[r][c] = char;
          c++;
        }
      }
    }

    this.turn = parts[1] || 'w';
    this.render();
  }

  setLastMove(from, to) {
    this.lastMove = from && to ? { from, to } : null;
    this.renderHighlights();
  }

  setCheckSquare(sq) {
    this.checkSquare = sq;
    this.renderHighlights();
  }

  setValidMoves(moves) {
    this.validMoves = moves || [];
    this.renderHighlights();
  }

  squareToCoords(sq) {
    if (!sq || sq.length !== 2) return null;
    const col = FILES.indexOf(sq[0].toLowerCase());
    const rank = parseInt(sq[1], 10);
    return { row: 8 - rank, col };
  }

  coordsToSquare(r, c) {
    return `${FILES[c]}${8 - r}`;
  }

  render() {
    this.grid.innerHTML = '';

    const isWhite = this.orientation === 'white';
    const rowRange = isWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const colRange = isWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    for (const r of rowRange) {
      for (const c of colRange) {
        const sq = this.coordsToSquare(r, c);
        const isDark = (r + c) % 2 === 1;

        const cell = document.createElement('div');
        cell.className = `board-cell ${isDark ? 'dark' : 'light'}`;
        cell.dataset.square = sq;
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Render coordinate labels
        if ((isWhite && c === 0) || (!isWhite && c === 7)) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'cell-label rank-label';
          rankLabel.textContent = 8 - r;
          cell.appendChild(rankLabel);
        }
        if ((isWhite && r === 7) || (!isWhite && r === 0)) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'cell-label file-label';
          fileLabel.textContent = FILES[c];
          cell.appendChild(fileLabel);
        }

        // Render piece
        const piece = this.boardState ? this.boardState[r][c] : null;
        if (piece && CHESS_SVGS[piece]) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'chess-piece';
          pieceEl.innerHTML = CHESS_SVGS[piece];
          cell.appendChild(pieceEl);
        }

        cell.addEventListener('click', () => this.handleCellClick(sq, r, c));
        this.grid.appendChild(cell);
      }
    }

    this.renderHighlights();
  }

  renderHighlights() {
    const cells = this.grid.querySelectorAll('.board-cell');
    cells.forEach(cell => {
      cell.classList.remove('selected', 'last-move', 'in-check', 'valid-dest', 'valid-capture');
      const dot = cell.querySelector('.move-indicator');
      if (dot) dot.remove();

      const sq = cell.dataset.square;

      if (this.selectedSquare === sq) {
        cell.classList.add('selected');
      }

      if (this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq)) {
        cell.classList.add('last-move');
      }

      if (this.checkSquare === sq) {
        cell.classList.add('in-check');
      }

      // Valid move hints
      const targetMove = this.validMoves.find(m => m.to === sq);
      if (targetMove) {
        const coords = this.squareToCoords(sq);
        const hasPiece = this.boardState && this.boardState[coords.row][coords.col];
        const indicator = document.createElement('div');
        indicator.className = `move-indicator ${hasPiece ? 'capture-ring' : 'dest-dot'}`;
        cell.appendChild(indicator);
      }
    });
  }

  handleCellClick(sq, r, c) {
    // 1. If clicking a valid destination for currently selected piece
    if (this.selectedSquare && this.validMoves.some(m => m.to === sq)) {
      const selectedCoords = this.squareToCoords(this.selectedSquare);
      const piece = this.boardState[selectedCoords.row][selectedCoords.col];
      const isPawn = piece && piece.toUpperCase() === 'P';
      const isPromotionRow = (this.orientation === 'white' && r === 0) || (this.orientation === 'black' && r === 7);

      if (isPawn && isPromotionRow) {
        this.promptPromotion(this.selectedSquare, sq);
        return;
      }

      this.executeMove(this.selectedSquare, sq);
      this.selectedSquare = null;
      this.validMoves = [];
      this.renderHighlights();
      return;
    }

    // Deselect if clicked the same square
    if (this.selectedSquare === sq) {
      this.selectedSquare = null;
      this.validMoves = [];
      this.renderHighlights();
      return;
    }

    // 2. If clicking a piece: check if it has valid legal moves
    const clickedPiece = this.boardState ? this.boardState[r][c] : null;
    if (clickedPiece && this.onSelectSquare) {
      const candidateMoves = this.onSelectSquare(sq) || [];
      if (candidateMoves.length > 0) {
        this.selectedSquare = sq;
        this.validMoves = candidateMoves;
        this.renderHighlights();
        return;
      }
    }

    // 3. Clicking empty square or piece with no legal moves: clear selection
    this.selectedSquare = null;
    this.validMoves = [];
    this.renderHighlights();
  }

  promptPromotion(from, to) {
    this.pendingPromotion = { from, to };
    this.promoChoices.innerHTML = '';

    const pieces = this.orientation === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
    for (const p of pieces) {
      const btn = document.createElement('div');
      btn.className = 'promotion-btn';
      btn.innerHTML = CHESS_SVGS[p];
      btn.addEventListener('click', () => {
        this.promoModal.classList.add('hidden');
        this.executeMove(from, to, p.toLowerCase());
        this.pendingPromotion = null;
      });
      this.promoChoices.appendChild(btn);
    }

    this.promoModal.classList.remove('hidden');
  }

  executeMove(from, to, promotion = undefined) {
    if (this.onMove) {
      this.onMove({ from, to, promotion });
    }
  }
}
