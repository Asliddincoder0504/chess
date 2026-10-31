import api from './api.js';
import { ICONS } from '../assets/icons.js';

export class ProfileController {
  constructor(app) {
    this.app = app;
    this.leaderboardType = 'chess';
    this.leaderboardData = [];
  }

  async renderProfile() {
    try {
      const res = await api.getProfileStats();
      if (!res.success) throw new Error(res.error);

      const stats = res.stats;
      const user = this.app.currentUser;

      document.getElementById('profile-name').textContent = `${user.firstName || 'Player'} ${user.lastName || ''}`;
      document.getElementById('profile-username').textContent = user.username ? `@${user.username}` : `ID: ${user.id}`;

      // Chess stats
      document.getElementById('profile-chess-elo').textContent = stats.chess.elo || 1000;
      document.getElementById('profile-chess-matches').textContent = stats.chess.total;
      document.getElementById('profile-chess-record').textContent = `${stats.chess.wins}W / ${stats.chess.losses}L / ${stats.chess.draws}D`;
      document.getElementById('profile-chess-winrate').textContent = `${stats.chess.winRate}%`;

      // Checkers stats
      document.getElementById('profile-checkers-elo').textContent = stats.checkers.elo || 1000;
      document.getElementById('profile-checkers-matches').textContent = stats.checkers.total;
      document.getElementById('profile-checkers-record').textContent = `${stats.checkers.wins}W / ${stats.checkers.losses}L / ${stats.checkers.draws}D`;
      document.getElementById('profile-checkers-winrate').textContent = `${stats.checkers.winRate}%`;
    } catch (err) {
      console.warn('[Profile Render Error]:', err.message);
    }
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
      listEl.innerHTML = `<div class="empty-state">Failed to load leaderboard: ${err.message}</div>`;
    }
  }

  filterLeaderboard(searchQuery) {
    const listEl = document.getElementById('leaderboard-list');
    const query = searchQuery.trim().toLowerCase();

    const filtered = this.leaderboardData.filter(p =>
      (p.firstName && p.firstName.toLowerCase().includes(query)) ||
      (p.username && p.username.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No players found</div>';
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = `leaderboard-item ${p.id === Number(this.app.currentUser.id) ? 'highlight-user' : ''}`;

      let medal = `<span class="rank-num">${p.rank}</span>`;
      if (p.rank === 1) medal = `<span class="rank-badge">${ICONS.medalGold}</span>`;
      else if (p.rank === 2) medal = `<span class="rank-badge">${ICONS.medalSilver}</span>`;
      else if (p.rank === 3) medal = `<span class="rank-badge">${ICONS.medalBronze}</span>`;

      row.innerHTML = `
        <div class="lb-left">
          ${medal}
          <div class="lb-user-info">
            <span class="lb-name">${p.firstName || 'Player'}</span>
            <span class="lb-username">${p.username ? `@${p.username}` : ''}</span>
          </div>
        </div>
        <div class="lb-right">
          <span class="lb-elo">${p.elo} ELO</span>
          <span class="lb-record">${p.wins}W / ${p.losses}L (${p.winRate}%)</span>
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  async renderHistory() {
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<div class="loader-spinner"></div>';

    try {
      const res = await api.getProfileHistory(50);
      const history = res.history || [];

      if (history.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No past matches found. Play your first game!</div>';
        return;
      }

      listEl.innerHTML = '';
      history.forEach(g => {
        const isWhite = g.whiteId === Number(this.app.currentUser.id);
        const isWinner = (g.winner === 'white' && isWhite) || (g.winner === 'black' && !isWhite);
        const isDraw = g.winner === 'draw';

        const outcomeClass = isWinner ? 'win' : isDraw ? 'draw' : 'loss';
        const outcomeText = isWinner ? 'Victory' : isDraw ? 'Draw' : 'Defeat';

        const change = isWhite ? g.whiteRatingChange : g.blackRatingChange;
        const changeStr = change > 0 ? `+${change}` : `${change}`;
        const dateStr = new Date(g.createdAt * 1000).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = `history-card ${outcomeClass}`;
        card.innerHTML = `
          <div class="hist-header">
            <span class="hist-game">${g.gameType.toUpperCase()} (${g.timeControl})</span>
            <span class="hist-date">${dateStr}</span>
          </div>
          <div class="hist-body">
            <div class="hist-outcome ${outcomeClass}">${outcomeText}</div>
            <div class="hist-reason">by ${g.winReason}</div>
            <div class="hist-rating ${change >= 0 ? 'pos' : 'neg'}">${changeStr} ELO</div>
          </div>
        `;
        listEl.appendChild(card);
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">Failed to load history: ${err.message}</div>`;
    }
  }

  async renderAdmin() {
    const statsContainer = document.getElementById('admin-stats-container');
    const usersContainer = document.getElementById('admin-users-list');

    statsContainer.innerHTML = '<div class="loader-spinner"></div>';
    usersContainer.innerHTML = '';

    try {
      const statsRes = await api.getAdminStats();
      if (!statsRes.success) throw new Error(statsRes.error);

      const stats = statsRes.stats;
      statsContainer.innerHTML = `
        <div class="admin-stat-card">
          <div class="stat-num">${stats.totalUsers}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="admin-stat-card">
          <div class="stat-num">${stats.activeGamesCount}</div>
          <div class="stat-label">Active Games</div>
        </div>
        <div class="admin-stat-card">
          <div class="stat-num">${stats.matchmakingQueue?.totalWaiting || 0}</div>
          <div class="stat-label">In Queue</div>
        </div>
        <div class="admin-stat-card">
          <div class="stat-num">${stats.bannedUsers}</div>
          <div class="stat-label">Banned Users</div>
        </div>
      `;

      const usersRes = await api.getAdminUsers();
      const users = usersRes.users || [];

      usersContainer.innerHTML = '';
      users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'admin-user-row';
        item.innerHTML = `
          <div class="admin-user-info">
            <span class="name">${u.firstName || 'Player'} (@${u.username || 'n/a'})</span>
            <span class="meta">ID: ${u.id} | Chess: ${u.chessElo} | Checkers: ${u.checkersElo}</span>
          </div>
          <button class="ban-btn ${u.isBanned ? 'unban' : 'ban'}" data-userid="${u.id}" data-banned="${u.isBanned}">
            ${u.isBanned ? 'Unban' : 'Ban'}
          </button>
        `;

        item.querySelector('.ban-btn').addEventListener('click', async e => {
          const userId = Number(e.target.dataset.userid);
          const isCurrentlyBanned = Number(e.target.dataset.banned) === 1;
          await api.setAdminUserBan(userId, !isCurrentlyBanned);
          this.renderAdmin();
        });

        usersContainer.appendChild(item);
      });
    } catch (err) {
      statsContainer.innerHTML = `<div class="empty-state">Admin access error: ${err.message}</div>`;
    }
  }
}
