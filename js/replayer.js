import { ChessBoardUI } from './chess.js';
import { CheckersBoardUI } from './checkers.js';
import { ChessGame } from './engine-chess.js';
import { CheckersGame } from './engine-checkers.js';
import { sounds } from './game.js';

export class GameReplayer {
  constructor() {
    this.modal = document.getElementById('game-replay-modal');
    this.boardContainer = document.getElementById('replay-board-container');
    this.titleEl = document.getElementById('replay-title');
    this.subtitleEl = document.getElementById('replay-subtitle');
    this.stepLabel = document.getElementById('replay-step-label');
    this.currentMoveBadge = document.getElementById('replay-current-move-badge');
    this.movesListEl = document.getElementById('replay-moves-list');
    this.playBtn = document.getElementById('replay-btn-play');

    this.gameData = null;
    this.boardUI = null;
    this.moves = [];
    this.stepStates = [];
    this.currentStep = -1;
    this.isPlaying = false;
    this.playTimer = null;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = document.getElementById('close-replay-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const firstBtn = document.getElementById('replay-btn-first');
    if (firstBtn) {
      firstBtn.addEventListener('click', () => this.goToStep(-1));
    }

    const prevBtn = document.getElementById('replay-btn-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prev());
    }

    const nextBtn = document.getElementById('replay-btn-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.next());
    }

    const lastBtn = document.getElementById('replay-btn-last');
    if (lastBtn) {
      lastBtn.addEventListener('click', () => this.goToStep(this.moves.length - 1));
    }

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }
  }

  loadGame(game) {
    this.gameData = game;
    this.stopPlay();

    // Parse moves history
    let parsedHistory = [];
    try {
      if (Array.isArray(game.history)) {
        parsedHistory = game.history;
      } else if (typeof game.history === 'string' && game.history.trim()) {
        parsedHistory = JSON.parse(game.history);
      }
    } catch {
      parsedHistory = [];
    }

    this.moves = parsedHistory;

    // Header info
    const wName = game.whitePlayer?.firstName || (game.whiteId ? `O'yinchi #${game.whiteId}` : 'Oqlar');
    const bName = game.blackPlayer?.firstName || (game.blackId ? `O'yinchi #${game.blackId}` : 'Qoralar');
    const gTypeUz = game.gameType === 'checkers8' ? 'Shashka 8x8' : (game.gameType === 'checkers' ? 'Shashka 10x10' : 'Shaxmat');

    if (this.titleEl) {
      this.titleEl.textContent = `${gTypeUz} (${game.timeControl || '3+2'})`;
    }
    if (this.subtitleEl) {
      let outcome = 'Tugallangan';
      if (game.winner === 'white') outcome = `🏆 ${wName} g'alaba qozondi`;
      else if (game.winner === 'black') outcome = `🏆 ${bName} g'alaba qozondi`;
      else if (game.winner === 'draw') outcome = '🤝 Durang';
      this.subtitleEl.textContent = `${wName} (Oq) vs ${bName} (Qora) • ${outcome}`;
    }

    // Initialize initial state
    if (game.gameType === 'chess') {
      this.initialState = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    } else if (game.gameType === 'checkers8') {
      this.initialState = 'bbbbbbbbbbbb........wwwwwwwwwwww';
    } else {
      this.initialState = 'bbbbbbbbbbbbbbbbbbbb..........wwwwwwwwwwwwwwwwwwww';
    }

    // Precalculate all board states through engine simulation if needed
    this.computeAllStepStates();

    // Initialize board UI
    this.boardContainer.innerHTML = '';
    if (game.gameType === 'chess') {
      this.boardUI = new ChessBoardUI(this.boardContainer, { orientation: 'white', onMove: null });
    } else {
      const is8x8 = game.gameType === 'checkers8';
      this.boardUI = new CheckersBoardUI(this.boardContainer, {
        orientation: 'white',
        size: is8x8 ? 8 : 10,
        onMove: null
      });
    }

    // Render move notations
    this.renderMovesList();

    // Show modal
    this.modal.classList.remove('hidden');
    this.modal.style.display = 'flex';

    // Start at initial state
    this.goToStep(-1);
  }

