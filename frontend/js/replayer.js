import { ChessBoardUI } from './chess.js';
import { CheckersBoardUI } from './checkers.js';

export class GameReplayer {
  constructor() {
    this.modal = document.getElementById('game-replay-modal');
    this.boardContainer = document.getElementById('replay-board-container');
    this.titleEl = document.getElementById('replay-title');
    this.subtitleEl = document.getElementById('replay-subtitle');
    this.stepLabel = document.getElementById('replay-step-label');
    this.movesListEl = document.getElementById('replay-moves-list');
    this.playBtn = document.getElementById('replay-btn-play');

    this.gameData = null;
    this.boardUI = null;
    this.moves = [];
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
      if (game.winner === 'white') outcome = `${wName} g'alaba qozondi`;
      else if (game.winner === 'black') outcome = `${bName} g'alaba qozondi`;
      else if (game.winner === 'draw') outcome = 'Durang';
      this.subtitleEl.textContent = `${wName} (Oq) vs ${bName} (Qora) • ${outcome}`;
    }

    // Initialize board UI
    this.boardContainer.innerHTML = '';
    if (game.gameType === 'chess') {
      this.boardUI = new ChessBoardUI(this.boardContainer, { orientation: 'white', onMove: null });
      this.initialState = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    } else {
      const is8x8 = game.gameType === 'checkers8';
      this.boardUI = new CheckersBoardUI(this.boardContainer, {
        orientation: 'white',
        size: is8x8 ? 8 : 10,
        onMove: null
      });
      this.initialState = is8x8
        ? 'bbbbbbbbbbbb........wwwwwwwwwwww'
        : 'bbbbbbbbbbbbbbbbbbbb..........wwwwwwwwwwwwwwwwwwww';
    }

    // Render move notations
    this.renderMovesList();

    // Show modal
    this.modal.classList.remove('hidden');
    this.modal.style.display = 'flex';

    // Start at initial or end position
    this.goToStep(-1);
  }

  renderMovesList() {
    if (!this.movesListEl) return;
    this.movesListEl.innerHTML = '';

    if (this.moves.length === 0) {
      this.movesListEl.innerHTML = '<div class="text-muted" style="text-align: center; padding: 10px; font-size: 0.85rem;">Hech qanday yurish yozib olinmagan</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    this.moves.forEach((item, index) => {
      const moveBtn = document.createElement('div');
      moveBtn.className = `replay-move-item move-${item.player}`;
      moveBtn.dataset.stepIndex = index;

      const num = Math.floor(index / 2) + 1;
      const notation = typeof item.move === 'string' ? item.move : (item.move?.notation || JSON.stringify(item.move));
      const playerIcon = item.player === 'white' ? '⚪' : '⚫';

      moveBtn.innerHTML = `
        <span class="replay-move-num">${index % 2 === 0 ? `${num}.` : ''}</span>
        <span class="replay-move-text">${playerIcon} ${notation}</span>
      `;

      moveBtn.addEventListener('click', () => {
        this.stopPlay();
        this.goToStep(index);
      });

      fragment.appendChild(moveBtn);
    });

    this.movesListEl.appendChild(fragment);
  }

  goToStep(step) {
    const maxStep = this.moves.length - 1;
    this.currentStep = Math.max(-1, Math.min(step, maxStep));

    let targetBoardState = this.initialState;
    if (this.currentStep >= 0 && this.moves[this.currentStep]) {
      targetBoardState = this.moves[this.currentStep].boardState || this.gameData.boardState || this.initialState;
    }

    // Apply board state
    if (this.gameData.gameType === 'chess') {
      this.boardUI.loadFEN(targetBoardState);
    } else {
      this.boardUI.loadState(targetBoardState);
    }

    // Update highlights
    if (this.currentStep >= 0 && this.moves[this.currentStep]) {
      const curMove = this.moves[this.currentStep];
      if (curMove.moveData?.from && curMove.moveData?.to) {
        this.boardUI.setLastMove(curMove.moveData.from, curMove.moveData.to);
      } else {
        this.boardUI.setLastMove(null, null);
      }
    } else {
      this.boardUI.setLastMove(null, null);
    }

    // Update step indicator
    if (this.stepLabel) {
      if (this.currentStep === -1) {
        this.stepLabel.textContent = `Boshlang'ich holat (0 / ${this.moves.length})`;
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
      this.goToStep(this.currentStep + 1);
      return true;
    }
    return false;
  }

  prev() {
    if (this.currentStep > -1) {
      this.goToStep(this.currentStep - 1);
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
