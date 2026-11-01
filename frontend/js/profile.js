import api from './api.js';
import { ICONS } from '../assets/icons.js';

export class ProfileController {
  constructor(app) {
    this.app = app;
    this.leaderboardType = 'chess';
    this.leaderboardData = [];
    this.profileStats = null;
    this.activeProfileGame = 'chess';
  }

  getTierName(elo) {
    if (elo >= 1800) return '🏆 Grossmeyster';
    if (elo >= 1600) return '🎖️ Usta (Master)';
    if (elo >= 1400) return '⭐ Usta nomzodi';
    if (elo >= 1200) return '🥈 Havaskor';
    return '🥉 Boshlovchi';
  }

  async renderProfile() {
    try {
      const res = await api.getProfileStats();
      if (!res.success) throw new Error(res.error);

      this.profileStats = res.stats;
      const user = this.app.currentUser;

      document.getElementById('profile-name').textContent = `${user.firstName || 'O‘yinchi'} ${user.lastName || ''}`;
      document.getElementById('profile-username').textContent = user.username ? `@${user.username}` : `ID: ${user.id}`;

      const avatarEl = document.getElementById('icon-profile-user');
      if (avatarEl) {
        if (user.photoUrl) {
          avatarEl.innerHTML = `<img src="${user.photoUrl}" class="avatar-img-lg" onerror="this.parentElement.innerHTML='${ICONS.user}'" />`;
        } else {
          avatarEl.innerHTML = ICONS.user;
        }
      }

      const highestElo = Math.max(
        this.profileStats.chess?.elo || 1200,
        this.profileStats.checkers8?.elo || 1200,
        this.profileStats.checkers?.elo || 1200
      );
      document.getElementById('profile-tier').textContent = this.getTierName(highestElo);

      const chessEl = document.getElementById('profile-chess-elo-quick');
      const ch8El = document.getElementById('profile-checkers8-elo-quick');
      const chEl = document.getElementById('profile-checkers-elo-quick');

      if (chessEl) chessEl.textContent = this.profileStats.chess?.elo || 1200;
      if (ch8El) ch8El.textContent = this.profileStats.checkers8?.elo || 1200;
      if (chEl) chEl.textContent = this.profileStats.checkers?.elo || 1200;

      this.updateProfileStatCard(this.activeProfileGame);
    } catch (err) {
      console.warn('[Profile Render Error]:', err.message);
    }
  }