  computeAllStepStates() {
    this.stepStates = [this.initialState];
    let curState = this.initialState;
    const isChess = this.gameData.gameType === 'chess';
    const isCheckers8 = this.gameData.gameType === 'checkers8';

    for (let i = 0; i < this.moves.length; i++) {
      const item = this.moves[i];
      if (item.boardState) {
        curState = item.boardState;
        this.stepStates.push(curState);
      } else {
        // Fallback simulate using engine
        try {
          if (isChess) {
            const engine = new ChessGame(curState);
            const moveParam = item.moveData || item.move;
            const res = engine.makeMove(moveParam);
            curState = res.fen || curState;
          } else {
            const nextTurn = item.player === 'white' ? 'w' : 'b';
            const engine = new CheckersGame(curState, nextTurn, isCheckers8 ? 8 : 10);
            const moveParam = item.moveData || item.move;
            const res = engine.makeMove(moveParam);
            curState = res.state || curState;
          }
        } catch {
          // Keep current state on parse failure
        }
        this.stepStates.push(curState);
      }
    }
  }

  formatReplayMove(item, index) {
    if (!item) {
      return { icon: '•', name: 'Yurish', coords: '-', fullText: '', isCapture: false };
    }

    const isWhite = item.player === 'white';
    const isChess = this.gameData?.gameType === 'chess';
    const rawMove = item.move;
    const moveData = item.moveData || (typeof rawMove === 'object' ? rawMove : null);
    const rawNotation = typeof rawMove === 'string' ? rawMove : (rawMove?.notation || '');

    let from = moveData?.from || null;
    let to = moveData?.to || null;
    let isCapture = rawNotation.includes('x') || rawNotation.includes(':') || Boolean(moveData?.captured);

    if (isChess) {
      let pieceChar = null;
      const priorState = this.stepStates[index] || this.initialState;

      // 1. Try to find piece from FEN if from square is known
      if (from && typeof from === 'string' && from.length === 2) {
        pieceChar = this.getPieceFromFEN(priorState, from);
      }

      // 2. Castling
      if (rawNotation.includes('O-O-O') || rawNotation.includes('0-0-0')) {
        return {
          icon: isWhite ? '♔' : '♚',
          name: 'Shoh',
          coords: 'O-O-O (Katta rokirovka)',
          fullText: `${isWhite ? '♔' : '♚'} Shoh: O-O-O (Katta rokirovka)`,
          isCapture: false
        };
      }
      if (rawNotation.includes('O-O') || rawNotation.includes('0-0')) {
        return {
          icon: isWhite ? '♔' : '♚',
          name: 'Shoh',
          coords: 'O-O (Kichik rokirovka)',
          fullText: `${isWhite ? '♔' : '♚'} Shoh: O-O (Kichik rokirovka)`,
          isCapture: false
        };
      }

      // 3. Piece Name and Figurine Icon
      let pieceName = 'Piyoda';
      let pieceIcon = isWhite ? '♙' : '♟';

      if (pieceChar) {
        const upper = pieceChar.toUpperCase();
        if (upper === 'K') { pieceName = 'Shoh'; pieceIcon = isWhite ? '♔' : '♚'; }
        else if (upper === 'Q') { pieceName = 'Farzin'; pieceIcon = isWhite ? '♕' : '♛'; }
        else if (upper === 'R') { pieceName = 'Qal‘a'; pieceIcon = isWhite ? '♖' : '♜'; }
        else if (upper === 'B') { pieceName = 'Fil'; pieceIcon = isWhite ? '♗' : '♝'; }
        else if (upper === 'N') { pieceName = 'Ot'; pieceIcon = isWhite ? '♘' : '♞'; }
        else if (upper === 'P') { pieceName = 'Piyoda'; pieceIcon = isWhite ? '♙' : '♟'; }
      } else if (rawNotation) {
        const first = rawNotation.charAt(0);
        if (first === 'K') { pieceName = 'Shoh'; pieceIcon = isWhite ? '♔' : '♚'; }
        else if (first === 'Q') { pieceName = 'Farzin'; pieceIcon = isWhite ? '♕' : '♛'; }
        else if (first === 'R') { pieceName = 'Qal‘a'; pieceIcon = isWhite ? '♖' : '♜'; }
        else if (first === 'B') { pieceName = 'Fil'; pieceIcon = isWhite ? '♗' : '♝'; }
        else if (first === 'N') { pieceName = 'Ot'; pieceIcon = isWhite ? '♘' : '♞'; }
        else if (/^[a-h]/.test(first)) { pieceName = 'Piyoda'; pieceIcon = isWhite ? '♙' : '♟'; }
      }

      let coords = '';
      if (from && to) {
        coords = `${from} ➔ ${to}`;
      } else if (rawNotation) {
        coords = rawNotation;
      } else {
        coords = 'Yurish';
      }

      return {
        icon: pieceIcon,
        name: pieceName,
        coords,
        fullText: `${pieceIcon} ${pieceName}: ${coords}`,
        isCapture
      };
    } else {
      // Checkers Piece Resolution
      let isKing = Boolean(moveData?.isKing || (typeof rawMove === 'object' && rawMove?.isKing));
      const priorState = this.stepStates[index] || this.initialState;
      if (from !== null && from !== undefined && typeof priorState === 'string') {
        const idx = Number(from);
        if (!isNaN(idx) && priorState[idx]) {
          const ch = priorState[idx];
          if (ch === 'W' || ch === 'B') isKing = true;
        }
      }

      const pieceName = isKing ? 'Dama' : 'Tosh';
      const pieceIcon = isKing ? '👑' : (isWhite ? '⚪' : '⚫');

      let coords = '';
      if (from !== null && to !== null) {
        coords = `${from} ➔ ${to}`;
      } else if (rawNotation) {
        coords = rawNotation;
      } else {
        coords = 'Yurish';
      }

      return {
        icon: pieceIcon,
        name: pieceName,
        coords,
        fullText: `${pieceIcon} ${pieceName}: ${coords}`,
        isCapture
      };
    }
  }

