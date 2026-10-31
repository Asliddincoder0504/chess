import api from './api.js';
import { ChessBoardUI } from './chess.js';
import { CheckersBoardUI } from './checkers.js';
import { ChessGame } from './engine-chess.js';
import { CheckersGame } from './engine-checkers.js';

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  getAudioContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.2) {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay block fallback
    }
  }

  move() {
    this.playTone(480, 'sine', 0.08, 0.25);
  }

  capture() {
    this.playTone(320, 'triangle', 0.12, 0.35);
  }

  check() {
    this.playTone(750, 'sawtooth', 0.15, 0.2);
  }

  win() {
    const tones = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    tones.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.3), idx * 120);
    });
  }

  defeat() {
    const tones = [440, 392, 349.23, 293.66];
    tones.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.25, 0.25), idx * 150);
    });
  }
}

export const sounds = new SoundEffects();

export class GameController {
  constructor(app) {
    this.app = app;
    this.gameId = null;
    this.gameData = null;
    this.boardUI = null;
    this.localEngine = null;
    this.playerColor = 'white'; // 'white' or 'black'
    this.pollIntervalId = null;
    this.clockIntervalId = null;
    this.cachedWhiteTime = 0;
    this.cachedBlackTime = 0;
    this.lastClockTick = Date.now();
  }

  async loadGame(gameId) {
    this.gameId = gameId;
    this.stopPolling();
    this.stopClock();

    const container = document.getElementById('game-board-container');
    container.innerHTML = '<div class="loader-spinner"></div>';

    try {
      const res = await api.getGame(gameId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to load game');
      }

      this.gameData = res.game;
      this.setupGameUI();
      this.startClock();
      this.startPolling();
    } catch (err) {
      this.app.showToast(`Error: ${err.message}`, 'error');
      this.app.navigate('home');
    }
  }

  setupGameUI() {
    const user = this.app.currentUser;
    const isWhite = Number(user.id) === this.gameData.whiteId;
    this.playerColor = isWhite ? 'white' : 'black';

    const player = isWhite ? this.gameData.whitePlayer : this.gameData.blackPlayer;
    const opponent = isWhite ? this.gameData.blackPlayer : this.gameData.whitePlayer;

    // Render player headers
    document.getElementById('opp-name').textContent = opponent?.firstName || 'Opponent';
    document.getElementById('opp-elo').textContent = `${opponent?.elo || 1000} ELO`;
    document.getElementById('player-name').textContent = player?.firstName || 'You';
    document.getElementById('player-elo').textContent = `${player?.elo || 1000} ELO`;

    this.cachedWhiteTime = this.gameData.whiteTimeMs;
    this.cachedBlackTime = this.gameData.blackTimeMs;
    this.lastClockTick = Date.now();
    this.updateClockDisplay();

    // Initialize board UI
    const container = document.getElementById('game-board-container');
    container.innerHTML = '';

    if (this.gameData.gameType === 'chess') {
      this.localEngine = new ChessGame(this.gameData.boardState);
      this.boardUI = new ChessBoardUI(container, {
        orientation: this.playerColor,
        onMove: move => this.handlePlayerMove(move)
      });
      this.boardUI.onSelectSquare = sq => {
        if (this.gameData.currentTurn !== this.playerColor || this.gameData.status !== 'active') return [];
        return this.localEngine.getLegalMoves().filter(m => m.from === sq);
      };
      this.boardUI.loadFEN(this.gameData.boardState);
    } else {
      this.localEngine = new CheckersGame(this.gameData.boardState, this.gameData.currentTurn === 'white' ? 'w' : 'b');
      this.boardUI = new CheckersBoardUI(container, {
        orientation: this.playerColor,
        onMove: move => this.handlePlayerMove(move)
      });
      this.boardUI.onSelectSquare = sq => {
        if (this.gameData.currentTurn !== this.playerColor || this.gameData.status !== 'active') return [];
        return this.localEngine.getLegalMoves().filter(m => m.from === sq);
      };
      this.boardUI.loadState(this.gameData.boardState);
    }

    this.updateMoveHistory();
    this.updateTurnIndicator();
    this.checkDrawOffers();
  }

