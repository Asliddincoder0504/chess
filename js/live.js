import api from './api.js';
import { ICONS } from '../assets/icons.js';

export class LiveController {
  constructor(app) {
    this.app = app;
    this.pollTimer = null;
    this.currentTab = 'live-games';
    this.challengeTargetUser = null;
    this.initEvents();
  }

  initEvents() {
    // Live sub-tabs (Jonli o'yinlar vs Onlayn o'yinchilar)
    document.querySelectorAll('.live-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        this.switchTab(target);
      });
    });

    // Direct Challenge Modal controls
    document.getElementById('send-direct-challenge-btn')?.addEventListener('click', async () => {
      await this.sendChallenge();
    });

    document.getElementById('close-challenge-modal-btn')?.addEventListener('click', () => {
      this.closeChallengeModal();
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.live-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });

    const liveGamesTab = document.getElementById('live-games-tab-content');
    const onlineUsersTab = document.getElementById('online-users-tab-content');

    if (liveGamesTab) liveGamesTab.classList.toggle('hidden', tabName !== 'live-games');
    if (onlineUsersTab) onlineUsersTab.classList.toggle('hidden', tabName !== 'online-users');

    this.refresh();
  }

  start() {
    this.refresh();
    this.stop();
    this.pollTimer = setInterval(() => {
      if (this.app.currentView === 'live') {
        this.refresh();
      }
    }, 3500);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async refresh() {
    if (this.currentTab === 'live-games') {
      await this.loadLiveGames();
    } else {
      await this.loadOnlinePlayers();
    }
  }

  formatGameType(type) {
    if (type === 'checkers8') return 'Klassik Shashka (8x8, 12 tosh)';
    if (type === 'checkers') return 'Xalqaro Shashka (10x10, 20 tosh)';
    return 'Shaxmat (8x8 FIDE)';
  }

  async loadLiveGames() {
    const container = document.getElementById('live-games-container');
    const countBadge = document.getElementById('live-games-count');

    try {
      const res = await api.getLiveGames();
      if (!res.success) throw new Error(res.error || 'Yuklab bo‘lmadi');

      const games = res.games || [];
      if (countBadge) countBadge.textContent = games.length;

      if (!container) return;

      if (games.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🎮</div>
            <div style="font-weight: 700; margin-bottom: 4px;">Hozirda jonli partiyalar yo‘q</div>
            <div class="text-muted" style="font-size: 0.85rem;">O‘zingiz birinchi bo‘lib o‘yin boshlang yoki do‘stingizni taklif qiling!</div>
            <button class="btn-primary" id="live-start-now-btn" style="margin-top: 14px; max-width: 220px;">
              <span>O‘yin boshlash</span>
            </button>
          </div>
        `;
        document.getElementById('live-start-now-btn')?.addEventListener('click', () => {
          this.app.navigate('home');
        });
        return;
      }

      container.innerHTML = '';
      for (const g of games) {
        const card = document.createElement('div');
        card.className = 'live-game-card';

        const whiteName = g.whitePlayer?.firstName || 'Oqlar';
        const blackName = g.blackPlayer?.firstName || 'Qoralar';
        const whiteElo = g.whitePlayer?.elo || 1200;
        const blackElo = g.blackPlayer?.elo || 1200;
        const turnText = g.currentTurn === 'white' ? 'Oqlar navbati' : 'Qoralar navbati';

        card.innerHTML = `
          <div class="live-card-header">
            <span class="live-badge-type">${this.formatGameType(g.gameType)}</span>
            <span class="live-badge-tc">${g.timeControl}</span>
          </div>
          <div class="live-players-versus">
            <div class="live-player-side">
              <span class="player-color-dot white-dot"></span>
              <span class="live-p-name">${whiteName}</span>
              <span class="live-p-elo">${whiteElo}</span>
            </div>
            <div class="live-vs-separator">VS</div>
            <div class="live-player-side">
              <span class="player-color-dot black-dot"></span>
              <span class="live-p-name">${blackName}</span>
              <span class="live-p-elo">${blackElo}</span>
            </div>
          </div>
          <div class="live-card-footer">
            <span class="live-turn-info">
              <span class="pulse-dot"></span>
              <span>${turnText} • ${g.moveCount || 0} yurish</span>
            </span>
            <button class="btn-small btn-primary spectate-game-btn" data-game-id="${g.id}">
              <span class="btn-inline-icon">${ICONS.spectate || '👁️'}</span>
              <span>Tomosha qilish</span>
            </button>
          </div>
        `;

        card.querySelector('.spectate-game-btn')?.addEventListener('click', () => {
          this.app.spectateGame(g.id);
        });

        container.appendChild(card);
      }
    } catch (err) {
      if (container) {
        container.innerHTML = `<div class="empty-state">Xatolik: ${err.message}</div>`;
      }
    }
  }

  async loadOnlinePlayers() {
    const container = document.getElementById('online-users-container');
    const countBadge = document.getElementById('online-users-count');

    try {
      const res = await api.getOnlinePlayers();
      if (!res.success) throw new Error(res.error || 'Yuklab bo‘lmadi');

      const players = res.players || [];
      if (countBadge) countBadge.textContent = players.length;

      if (!container) return;

      if (players.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-weight: 700;">Boshqa o‘yinchilar topilmadi</div>
            <div class="text-muted" style="font-size: 0.85rem;">Do‘stlaringizga havola yuborib ularni o‘yinga chaqiring!</div>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      for (const p of players) {
        const item = document.createElement('div');
        item.className = 'online-user-item';

        const isPlaying = !!p.isPlaying;
        const initial = (p.firstName || 'O')[0].toUpperCase();

        item.innerHTML = `
          <div class="user-item-avatar">
            ${p.photoUrl ? `<img src="${p.photoUrl}" alt="${p.firstName}">` : `<div class="avatar-fallback">${initial}</div>`}
            <span class="user-status-indicator ${isPlaying ? 'in-game' : 'online'}"></span>
          </div>
          <div class="user-item-info">
            <div class="user-item-name">
              <span>${p.firstName || 'O‘yinchi'}</span>
              ${p.username ? `<span class="user-item-uname">@${p.username}</span>` : ''}
            </div>
            <div class="user-item-ratings">
              <span class="rating-chip">Shashka 8x8: ${p.checkers8Elo || 1200}</span>
              <span class="rating-chip">Shaxmat: ${p.chessElo || 1200}</span>
            </div>
          </div>
          <div class="user-item-action">
            ${isPlaying && p.activeGameId ? `
              <button class="btn-small btn-secondary spectate-user-btn" data-game-id="${p.activeGameId}">
                <span>${ICONS.spectate || '👁️'}</span>
                <span>Kuzatish</span>
              </button>
            ` : `
              <button class="btn-small btn-primary challenge-user-btn" data-user-id="${p.id}" data-user-name="${p.firstName}">
                <span>${ICONS.challenge || '⚔️'}</span>
                <span>Taklif qilish</span>
              </button>
            `}
          </div>
        `;

        item.querySelector('.spectate-user-btn')?.addEventListener('click', () => {
          this.app.spectateGame(p.activeGameId);
        });

        item.querySelector('.challenge-user-btn')?.addEventListener('click', () => {
          this.openChallengeModal(p);
        });

        container.appendChild(item);
      }
    } catch (err) {
      if (container) {
        container.innerHTML = `<div class="empty-state">Xatolik: ${err.message}</div>`;
      }
    }
  }

  openChallengeModal(player) {
    this.challengeTargetUser = player;
    const modal = document.getElementById('direct-challenge-modal');
    const nameEl = document.getElementById('challenge-target-name');
    if (nameEl) {
      nameEl.textContent = `${player.firstName || 'O‘yinchi'}ni bellashuvga chorlash`;
    }
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  }

  closeChallengeModal() {
    this.challengeTargetUser = null;
    const modal = document.getElementById('direct-challenge-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  async sendChallenge() {
    if (!this.challengeTargetUser) return;

    const gameType = document.getElementById('challenge-game-type')?.value || 'checkers8';
    const timeControl = document.getElementById('challenge-time-control')?.value || '5+0';

    try {
      const res = await api.createInvite(gameType, timeControl, this.challengeTargetUser.id);
      if (!res.success || !res.gameId) {
        throw new Error(res.error || 'Taklif yaratib bo‘lmadi');
      }

      this.closeChallengeModal();

      if (Number(this.challengeTargetUser.id) === 999) {
        await api.acceptInvite(res.gameId);
        this.app.launchGame(res.gameId);
        this.app.showToast('Kompyuter bilan o‘yin boshlandi!', 'success');
        return;
      }

      // Open existing invite modal with newly generated game
      this.app.openInviteModalWithExisting(res.gameId, gameType, timeControl);
      this.app.showToast(`${this.challengeTargetUser.firstName} uchun taklif tayyorlandi!`, 'success');
    } catch (err) {
      this.app.showToast(`Xatolik: ${err.message}`, 'error');
    }
  }
}
