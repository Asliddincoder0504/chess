import api from './api.js';

export class MatchmakingController {
  constructor(app) {
    this.app = app;
    this.pollTimer = null;
    this.elapsedTimer = null;
    this.startTime = 0;
    this.gameType = 'chess';
    this.timeControl = '3+2';
    this.isMatched = false;
  }

  formatGameType(type) {
    if (type === 'checkers8') return 'SHASHKA 8x8 (12 tosh)';
    if (type === 'checkers') return 'SHASHKA 10x10 (20 tosh)';
    return 'SHAXMAT (8x8 FIDE)';
  }

  async startSearch(gameType, timeControl) {
    this.gameType = gameType;
    this.timeControl = timeControl;
    this.startTime = Date.now();
    this.isMatched = false;

    this.app.navigate('matchmaking');

    document.getElementById('mm-game-type').textContent = this.formatGameType(gameType);
    document.getElementById('mm-time-control').textContent = timeControl;
    document.getElementById('mm-status-text').textContent = 'Mos raqib qidirilmoqda...';
    document.getElementById('mm-elapsed-timer').textContent = '00:00';

    this.startElapsedTimer();

    try {
      const res = await api.joinMatchmaking(gameType, timeControl);
      if (res.status === 'matched' && res.gameId) {
        this.onMatchFound(res.gameId);
        return;
      }

      this.startStatusPolling();
    } catch (err) {
      console.warn('[Matchmaking Join Fallback]:', err.message);
      this.startStatusPolling();
    }
  }

  startElapsedTimer() {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      const totalSecs = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const formatted = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const timerEl = document.getElementById('mm-elapsed-timer');
      if (timerEl) timerEl.textContent = formatted;

      // If searching for > 5 seconds and no human opponent in queue, auto-pair with practice bot
      if (totalSecs >= 5 && !this.isMatched) {
        this.onMatchFoundWithBot();
      }
    }, 1000);
  }

  stopElapsedTimer() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  startStatusPolling() {
    this.stopStatusPolling();

    const check = async () => {
      if (this.isMatched) return;
      try {
        const res = await api.getMatchmakingStatus();
        if (res.status === 'matched' && res.gameId) {
          this.onMatchFound(res.gameId);
          return;
        }

        if (res.status === 'waiting' || res.status === 'searching') {
          const rangeEl = document.getElementById('mm-elo-range');
          if (rangeEl && res.userElo !== undefined && res.allowedTolerance !== undefined) {
            const minElo = Math.max(100, res.userElo - res.allowedTolerance);
            const maxElo = res.userElo + res.allowedTolerance;
            rangeEl.textContent = `ELO oralig‘i: ${minElo} - ${maxElo} (±${res.allowedTolerance})`;
          }
        }
      } catch (err) {
        console.warn('[Matchmaking Poll Error]:', err.message);
      }

      if (!this.isMatched) {
        this.pollTimer = setTimeout(check, 1500);
      }
    };

    this.pollTimer = setTimeout(check, 1500);
  }

  stopStatusPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  onMatchFound(gameId) {
    if (this.isMatched) return;
    this.isMatched = true;
    this.stopElapsedTimer();
    this.stopStatusPolling();

    document.getElementById('mm-status-text').textContent = 'Raqib topildi! O‘yinga ulanmoqda...';

    setTimeout(() => {
      this.app.launchGame(gameId);
    }, 800);
  }

  async onMatchFoundWithBot() {
    if (this.isMatched) return;
    this.isMatched = true;
    this.stopElapsedTimer();
    this.stopStatusPolling();

    document.getElementById('mm-status-text').textContent = 'Raqib topildi! O‘yinga ulanmoqda...';

    try {
      const res = await api.createInvite(this.gameType, this.timeControl);
      if (res.success && res.gameId) {
        await api.acceptInvite(res.gameId);
        setTimeout(() => this.app.launchGame(res.gameId), 800);
        return;
      }
    } catch {}

    const localId = `bot_game_${Date.now()}`;
    const game = api.createLocalGame(localId, this.gameType, this.timeControl, this.app.currentUser?.id || 1001, 999, 'active');
    setTimeout(() => this.app.launchGame(game.id), 800);
  }

  async cancel() {
    this.isMatched = true;
    this.stopElapsedTimer();
    this.stopStatusPolling();

    try {
      await api.cancelMatchmaking();
    } catch {
      // Ignore cancel error
    }

    this.app.navigate('home');
  }
}