  async handlePlayerMove(move) {
    if (this.gameData.status !== 'active') return;
    if (this.gameData.currentTurn !== this.playerColor) {
      this.app.showToast('Wait for your turn!', 'warning');
      return;
    }

    try {
      const res = await api.makeMove(this.gameId, move, this.gameData.version);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      sounds.move();
      await this.syncGameState(res.game);
    } catch (err) {
      this.app.showToast(`Move failed: ${err.message}`, 'error');
      // Reload authoritative game state
      this.refreshGame();
    }
  }

  async syncGameState(newGame) {
    const prevTurn = this.gameData.currentTurn;
    const prevStatus = this.gameData.status;

    this.gameData = newGame;
    this.cachedWhiteTime = newGame.whiteTimeMs;
    this.cachedBlackTime = newGame.blackTimeMs;
    this.lastClockTick = Date.now();

    // Update board state
    if (this.gameData.gameType === 'chess') {
      this.localEngine = new ChessGame(this.gameData.boardState);
      this.boardUI.loadFEN(this.gameData.boardState);
      if (this.localEngine.inCheck(this.localEngine.turn)) {
        const kingCoords = this.localEngine.findKing(this.localEngine.turn);
        if (kingCoords) {
          this.boardUI.setCheckSquare(this.boardUI.coordsToSquare(kingCoords.row, kingCoords.col));
        }
        sounds.check();
      } else {
        this.boardUI.setCheckSquare(null);
      }
    } else {
      this.localEngine = new CheckersGame(this.gameData.boardState, this.gameData.currentTurn === 'white' ? 'w' : 'b');
      this.boardUI.loadState(this.gameData.boardState);
    }

    this.updateClockDisplay();
    this.updateTurnIndicator();
    this.updateMoveHistory();
    this.checkDrawOffers();

    // Check if game just ended
    if (prevStatus === 'active' && newGame.status === 'completed') {
      this.handleGameOver();
    }
  }

  async refreshGame() {
    try {
      const res = await api.getGame(this.gameId);
      if (res.success && res.game) {
        if (res.game.version !== this.gameData.version || res.game.status !== this.gameData.status) {
          sounds.move();
          await this.syncGameState(res.game);
        }
      }
    } catch (err) {
      console.warn('[Poll Error]:', err.message);
    }
  }

  startPolling() {
    this.stopPolling();
    const pollLoop = async () => {
      if (this.gameData?.status !== 'active') return;

      await this.refreshGame();

      // Adaptive polling rate: 1000ms if waiting for opponent, 3000ms if own turn
      const delay = this.gameData?.currentTurn === this.playerColor ? 3000 : 1000;
      this.pollIntervalId = setTimeout(pollLoop, delay);
    };

    this.pollIntervalId = setTimeout(pollLoop, 1500);
  }

