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

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  move() {
    this.playTone(320, 'triangle', 0.08, 0.2);
  }

  capture() {
    this.playTone(480, 'square', 0.12, 0.25);
  }

  check() {
    this.playTone(600, 'sawtooth', 0.18, 0.2);
  }

  victory() {
    setTimeout(() => this.playTone(440, 'triangle', 0.15, 0.25), 0);
    setTimeout(() => this.playTone(554, 'triangle', 0.15, 0.25), 150);
    setTimeout(() => this.playTone(659, 'triangle', 0.3, 0.3), 300);
  }

  defeat() {
    setTimeout(() => this.playTone(400, 'sine', 0.2, 0.25), 0);
    setTimeout(() => this.playTone(320, 'sine', 0.2, 0.25), 180);
    setTimeout(() => this.playTone(260, 'sine', 0.35, 0.3), 360);
  }
}

export const sounds = new SoundEffects();

export class GameController {
  constructor(app) {
    this.app = app;
    this.gameId = null;
    this.gameData = null;
    this.playerColor = 'white';
    this.boardUI = null;
    this.localEngine = null;
    this.isSpectator = false;

    this.pollInterval = null;
    this.clockInterval = null;
    this.cachedWhiteTime = 0;
    this.cachedBlackTime = 0;
    this.lastClockTick = Date.now();
  }

