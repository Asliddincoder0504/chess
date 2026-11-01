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

    const box = document.getElementById('mm-dispatched-box');
    if (box) box.classList.add('hidden');

    this.startElapsedTimer();

    try {
      const res = await api.joinMatchmaking(gameType, timeControl);
      if (res.status === 'matched' && res.gameId) {
        this.onMatchFound(res.gameId);
        return;
      }

      if (res.dispatchedTargets && res.dispatchedTargets.length > 0) {
        this.renderDispatchedTargets(res.dispatchedTargets);
      }

      this.startStatusPolling();
    } catch (err) {
      console.warn('[Matchmaking Join Fallback]:', err.message);
      this.startStatusPolling();
    }
  }

  renderDispatchedTargets(targets) {
    const box = document.getElementById('mm-dispatched-box');
    const list = document.getElementById('mm-dispatched-list');
    if (!box || !list) return;

    if (!targets || targets.length === 0) {
      box.classList.add('hidden');
      return;
    }

    box.classList.remove('hidden');
    list.innerHTML = targets.map(t => `
      <div class="mm-dispatched-item">
        <div class="mm-target-info">
          <div class="avatar-wrap avatar-xs"><span class="avatar-initials">${(t.firstName || 'O').charAt(0).toUpperCase()}</span></div>
          <div class="mm-target-meta">
            <span class="mm-target-name">${t.firstName || 'O‘yinchi'} ${t.username ? `<span class="text-muted">(@${t.username})</span>` : ''}</span>
            <span class="mm-target-elo">${t.elo || 1200} ELO • Bot orqali taklif yuborildi</span>
          </div>
        </div>
        <div class="mm-target-badge"><span class="pulse-dot-sm"></span> Yuborildi</div>
      </div>
    `).join('');
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

  async cancel() {
    this.isMatched = true;
    this.stopElapsedTimer();
    this.stopStatusPolling();

    const box = document.getElementById('mm-dispatched-box');
    if (box) box.classList.add('hidden');

    try {
      await api.cancelMatchmaking();
    } catch {
      // Ignore cancel error
    }

    this.app.navigate('home');
  }
}