  updateProfileStatCard(gameType) {
    this.activeProfileGame = gameType;
    if (!this.profileStats) return;

    const stat = this.profileStats[gameType] || { elo: 1200, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };
    document.getElementById('stat-active-elo').textContent = stat.elo || 1200;
    document.getElementById('stat-active-winrate').textContent = `${stat.winRate || 0}%`;
    document.getElementById('stat-active-matches').textContent = stat.total || 0;
    document.getElementById('stat-active-record').textContent = `${stat.wins || 0}G' / ${stat.losses || 0}M / ${stat.draws || 0}D`;

    const barEl = document.getElementById('stat-active-bar');
    if (barEl) barEl.style.width = `${stat.winRate || 0}%`;

    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.profileGame === gameType);
    });
  }

  async renderLeaderboard(gameType = 'chess') {
    this.leaderboardType = gameType;
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<div class="loader-spinner"></div>';

    try {
      const res = await api.getLeaderboard(gameType);
      this.leaderboardData = res.leaderboard || [];
      this.filterLeaderboard('');
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">Reytingni yuklab bo‘lmadi: ${err.message}</div>`;
    }
  }

  filterLeaderboard(searchQuery) {
    const listEl = document.getElementById('leaderboard-list');
    const query = searchQuery.trim().toLowerCase();

    const filtered = this.leaderboardData.filter(p =>
      (p.firstName && p.firstName.toLowerCase().includes(query)) ||
      (p.username && p.username.toLowerCase().includes(query)) ||
      String(p.id).includes(query)
    );

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">O‘yinchilar topilmadi</div>';
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(p => {
      const row = document.createElement('div');
      row.className = `leaderboard-item ${p.id === Number(this.app.currentUser.id) ? 'highlight-user' : ''}`;
      row.style.cursor = 'pointer';

      let medal = `<span class="rank-num">${p.rank}</span>`;
      if (p.rank === 1) medal = `<span class="rank-badge">${ICONS.medalGold}</span>`;
      else if (p.rank === 2) medal = `<span class="rank-badge">${ICONS.medalSilver}</span>`;
      else if (p.rank === 3) medal = `<span class="rank-badge">${ICONS.medalBronze}</span>`;

      row.innerHTML = `
        <div class="lb-left">
          ${medal}
          <div class="lb-user-info">
            <span class="lb-name">${p.firstName || 'O‘yinchi'}</span>
            <span class="lb-username">${p.username ? `@${p.username}` : `ID: ${p.id}`}</span>
          </div>
        </div>
        <div class="lb-right">
          <span class="lb-elo">${p.elo} ELO</span>
          <span class="lb-record">${p.wins}G' / ${p.losses}M (${p.winRate}%)</span>
        </div>
      `;

      row.addEventListener('click', () => {
        if (this.app.openPlayerInspectModal) {
          this.app.openPlayerInspectModal(p.id);
        }
      });

      listEl.appendChild(row);
    });
  }

  formatWinReason(reason) {
    switch (reason) {
      case 'checkmate': return 'Mot qilish orqali';
      case 'timeout': return 'Vaqt tugashi orqali';
      case 'resignation': return 'Raqib taslim bo‘ldi';
      case 'draw_agreement': return 'Kelishuvga ko‘ra';
      case 'stalemate': return 'Pat (durang)';
      case 'insufficient_material': return 'Yetarsiz toshlar';
      case 'elimination': return 'Toshlar yutildi';
      case 'blocked': return 'Yurish yo‘li to‘silgan';
      case 'admin_intervention': return 'Admin tomonidan bekor qilindi';
      default: return reason || 'O‘yin tugadi';
    }
  }

  formatGameType(type) {
    if (type === 'checkers8') return '🔴 Shashka 8x8';
    if (type === 'checkers') return '⚪ Shashka 10x10';
    return '♟️ Shaxmat';
  }

  async renderHistory() {
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<div class="loader-spinner"></div>';

    try {
      const res = await api.getProfileHistory(50);
      const history = res.history || [];

      if (history.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Hali o‘yinlar o‘tkazilmagan. Birinchi o‘yinni boshlang!</div>';
        return;
      }

      listEl.innerHTML = '';
      history.forEach(g => {
        const isWhite = g.whiteId === Number(this.app.currentUser.id);
        const isWinner = (g.winner === 'white' && isWhite) || (g.winner === 'black' && !isWhite);
        const isDraw = g.winner === 'draw';

        const outcomeClass = isWinner ? 'win' : isDraw ? 'draw' : 'loss';
        const outcomeText = isWinner ? 'G‘alaba' : isDraw ? 'Durang' : 'Mag‘lubiyat';

        const change = isWhite ? g.whiteRatingChange : g.blackRatingChange;
        const changeStr = change > 0 ? `+${change}` : `${change}`;
        const dateStr = new Date(g.createdAt * 1000).toLocaleDateString('uz-UZ', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = `history-match-card`;
        card.style.cursor = 'pointer';
        card.innerHTML = `
          <div>
            <div style="font-weight: 700; font-size: 0.9rem;">${this.formatGameType(g.gameType)} (${g.timeControl})</div>
            <div class="text-muted" style="font-size: 0.78rem;">${this.formatWinReason(g.winReason)} • ${dateStr}</div>
            <div class="history-replay-hint">▶ Tahlil qilish va qayta ko‘rish</div>
          </div>
          <div style="text-align: right;">
            <span class="history-outcome-badge ${outcomeClass}">${outcomeText}</span>
            <div style="font-size: 0.82rem; font-weight: 700; color: ${change >= 0 ? '#70e000' : '#ff4d6d'}; margin-top: 3px;">
              ${changeStr} ELO
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          if (this.app.gameReplayer) {
            this.app.gameReplayer.loadGame(g);
          }
        });

        listEl.appendChild(card);
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">Tarixni yuklab bo‘lmadi: ${err.message}</div>`;
    }
  }

  async renderAdmin(query = '') {
    const statsContainer = document.getElementById('admin-stats-container');
    const gamesContainer = document.getElementById('admin-active-games-list');
    const usersContainer = document.getElementById('admin-users-list');

    statsContainer.innerHTML = '<div class="loader-spinner"></div>';
    if (gamesContainer) gamesContainer.innerHTML = '';
    usersContainer.innerHTML = '';

    try {
      const statsRes = await api.getAdminStats();
      if (!statsRes.success) throw new Error(statsRes.error);

      const stats = statsRes.stats;
      statsContainer.innerHTML = `
        <div class="admin-stat-card">
          <div class="stat-num">${stats.totalUsers || 0}</div>
          <div class="stat-label">👥 Jami o‘yinchilar</div>
        </div>
        <div class="admin-stat-card">
          <div class="stat-num">${stats.activeGamesCount || 0}</div>
          <div class="stat-label">⚔️ Faol o‘yinlar</div>
        </div>
        <div class="admin-stat-card">
          <div class="stat-num">${stats.matchmakingQueue?.totalWaiting || 0}</div>
          <div class="stat-label">⏳ Navbatdagilar</div>
        </div>
        <div class="admin-stat-card">
          <div class="stat-num">${stats.bannedUsers || 0}</div>
          <div class="stat-label">🚫 Bloklanganlar</div>
        </div>
      `;

      // Render active games
      if (gamesContainer) {
        const gamesRes = await api.getAdminActiveGames();
        const activeGames = gamesRes.games || [];
        if (activeGames.length === 0) {
          gamesContainer.innerHTML = '<div class="empty-state" style="padding: 10px;">Hozirda jonli o‘yinlar yo‘q</div>';
        } else {
          gamesContainer.innerHTML = '';
          activeGames.forEach(g => {
            const card = document.createElement('div');
            card.className = 'admin-game-card';
            card.innerHTML = `
              <div class="admin-game-meta">
                <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${this.formatGameType(g.gameType)} (${g.timeControl})</div>
                <div class="text-muted" style="font-size: 0.76rem; margin-top: 2px;">
                  Oqlar: ID ${g.whiteId} vs Qoralar: ID ${g.blackId || 'Kutilmoqda'}
                </div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn-small btn-secondary admin-spectate-btn" data-game-id="${g.id}">👁️ Kuzatish</button>
                <button class="btn-small btn-danger admin-abort-btn" data-abort-id="${g.id}">To‘xtatish</button>
              </div>
            `;
            card.querySelector('.admin-spectate-btn')?.addEventListener('click', () => {
              this.app.spectateGame(g.id);
            });
            card.querySelector('.admin-abort-btn')?.addEventListener('click', async () => {
              if (confirm('Ushbu o‘yinni to‘xtatishni tasdiqlaysizmi?')) {
                await api.abortAdminGame(g.id);
                this.renderAdmin(query);
              }
            });
            gamesContainer.appendChild(card);
          });
        }
      }

      // Render users
      const usersRes = await api.getAdminUsers(query);
      const users = usersRes.users || [];

      usersContainer.innerHTML = '';
      if (users.length === 0) {
        usersContainer.innerHTML = '<div class="empty-state">Foydalanuvchi topilmadi</div>';
        return;
      }

      users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'admin-user-card';

        const initial = (u.firstName || 'O').charAt(0).toUpperCase();
        const avatarHtml = u.photoUrl
          ? `<img src="${u.photoUrl}" class="avatar-img" onerror="this.parentElement.innerHTML='<span class=\\'avatar-initials\\'>${initial}</span>'" />`
          : `<span class="avatar-initials">${initial}</span>`;

        item.innerHTML = `
          <div class="admin-user-top">
            <div class="admin-user-avatar">${avatarHtml}</div>
            <div class="admin-user-details">
              <div class="name">${u.firstName || 'O‘yinchi'} ${u.lastName || ''} <span class="text-muted" style="font-size: 0.76rem;">(@${u.username || 'n/a'})</span></div>
              <div class="meta">Telegram ID: <b>${u.id}</b> ${u.isBanned ? '<span style="color: #ef4444; font-weight: bold;">(Bloklangan)</span>' : ''}</div>
              <div class="admin-user-ratings-pills">
                <span class="admin-rating-pill">♟️ ${u.chessElo || 1200}</span>
                <span class="admin-rating-pill">🔴 ${u.checkers8Elo || u.checkersElo || 1200}</span>
                <span class="admin-rating-pill">⚪ ${u.checkersElo || 1200}</span>
              </div>
            </div>
          </div>
          <div class="admin-user-actions-row">
            <button class="btn-small btn-secondary inspect-user-btn" data-userid="${u.id}">👁️ Profil</button>
            <button class="btn-small btn-secondary reset-elo-btn" data-userid="${u.id}">🔄 Tiklash</button>
            <button class="btn-small ban-btn ${u.isBanned ? 'unban' : 'ban'}" data-userid="${u.id}" data-banned="${u.isBanned}">
              ${u.isBanned ? '✅ Ochish' : '🚫 Bloklash'}
            </button>
          </div>
        `;

        item.querySelector('.inspect-user-btn').addEventListener('click', () => {
          if (this.app.openPlayerInspectModal) {
            this.app.openPlayerInspectModal(u.id);
          }
        });

        item.querySelector('.ban-btn').addEventListener('click', async e => {
          const userId = Number(u.id);
          const isCurrentlyBanned = Number(u.isBanned) === 1;
          await api.setAdminUserBan(userId, !isCurrentlyBanned);
          if (this.app.showToast) {
            this.app.showToast(isCurrentlyBanned ? 'Foydalanuvchi blokdan ochildi' : 'Foydalanuvchi bloklandi', 'info');
          }
          this.renderAdmin(query);
        });

        item.querySelector('.reset-elo-btn').addEventListener('click', async () => {
          const userId = Number(u.id);
          const custom = prompt(`ID ${userId} foydalanuvchi yangi reytingini kiriting:`, '1200');
          if (custom !== null) {
            const val = parseInt(custom, 10);
            if (!isNaN(val) && val >= 100) {
              await api.resetAdminRating(userId, val);
              if (this.app.showToast) {
                this.app.showToast(`Reyting ${val} ga o‘rnatildi!`, 'success');
              }
              this.renderAdmin(query);
            }
          }
        });

        usersContainer.appendChild(item);
      });
    } catch (err) {
      statsContainer.innerHTML = `<div class="empty-state">Admin huquqi xatosi: ${err.message}</div>`;
    }
  }
}