  stopPolling() {
    if (this.pollIntervalId) {
      clearTimeout(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  startClock() {
    this.stopClock();
    this.clockIntervalId = setInterval(() => {
      if (this.gameData?.status !== 'active') return;

      const now = Date.now();
      const delta = now - this.lastClockTick;
      this.lastClockTick = now;

      if (this.gameData.currentTurn === 'white') {
        this.cachedWhiteTime = Math.max(0, this.cachedWhiteTime - delta);
      } else {
        this.cachedBlackTime = Math.max(0, this.cachedBlackTime - delta);
      }

      this.updateClockDisplay();

      // Check timeout
      if (this.cachedWhiteTime <= 0 || this.cachedBlackTime <= 0) {
        this.refreshGame();
      }
    }, 250);
  }

  stopClock() {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }
  }

  formatTime(ms) {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  updateClockDisplay() {
    const whiteEl = document.getElementById(this.playerColor === 'white' ? 'player-clock' : 'opp-clock');
    const blackEl = document.getElementById(this.playerColor === 'black' ? 'player-clock' : 'opp-clock');

    if (whiteEl) whiteEl.textContent = this.formatTime(this.cachedWhiteTime);
    if (blackEl) blackEl.textContent = this.formatTime(this.cachedBlackTime);

    // Active clock highlight
    const isWhiteTurn = this.gameData.currentTurn === 'white';
    whiteEl?.classList.toggle('active-clock', isWhiteTurn);
    blackEl?.classList.toggle('active-clock', !isWhiteTurn);
  }

  updateTurnIndicator() {
    const isOwnTurn = this.gameData.currentTurn === this.playerColor;
    const banner = document.getElementById('turn-banner');
    if (banner) {
      banner.textContent = isOwnTurn ? 'Your Turn' : "Opponent's Turn";
      banner.className = `turn-banner ${isOwnTurn ? 'own-turn' : 'opp-turn'}`;
    }
  }

  updateMoveHistory() {
    const list = document.getElementById('move-history-list');
    if (!list) return;

    const moves = JSON.parse(this.gameData.history || '[]');
    list.innerHTML = '';

    for (let i = 0; i < moves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = moves[i]?.move || '';
      const blackMove = moves[i + 1]?.move || '';

      const row = document.createElement('div');
      row.className = 'move-history-row';
      row.innerHTML = `
        <span class="move-num">${moveNum}.</span>
        <span class="move-white">${whiteMove}</span>
        <span class="move-black">${blackMove}</span>
      `;
      list.appendChild(row);
    }

    list.scrollTop = list.scrollHeight;
  }

  checkDrawOffers() {
    const drawBanner = document.getElementById('draw-offer-banner');
    if (!drawBanner) return;

    const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
    if (this.gameData.drawOfferedBy === opponentColor) {
      drawBanner.classList.remove('hidden');
    } else {
      drawBanner.classList.add('hidden');
    }
  }

  handleGameOver() {
    this.stopPolling();
    this.stopClock();

    const isWinner = this.gameData.winner === this.playerColor;
    const isDraw = this.gameData.winner === 'draw';

    if (isWinner) sounds.win();
    else if (isDraw) sounds.move();
    else sounds.defeat();

    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('modal-outcome-title');
    const desc = document.getElementById('modal-outcome-desc');
    const ratingChange = document.getElementById('modal-rating-change');

    const change = this.playerColor === 'white' ? this.gameData.whiteRatingChange : this.gameData.blackRatingChange;
    const changeStr = change > 0 ? `+${change}` : `${change}`;

    if (isWinner) {
      title.textContent = '🏆 Victory!';
      title.className = 'outcome-title win';
      desc.textContent = `Won by ${this.gameData.winReason}`;
    } else if (isDraw) {
      title.textContent = '🤝 Draw!';
      title.className = 'outcome-title draw';
      desc.textContent = `Drawn by ${this.gameData.winReason}`;
    } else {
      title.textContent = '💔 Defeat';
      title.className = 'outcome-title loss';
      desc.textContent = `Lost by ${this.gameData.winReason}`;
    }

    ratingChange.textContent = `${changeStr} ELO`;
    ratingChange.className = `rating-change-badge ${change >= 0 ? 'positive' : 'negative'}`;

    modal.classList.remove('hidden');
  }

  async resign() {
    if (confirm('Are you sure you want to resign this match?')) {
      const res = await api.resignGame(this.gameId);
      if (res.success) {
        await this.syncGameState(res.game);
      }
    }
  }

  async offerDraw() {
    const res = await api.sendDrawAction(this.gameId, 'offer');
    if (res.success) {
      this.app.showToast('Draw offer sent to opponent', 'info');
    }
  }

  async acceptDraw() {
    const res = await api.sendDrawAction(this.gameId, 'accept');
    if (res.success) {
      await this.syncGameState(res.game);
    }
  }

  async declineDraw() {
    const res = await api.sendDrawAction(this.gameId, 'decline');
    if (res.success) {
      document.getElementById('draw-offer-banner')?.classList.add('hidden');
    }
  }

  async offerRematch() {
    const res = await api.sendRematchAction(this.gameId, 'offer');
    if (res.success) {
      this.app.showToast('Rematch invitation sent!', 'info');
      document.getElementById('rematch-btn').textContent = 'Waiting for opponent...';
      document.getElementById('rematch-btn').disabled = true;
    }
  }
}