  async loadGame(gameId, isSpectator = false) {
    this.gameId = gameId;
    this.isSpectator = isSpectator;
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
      this.app.showToast(`Xatolik: ${err.message}`, 'error');
      this.app.navigate('home');
    }
  }

  setupGameUI() {
    const modal = document.getElementById('game-over-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }

    const isSpectator = !!this.isSpectator;
    const user = this.app.currentUser;
    const isWhite = Number(user.id) === Number(this.gameData.whiteId);
    const isSolo = !isSpectator && Number(this.gameData.whiteId) === Number(this.gameData.blackId);
    if (isSpectator) {
      this.playerColor = 'white';
    } else if (isSolo) {
      this.playerColor = this.gameData.currentTurn;
    } else {
      this.playerColor = isWhite ? 'white' : 'black';
    }

    const player = isSpectator ? this.gameData.whitePlayer : (isWhite ? this.gameData.whitePlayer : this.gameData.blackPlayer);
    const opponent = isSpectator ? this.gameData.blackPlayer : (isWhite ? this.gameData.blackPlayer : this.gameData.whitePlayer);

    // Render player headers
    document.getElementById('opp-name').textContent = opponent?.firstName || (isSpectator ? 'Qoralar' : 'Raqib');
    document.getElementById('opp-elo').textContent = `${opponent?.elo || 1200} ELO`;
    document.getElementById('player-name').textContent = player?.firstName || (isSpectator ? 'Oqlar' : 'Siz');
    document.getElementById('player-elo').textContent = `${player?.elo || 1200} ELO`;

    // Toggle Spectator vs Player action buttons
    const drawBtn = document.getElementById('draw-btn');
    const resignBtn = document.getElementById('resign-btn');
    const exitSpectateBtn = document.getElementById('exit-spectate-btn');
    if (isSpectator) {
      if (drawBtn) drawBtn.classList.add('hidden');
      if (resignBtn) resignBtn.classList.add('hidden');
      if (exitSpectateBtn) exitSpectateBtn.classList.remove('hidden');
    } else {
      if (drawBtn) drawBtn.classList.remove('hidden');
      if (resignBtn) resignBtn.classList.remove('hidden');
      if (exitSpectateBtn) exitSpectateBtn.classList.add('hidden');
    }

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
        if (this.isSpectator || this.gameData.status !== 'active') return [];
        const isSolo = Number(this.gameData.whiteId) === Number(this.gameData.blackId);
        if (!isSolo && this.gameData.currentTurn !== this.playerColor) return [];
        return this.localEngine.getLegalMoves().filter(m => m.from === sq);
      };
      this.boardUI.loadFEN(this.gameData.boardState);
    } else {
      const is8x8 = this.gameData.gameType === 'checkers8';
      this.localEngine = new CheckersGame(this.gameData.boardState, this.gameData.currentTurn === 'white' ? 'w' : 'b', is8x8 ? 8 : 10);
      this.boardUI = new CheckersBoardUI(container, {
        orientation: this.playerColor,
        size: is8x8 ? 8 : 10,
        onMove: move => this.handlePlayerMove(move),
        onSelectSquare: sq => {
          if (this.isSpectator || this.gameData.status !== 'active') return [];
          const isSolo = Number(this.gameData.whiteId) === Number(this.gameData.blackId);
          if (!isSolo && this.gameData.currentTurn !== this.playerColor) return [];
          return this.localEngine.getLegalMoves().filter(m => Number(m.from) === Number(sq));
        }
      });
      this.boardUI.loadState(this.gameData.boardState);
    }

    this.updateMoveHistory();
    this.updateTurnIndicator();
    this.checkDrawOffers();
  }

  async handlePlayerMove(move) {
    if (this.gameData.status !== 'active') return;
    const isSolo = Number(this.gameData.whiteId) === Number(this.gameData.blackId);
    if (!isSolo && this.gameData.currentTurn !== this.playerColor) {
      this.app.showToast('Navbatingizni kuting!', 'warning');
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
      this.app.showToast(`Yurish xatosi: ${err.message}`, 'error');
      this.refreshGame();
    }
  }

  async syncGameState(newGame) {
    const prevTurn = this.gameData.currentTurn;
    const prevStatus = this.gameData.status;

    this.gameData = newGame;
    const isSolo = !this.isSpectator && Number(this.gameData.whiteId) === Number(this.gameData.blackId);
    if (isSolo) {
      this.playerColor = newGame.currentTurn;
      if (this.boardUI && typeof this.boardUI.setOrientation === 'function') {
        this.boardUI.setOrientation(this.playerColor);
      }
    }

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
      const is8x8 = this.gameData.gameType === 'checkers8';
      this.localEngine = new CheckersGame(this.gameData.boardState, this.gameData.currentTurn === 'white' ? 'w' : 'b', is8x8 ? 8 : 10);
      this.boardUI.loadState(this.gameData.boardState);
    }

    // Play move sound if opponent just made a move
    if (prevTurn !== newGame.currentTurn && newGame.currentTurn === this.playerColor) {
      sounds.move();
    }

    this.updateMoveHistory();
    this.updateTurnIndicator();
    this.checkDrawOffers();

    // Check game completion
    if (newGame.status === 'completed' && prevStatus !== 'completed') {
      this.stopClock();
      this.stopPolling();
      this.showGameOverModal();
      return;
    }

    // Trigger Bot move if playing against AI bot
    if (newGame.status === 'active' && newGame.currentTurn === 'black' && Number(newGame.blackId) === 999) {
      setTimeout(() => this.makeBotMove(), 500);
    }
  }

  async makeBotMove() {
    if (!this.gameData || this.gameData.status !== 'active' || this.gameData.currentTurn !== 'black') return;
    if (Number(this.gameData.blackId) !== 999) return;

    try {
      let botMove = null;
      if (this.gameData.gameType === 'chess') {
        const moves = this.localEngine.getLegalMoves();
        if (!moves || moves.length === 0) return;
        const captures = moves.filter(m => m.captured);
        botMove = captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : moves[Math.floor(Math.random() * moves.length)];
      } else {
        const moves = this.localEngine.getLegalMoves();
        if (!moves || moves.length === 0) return;
        const maxCaps = Math.max(...moves.map(m => (m.captured ? m.captured.length : 0)));
        let bestMoves = moves;
        if (maxCaps > 0) {
          bestMoves = moves.filter(m => (m.captured ? m.captured.length : 0) === maxCaps);
        }
        botMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
      }

      if (botMove) {
        const res = await api.makeMove(this.gameId, botMove, this.gameData.version);
        if (res.success && res.game) {
          sounds.move();
          await this.syncGameState(res.game);
        }
      }
    } catch (err) {
      console.warn('[Bot Move Exception]:', err.message);
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      await this.refreshGame();
    }, 1500);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async refreshGame() {
    try {
      const res = await api.getGame(this.gameId);
      if (res.success && res.game) {
        if (res.game.version !== this.gameData.version || res.game.status !== this.gameData.status) {
          await this.syncGameState(res.game);
        } else {
          // Sync clocks
          this.cachedWhiteTime = res.game.whiteTimeMs;
          this.cachedBlackTime = res.game.blackTimeMs;
        }
      }
    } catch {
      // Background poll failure
    }
  }

  startClock() {
    this.stopClock();
    this.clockInterval = setInterval(() => {
      if (this.gameData.status !== 'active') return;

      const now = Date.now();
      const delta = now - this.lastClockTick;
      this.lastClockTick = now;

      if (this.gameData.currentTurn === 'white') {
        this.cachedWhiteTime = Math.max(0, this.cachedWhiteTime - delta);
        if (this.cachedWhiteTime <= 0) {
          this.stopClock();
          this.refreshGame();
        }
      } else {
        this.cachedBlackTime = Math.max(0, this.cachedBlackTime - delta);
        if (this.cachedBlackTime <= 0) {
          this.stopClock();
          this.refreshGame();
        }
      }

      this.updateClockDisplay();
    }, 100);
  }

  stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  updateClockDisplay() {
    const isWhite = this.playerColor === 'white';
    const playerTime = isWhite ? this.cachedWhiteTime : this.cachedBlackTime;
    const oppTime = isWhite ? this.cachedBlackTime : this.cachedWhiteTime;

    const formatTime = ms => {
      const totalSec = Math.floor(ms / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const playerClockEl = document.getElementById('player-clock');
    const oppClockEl = document.getElementById('opp-clock');

    if (playerClockEl) {
      playerClockEl.textContent = formatTime(playerTime);
      playerClockEl.classList.toggle('active', this.gameData?.currentTurn === this.playerColor);
      playerClockEl.classList.toggle('low-time', playerTime < 30000);
    }

    if (oppClockEl) {
      oppClockEl.textContent = formatTime(oppTime);
      oppClockEl.classList.toggle('active', this.gameData?.currentTurn !== this.playerColor);
      oppClockEl.classList.toggle('low-time', oppTime < 30000);
    }
  }

  updateTurnIndicator() {
    const banner = document.getElementById('turn-banner');
    if (!banner) return;

    if (this.gameData.status === 'completed') {
      banner.textContent = 'O‘yin yakunlandi';
      banner.className = 'turn-banner';
      return;
    }

    if (this.isSpectator) {
      const turnName = this.gameData.currentTurn === 'white' ? 'Oqlar' : 'Qoralar';
      banner.textContent = `👁️ Tomosha rejimi: ${turnName} navbati`;
      banner.className = 'turn-banner own-turn';
      return;
    }

    const isOwnTurn = this.gameData.currentTurn === this.playerColor;
    const turnName = this.gameData.currentTurn === 'white' ? 'Oqlar' : 'Qoralar';
    banner.textContent = isOwnTurn ? `Sizning navbatingiz (${turnName})` : `Raqib navbati (${turnName})...`;
    banner.className = `turn-banner ${isOwnTurn ? 'own-turn' : 'opp-turn'}`;
  }

  updateMoveHistory() {
    const historyList = document.getElementById('move-history-list');
    if (!historyList) return;

    const moves = this.gameData.moves || [];
    historyList.innerHTML = '';

    for (let i = 0; i < moves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = moves[i]?.moveNotation || '';
      const blackMove = moves[i + 1]?.moveNotation || '';

      const row = document.createElement('div');
      row.className = 'move-row';
      row.innerHTML = `
        <span class="move-num">${moveNum}.</span>
        <span class="move-white">${whiteMove}</span>
        <span class="move-black">${blackMove}</span>
      `;
      historyList.appendChild(row);
    }

    historyList.scrollTop = historyList.scrollHeight;
  }

  checkDrawOffers() {
    const banner = document.getElementById('draw-offer-banner');
    if (!banner) return;

    const oppColor = this.playerColor === 'white' ? 'black' : 'white';
    if (this.gameData.drawOfferedBy === oppColor && this.gameData.status === 'active') {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  showGameOverModal() {
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('modal-outcome-title');
    const desc = document.getElementById('modal-outcome-desc');
    const ratingChange = document.getElementById('modal-rating-change');
    const rematchBtn = document.getElementById('rematch-btn');

    if (this.isSpectator) {
      sounds.move();
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
      if (title) {
        if (this.gameData.winner === 'draw') title.textContent = '🤝 Durang!';
        else if (this.gameData.winner === 'white') title.textContent = `🏆 Oqlar g'alaba qozondi!`;
        else title.textContent = `🏆 Qoralar g'alaba qozondi!`;
      }
      if (desc) desc.textContent = 'Partiya yakunlandi';
      if (ratingChange) ratingChange.style.display = 'none';
      if (rematchBtn) rematchBtn.style.display = 'none';
      return;
    }

    if (rematchBtn) rematchBtn.style.display = 'flex';
    if (ratingChange) ratingChange.style.display = 'inline-block';

    const isWinner = this.gameData.winner === this.playerColor;
    const isDraw = this.gameData.winner === 'draw';

    if (isWinner) sounds.victory();
    else if (isDraw) sounds.move();
    else sounds.defeat();

    const change = this.playerColor === 'white' ? this.gameData.whiteRatingChange : this.gameData.blackRatingChange;
    const changeStr = change > 0 ? `+${change}` : `${change}`;

    let reasonUz = this.gameData.winReason;
    if (reasonUz === 'checkmate') reasonUz = 'Mot qilish orqali';
    else if (reasonUz === 'timeout') reasonUz = 'Vaqt tugashi orqali';
    else if (reasonUz === 'resignation') reasonUz = 'Taslim bo‘lish orqali';
    else if (reasonUz === 'draw_agreement') reasonUz = 'O‘zaro kelishuv orqali';
    else if (reasonUz === 'stalemate') reasonUz = 'Pat (Durang)';
    else if (reasonUz === 'elimination') reasonUz = 'Barcha toshlar yutildi';
    else if (reasonUz === 'blocked') reasonUz = 'Yurish yo‘li to‘silgan';

    if (isWinner) {
      title.textContent = '🏆 G‘alaba!';
      title.className = 'outcome-title win';
      desc.textContent = reasonUz;
    } else if (isDraw) {
      title.textContent = '🤝 Durang!';
      title.className = 'outcome-title draw';
      desc.textContent = reasonUz;
    } else {
      title.textContent = '💔 Mag‘lubiyat';
      title.className = 'outcome-title loss';
      desc.textContent = reasonUz;
    }

    ratingChange.textContent = `${changeStr} ELO`;
    ratingChange.className = `rating-change-badge ${change >= 0 ? 'positive' : 'negative'}`;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  async resign() {
    if (confirm('Haqiqatan ham ushbu o‘yinda taslim bo‘lmoqchimisiz?')) {
      const res = await api.resignGame(this.gameId);
      if (res.success) {
        await this.syncGameState(res.game);
      }
    }
  }

  async offerDraw() {
    const res = await api.sendDrawAction(this.gameId, 'offer');
    if (res.success) {
      this.app.showToast('Raqibga durang taklifi yuborildi', 'info');
      await this.refreshGame();
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
      if (res.newGameId) {
        this.app.showToast('Yangi o‘yin boshlandi!', 'success');
        this.loadGame(res.newGameId);
        return;
      }
      this.app.showToast('Qaytadan o‘ynash taklifi yuborildi!', 'info');
      const rematchBtn = document.getElementById('rematch-btn');
      if (rematchBtn) {
        rematchBtn.textContent = 'Raqib kutilmoqda...';
        rematchBtn.disabled = true;
      }
    }
  }
}
