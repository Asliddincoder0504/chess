import api from './api.js';

export class MatchmakingController {
  constructor(app) {
    this.app = app;
    this.pollTimer = null;
    this.elapsedTimer = null;
    this.startTime = 0;
    this.gameType = 'chess';
    this.timeControl = '3+2';
  }

  async startSearch(gameType, timeControl) {
    this.gameType = gameType;
    this.timeControl = timeControl;
    this.startTime = Date.now();

    this.app.navigate('matchmaking');

    document.getElementById('mm-game-type').textContent = gameType.toUpperCase();
    document.getElementById('mm-time-control').textContent = timeControl;
    document.getElementById('mm-status-text').textContent = 'Searching for an opponent...';
    document.getElementById('mm-elapsed-timer').textContent = '00:00';

    this.startElapsedTimer();

    try {
      const res = await api.joinMatchmaking(gameType, timeControl);
      if (res.status === 'matched') {
        this.onMatchFound(res.gameId);
        return;
      }

      this.startStatusPolling();
    } catch (err) {
      this.app.showToast(`Matchmaking error: ${err.message}`, 'error');
      this.cancel();
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
      try {
        const res = await api.getMatchmakingStatus();
        if (res.status === 'matched') {
          this.onMatchFound(res.gameId);
          return;
        }

        if (res.status === 'searching') {
          const rangeEl = document.getElementById('mm-elo-range');
          if (rangeEl && res.userElo !== undefined && res.allowedTolerance !== undefined) {
            const minElo = Math.max(100, res.userElo - res.allowedTolerance);
            const maxElo = res.userElo + res.allowedTolerance;
            rangeEl.textContent = `ELO Range: ${minElo} - ${maxElo} (±${res.allowedTolerance})`;
          }
        }
      } catch (err) {
        console.warn('[Matchmaking Poll Error]:', err.message);
      }

      this.pollTimer = setTimeout(check, 1500);
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
    this.stopElapsedTimer();
    this.stopStatusPolling();

    document.getElementById('mm-status-text').textContent = 'Match Found! Launching board...';
    setTimeout(() => {
      this.app.launchGame(gameId);
    }, 800);
  }

  async cancel() {
    this.stopElapsedTimer();
    this.stopStatusPolling();
    try {
      await api.cancelMatchmaking();
    } catch {
      // Ignore
    }
    this.app.navigate('home');
  }
}
