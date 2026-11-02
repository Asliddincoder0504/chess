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
    this.isTimedOut = false;
    this.dispatchedTargets = [];
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('btn-mm-retry')?.addEventListener('click', () => {
      this.startSearch(this.gameType, this.timeControl);
    });
    document.getElementById('btn-mm-home')?.addEventListener('click', () => {
      this.cancel();
    });
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
    this.isTimedOut = false;
    this.dispatchedTargets = [];

    // Reset UI state
    document.getElementById('mm-timeout-box')?.classList.add('hidden');
    document.getElementById('mm-active-actions')?.classList.remove('hidden');
    document.getElementById('mm-radar-wrapper')?.classList.remove('paused');

    let initialElo = 1200;
    if (this.app?.currentUser) {
      if (gameType === 'checkers8') initialElo = this.app.currentUser.checkers8Elo || this.app.currentUser.checkersElo || 1200;
      else if (gameType === 'checkers') initialElo = this.app.currentUser.checkersElo || 1200;
      else initialElo = this.app.currentUser.chessElo || 1200;
    }
    this.currentUserElo = initialElo;

    this.app.navigate('matchmaking');

    document.getElementById('mm-game-type').textContent = this.formatGameType(gameType);
    document.getElementById('mm-time-control').textContent = timeControl;
    document.getElementById('mm-status-text').textContent = 'Mos raqib qidirilmoqda...';
    document.getElementById('mm-elapsed-timer').textContent = '00:00';
    this.updateEloToleranceUI(0);

    const box = document.getElementById('mm-dispatched-box');
    if (box) box.classList.add('hidden');

    this.startElapsedTimer();

    try {
      const res = await api.joinMatchmaking(gameType, timeControl);
      if (res.status === 'matched' && res.gameId) {
        this.onMatchFound(res.gameId);
        return;
      }

      if (res.userElo !== undefined) {
        this.currentUserElo = res.userElo;
        this.updateEloToleranceUI(0);
      }

      if (res.status === 'active_game_exists' && res.gameId) {
        this.stopElapsedTimer();
        this.stopStatusPolling();
        this.app.showToast('Faol o‘yiningiz mavjud. O‘yinga ulanmoqda...', 'info');
        this.app.launchGame(res.gameId);
        return;
      }

      if (res.dispatchedTargets && res.dispatchedTargets.length > 0) {
        this.dispatchedTargets = [...res.dispatchedTargets];
        this.renderDispatchedTargets(this.dispatchedTargets);
      } else {
        this.dispatchedTargets = [];
      }

      this.startStatusPolling();
    } catch (err) {
      console.warn('[Matchmaking Join Fallback]:', err.message);
      this.startStatusPolling();
    }
  }

  updateEloToleranceUI(totalSecs) {
    const rangeEl = document.getElementById('mm-elo-range');
    if (!rangeEl) return;

    const userElo = this.currentUserElo || 1200;
    // 0-9s: 100, 10-19s: 150, 20-29s: 200, 30-39s: 250, etc.
    const steps = Math.floor(totalSecs / 10);
    const tolerance = 100 + steps * 50;
    const minElo = Math.max(100, userElo - tolerance);
    const maxElo = userElo + tolerance;

    rangeEl.innerHTML = `ELO oralig‘i: <strong>${minElo} - ${maxElo}</strong> <span class="elo-tol-badge">±${tolerance}</span>`;

    const statusEl = document.getElementById('mm-status-text');
    if (statusEl && !this.isMatched && !this.isTimedOut) {
      if (tolerance === 100) {
        statusEl.textContent = 'Mos raqib qidirilmoqda...';
      } else {
        statusEl.textContent = `Qidiruv doirasi kengaytirilmoqda (±${tolerance})...`;
      }
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
    list.innerHTML = targets.map(t => {
      const initial = (t.firstName || 'O').charAt(0).toUpperCase();
      const name = t.firstName || 'O‘yinchi';
      const username = t.username ? `@${t.username}` : '';
      const elo = t.elo || 1200;
      return `
        <div class="mm-dispatched-item">
          <div class="mm-target-info">
            <div class="avatar-wrap avatar-xs"><span class="avatar-initials">${initial}</span></div>
            <div class="mm-target-meta">
              <span class="mm-target-name">${name} ${username ? `<span class="text-muted">(${username})</span>` : ''}</span>
              <span class="mm-target-elo">🏆 ${elo} ELO • Telegram orqali so‘rov yuborildi</span>
            </div>
          </div>
          <div class="mm-target-badge"><span class="pulse-dot-sm"></span> Yuborildi</div>
        </div>
      `;
    }).join('');
  }

  startElapsedTimer() {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      const totalSecs = Math.floor((Date.now() - this.startTime) / 1000);
      if (totalSecs >= 60) {
        this.handleTimeout();
        return;
      }
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const formatted = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const timerEl = document.getElementById('mm-elapsed-timer');
      if (timerEl) timerEl.textContent = formatted;

      this.updateEloToleranceUI(totalSecs);
    }, 1000);
  }

  handleTimeout() {
    this.isTimedOut = true;
    this.stopElapsedTimer();
    this.stopStatusPolling();

    const timerEl = document.getElementById('mm-elapsed-timer');
    if (timerEl) timerEl.textContent = '01:00';

    const statusEl = document.getElementById('mm-status-text');
    if (statusEl) statusEl.textContent = '1 daqiqa ichida raqib topilmadi';

    document.getElementById('mm-radar-wrapper')?.classList.add('paused');
    document.getElementById('mm-active-actions')?.classList.add('hidden');
    document.getElementById('mm-timeout-box')?.classList.remove('hidden');

    api.cancelMatchmaking().catch(() => {});
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
      if (this.isMatched || this.isTimedOut) return;
      try {
        const res = await api.getMatchmakingStatus();
        if (res.status === 'matched' && res.gameId) {
          this.onMatchFound(res.gameId);
          return;
        }

        if (res.status === 'waiting' || res.status === 'searching') {
          if (res.userElo !== undefined) {
            this.currentUserElo = res.userElo;
          }
          if (res.allowedTolerance !== undefined) {
            const minElo = Math.max(100, (this.currentUserElo || 1200) - res.allowedTolerance);
            const maxElo = (this.currentUserElo || 1200) + res.allowedTolerance;
            const rangeEl = document.getElementById('mm-elo-range');
            if (rangeEl) {
              rangeEl.innerHTML = `ELO oralig‘i: <strong>${minElo} - ${maxElo}</strong> <span class="elo-tol-badge">±${res.allowedTolerance}</span>`;
            }
          }

          if (res.newDispatchedTargets && res.newDispatchedTargets.length > 0) {
            if (!this.dispatchedTargets) this.dispatchedTargets = [];
            for (const t of res.newDispatchedTargets) {
              if (!this.dispatchedTargets.some(e => Number(e.id) === Number(t.id))) {
                this.dispatchedTargets.push(t);
              }
            }
            this.renderDispatchedTargets(this.dispatchedTargets);
          }
        }
      } catch (err) {
        console.warn('[Matchmaking Poll Error]:', err.message);
      }

      if (!this.isMatched && !this.isTimedOut) {
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
    this.isTimedOut = false;
    this.stopElapsedTimer();
    this.stopStatusPolling();

    document.getElementById('mm-status-text').textContent = 'Raqib topildi! O‘yinga ulanmoqda...';

    setTimeout(() => {
      this.app.launchGame(gameId);
    }, 800);
  }

  async cancel() {
    this.isMatched = true;
    this.isTimedOut = false;
    this.stopElapsedTimer();
    this.stopStatusPolling();
    this.dispatchedTargets = [];

    document.getElementById('mm-timeout-box')?.classList.add('hidden');
    document.getElementById('mm-active-actions')?.classList.remove('hidden');
    document.getElementById('mm-radar-wrapper')?.classList.remove('paused');

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