  getPieceFromFEN(fen, square) {
    if (!fen || !square || square.length < 2) return null;
    try {
      const placement = fen.split(' ')[0];
      const rows = placement.split('/');
      if (rows.length !== 8) return null;
      const file = square.toLowerCase().charCodeAt(0) - 97;
      const rank = 8 - parseInt(square[1], 10);
      if (rank < 0 || rank > 7 || file < 0 || file > 7) return null;
      const rowStr = rows[rank];
      let col = 0;
      for (const ch of rowStr) {
        if (/\d/.test(ch)) {
          col += parseInt(ch, 10);
        } else {
          if (col === file) return ch;
          col++;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  renderMovesList() {
    if (!this.movesListEl) return;
    this.movesListEl.innerHTML = '';

    if (this.moves.length === 0) {
      this.movesListEl.innerHTML = '<div class="text-muted" style="text-align: center; padding: 12px; font-size: 0.85rem;">Hech qanday yurish yozib olinmagan</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    this.moves.forEach((item, index) => {
      const moveBtn = document.createElement('div');
      moveBtn.className = `replay-move-item move-${item.player}`;
      moveBtn.dataset.stepIndex = index;

      const num = Math.floor(index / 2) + 1;
      const fmt = this.formatReplayMove(item, index);

      moveBtn.innerHTML = `
        <span class="replay-move-num">${index % 2 === 0 ? `${num}.` : ''}</span>
        <span class="replay-move-piece-icon">${fmt.icon}</span>
        <span class="replay-move-name">${fmt.name}:</span>
        <span class="replay-move-coords">${fmt.coords}</span>
        ${fmt.isCapture ? '<span class="replay-tag-capture" title="Tosh urildi">⚔️</span>' : ''}
      `;

      moveBtn.addEventListener('click', () => {
        this.stopPlay();
        this.goToStep(index, true);
      });

      fragment.appendChild(moveBtn);
    });

    this.movesListEl.appendChild(fragment);
  }

  goToStep(step, playAudio = false) {
    const maxStep = this.moves.length - 1;
    this.currentStep = Math.max(-1, Math.min(step, maxStep));

    const targetBoardState = this.stepStates[this.currentStep + 1] || this.initialState;

    // Apply board state
    if (this.gameData.gameType === 'chess') {
      this.boardUI.loadFEN(targetBoardState);
    } else {
      this.boardUI.loadState(targetBoardState);
    }

    // Update highlights
    if (this.currentStep >= 0 && this.moves[this.currentStep]) {
      const curMove = this.moves[this.currentStep];
      let from = null;
      let to = null;

      if (curMove.moveData) {
        from = curMove.moveData.from;
        to = curMove.moveData.to;
      } else if (typeof curMove.move === 'object') {
        from = curMove.move.from;
        to = curMove.move.to;
      }

      this.boardUI.setLastMove(from, to);

      // Check capture
      const notation = typeof curMove.move === 'string' ? curMove.move : (curMove.move?.notation || '');
      const isCapture = notation.includes('x') || notation.includes(':') || curMove.move?.captured;

      if (playAudio) {
        if (isCapture) {
          sounds.capture();
        } else {
          sounds.move();
        }
      }

      if (to && isCapture) {
        const cell = this.boardContainer.querySelector(`[data-square="${to}"]`);
        if (cell) {
          cell.classList.remove('cell-capture-poof');
          void cell.offsetWidth;
          cell.classList.add('cell-capture-poof');
        }
      }

      // Update current move badge
      if (this.currentMoveBadge) {
        const moveNum = Math.floor(this.currentStep / 2) + 1;
        const pName = curMove.player === 'white' ? '⚪ Oqlar' : '⚫ Qoralar';
        const fmt = this.formatReplayMove(curMove, this.currentStep);
        this.currentMoveBadge.innerHTML = `
          <span class="replay-badge-player">${pName}:</span>
          <span class="replay-badge-piece">${fmt.icon} <b>${fmt.name}</b></span>
          <span class="replay-badge-arrow">${fmt.coords}</span>
          <span class="replay-badge-num">(${moveNum}-yurish)</span>
          ${fmt.isCapture ? '<span class="badge-capture-tag">💥 Yutildi</span>' : ''}
        `;
      }
    } else {
      this.boardUI.setLastMove(null, null);
      if (this.currentMoveBadge) {
        this.currentMoveBadge.innerHTML = '<span>⚪ Boshlang‘ich holat</span>';
      }
    }

    // Update step indicator
    if (this.stepLabel) {
      if (this.currentStep === -1) {
        this.stepLabel.textContent = `Boshlang‘ich holat (0 / ${this.moves.length})`;
      } else {
        this.stepLabel.textContent = `Yurish: ${this.currentStep + 1} / ${this.moves.length}`;
      }
    }

    // Highlight active move in list and scroll into view
    const allItems = this.movesListEl.querySelectorAll('.replay-move-item');
    allItems.forEach((el) => {
      const idx = Number(el.dataset.stepIndex);
      if (idx === this.currentStep) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  next() {
    if (this.currentStep < this.moves.length - 1) {
      this.goToStep(this.currentStep + 1, true);
      return true;
    }
    return false;
  }

  prev() {
    if (this.currentStep > -1) {
      this.goToStep(this.currentStep - 1, false);
      return true;
    }
    return false;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  }

  startPlay() {
    if (this.currentStep >= this.moves.length - 1) {
      this.goToStep(-1);
    }
    this.isPlaying = true;
    if (this.playBtn) this.playBtn.textContent = '⏸';

    this.playTimer = setInterval(() => {
      const hasNext = this.next();
      if (!hasNext) {
        this.stopPlay();
      }
    }, 1200);
  }

  stopPlay() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
    if (this.playBtn) this.playBtn.textContent = '▶';
  }

  close() {
    this.stopPlay();
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.modal.style.display = 'none';
    }
    if (this.boardContainer) {
      this.boardContainer.innerHTML = '';
    }
  }
}
