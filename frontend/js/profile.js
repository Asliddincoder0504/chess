import api from './api.js';
import { ICONS } from '../assets/icons.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

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

      document.getElementById('profile-name').textContent = `${user.firstName || 'O‘yinchi'} ${user.lastName || ''}`.trim();
      document.getElementById('profile-username').textContent = user.username ? `@${user.username}` : `ID: ${user.id}`;

      const avatarEl = document.getElementById('icon-profile-user');
      if (avatarEl) {
        const initial = (user.firstName || 'O').charAt(0).toUpperCase();
        if (user.photoUrl) {
          avatarEl.innerHTML = `<img src="${user.photoUrl}" class="avatar-img-lg" alt="${user.firstName || 'O‘yinchi'}" onerror="this.outerHTML='<span class=\\'avatar-initials\\'>${initial}</span>'" />`;
        } else {
          avatarEl.innerHTML = `<span class="avatar-initials" style="font-size: 1.35rem; font-weight: 800; color: var(--primary-gold);">${initial}</span>`;
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
    const tbody = document.getElementById('leaderboard-tbody');
    const emptyEl = document.getElementById('leaderboard-empty');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 28px;"><div class="loader-spinner"></div></td></tr>';
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    try {
      const res = await api.getLeaderboard(gameType);
      this.leaderboardData = res.leaderboard || [];
      this.filterLeaderboard('');
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #ef4444;">Reytingni yuklab bo‘lmadi: ${err.message}</td></tr>`;
      }
    }
  }

  filterLeaderboard(searchQuery) {
    const tbody = document.getElementById('leaderboard-tbody');
    const emptyEl = document.getElementById('leaderboard-empty');
    if (!tbody) return;

    const query = searchQuery.trim().toLowerCase();
    const filtered = (this.leaderboardData || []).filter(p =>
      (p.firstName && p.firstName.toLowerCase().includes(query)) ||
      (p.username && p.username.toLowerCase().includes(query)) ||
      String(p.id).includes(query)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    tbody.innerHTML = '';

    filtered.forEach((p, idx) => {
      const rank = p.rank || (idx + 1);
      const isCurrent = Number(p.id) === Number(this.app.currentUser.id);

      const tr = document.createElement('tr');
      tr.className = `lb-table-row ${isCurrent ? 'highlight-user' : ''}`;
      tr.style.cursor = 'pointer';

      let rankDisplay = `<span class="rank-num">${rank}</span>`;
      if (rank === 1) rankDisplay = `<span class="rank-badge">${ICONS.medalGold || '🥇'}</span>`;
      else if (rank === 2) rankDisplay = `<span class="rank-badge">${ICONS.medalSilver || '🥈'}</span>`;
      else if (rank === 3) rankDisplay = `<span class="rank-badge">${ICONS.medalBronze || '🥉'}</span>`;

      const initial = (p.firstName || 'O').charAt(0).toUpperCase();
      const avatarHtml = p.photoUrl
        ? `<img src="${p.photoUrl}" class="lb-avatar-mini" alt="" onerror="this.outerHTML='<span class=\\'lb-avatar-initial\\'>${initial}</span>'" />`
        : `<span class="lb-avatar-initial">${initial}</span>`;

      const totalMatches = (p.wins || 0) + (p.losses || 0) + (p.draws || 0);

      tr.innerHTML = `
        <td class="td-rank">${rankDisplay}</td>
        <td class="td-player">
          <div class="lb-player-cell">
            ${avatarHtml}
            <div class="lb-player-text">
              <span class="lb-row-name">${escapeHtml(p.firstName || 'O‘yinchi')}</span>
              <span class="lb-row-username">${p.username ? '@' + p.username : 'ID: ' + p.id}</span>
            </div>
          </div>
        </td>
        <td class="td-games">
          <span>${totalMatches}</span>
          <div style="font-size: 0.7rem; color: var(--text-muted);">${p.wins || 0}G' / ${p.losses || 0}M</div>
        </td>
        <td class="td-winrate">
          <span class="winrate-badge-pill">${p.winRate || 0}%</span>
        </td>
        <td class="td-elo">
          <span class="lb-row-elo">${p.elo || 1200}</span>
        </td>
      `;

      tr.addEventListener('click', () => {
        if (this.app.openPlayerInspectModal) {
          this.app.openPlayerInspectModal(p.id);
        }
      });

      tbody.appendChild(tr);
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

      // Render incoming user contact messages
      const messagesContainer = document.getElementById('admin-messages-list');
      const messagesCountBadge = document.getElementById('admin-messages-count');
      if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="loader-spinner-sm"></div>';
        try {
          const msgRes = await api.getAdminMessages(50);
          const messages = msgRes.messages || [];
          if (messagesCountBadge) {
            messagesCountBadge.textContent = `${messages.length} ta xabar`;
          }

          if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="empty-state" style="padding: 12px; font-size: 0.85rem;">Hozircha foydalanuvchilardan murojaatlar yo‘q</div>';
          } else {
            messagesContainer.innerHTML = '';
            messages.forEach(m => {
              const card = document.createElement('div');
              card.className = 'admin-msg-card';

              const dateStr = m.createdAt
                ? new Date(m.createdAt * 1000).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : 'Yangi';

              const topicColors = {
                'Umumiy': '#64748b',
                'Savol': '#3b82f6',
                'Texnik muammo': '#ef4444',
                'Taklif': '#10b981',
                'Qoidabuzarlik': '#f59e0b'
              };
              const badgeColor = topicColors[m.topic] || '#6366f1';

              const replyUrl = m.username
                ? `https://t.me/${m.username.replace(/^@/, '')}`
                : (m.senderId ? `tg://user?id=${m.senderId}` : null);

              const replyTimeStr = m.repliedAt
                ? new Date(m.repliedAt * 1000).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '';

              card.innerHTML = `
                <div class="admin-msg-top">
                  <div class="admin-msg-sender-meta">
                    <span class="admin-msg-sender-name">${escapeHtml(m.senderName || 'O‘yinchi')}</span>
                    ${m.username ? `<span class="admin-msg-username">@${escapeHtml(m.username.replace(/^@/, ''))}</span>` : ''}
                    <span class="admin-msg-id text-muted">(ID: ${m.senderId || 'Noma‘lum'})</span>
                  </div>
                  <span class="admin-msg-time text-muted">${dateStr}</span>
                </div>
                <div class="admin-msg-topic-row">
                  <span class="admin-msg-topic-badge" style="background-color: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44;">
                    📌 ${escapeHtml(m.topic || 'Umumiy')}
                  </span>
                  ${m.replyText ? `<span class="badge-status-replied">✅ Javob berilgan</span>` : `<span class="badge-status-waiting">⏳ Kutilmoqda</span>`}
                </div>
                <div class="admin-msg-content">${escapeHtml(m.message || '')}</div>
                
                ${m.replyText ? `
                  <div class="admin-msg-replied-box">
                    <div class="admin-msg-replied-header">
                      <span>🛡️ Sizning javobingiz (${escapeHtml(m.repliedBy || 'Admin')}):</span>
                      <span class="text-muted" style="font-size: 0.72rem;">${replyTimeStr}</span>
                    </div>
                    <div class="admin-msg-replied-text">${escapeHtml(m.replyText)}</div>
                  </div>
                ` : ''}

                <div class="admin-inline-reply-section">
                  <textarea class="admin-inline-reply-input" placeholder="${m.replyText ? 'Qayta javob yozish...' : 'Web App orqali javob yozing...'}" rows="2" data-reply-for="${m.id}"></textarea>
                  <div class="admin-inline-reply-actions">
                    <button class="btn-small btn-primary admin-btn-send-reply" data-msg-id="${m.id}">
                      <span>✉️ Web Appda javob berish</span>
                    </button>
                    ${replyUrl ? `
                      <a href="${replyUrl}" target="_blank" class="btn-small btn-reply-tg">
                        <span>✈️ Telegramda ochish</span>
                      </a>
                    ` : ''}
                  </div>
                </div>
              `;

              const sendReplyBtn = card.querySelector(`.admin-btn-send-reply[data-msg-id="${m.id}"]`);
              if (sendReplyBtn) {
                sendReplyBtn.addEventListener('click', async () => {
                  const textarea = card.querySelector(`textarea[data-reply-for="${m.id}"]`);
                  const replyText = (textarea?.value || '').trim();
                  if (!replyText) {
                    this.app.showToast('Iltimos, javob matnini yozing', 'error');
                    return;
                  }
                  sendReplyBtn.disabled = true;
                  sendReplyBtn.textContent = 'Yuborilmoqda...';
                  try {
                    const res = await api.adminReplyMessage(m.id, replyText);
                    if (res && res.success) {
                      this.app.showToast('✅ Javob foydalanuvchiga muvaffaqiyatli yetkazildi!', 'success');
                      this.loadAdminData();
                    } else {
                      throw new Error(res?.error || 'Xatolik');
                    }
                  } catch (err) {
                    this.app.showToast(`Xatolik: ${err.message}`, 'error');
                    sendReplyBtn.disabled = false;
                    sendReplyBtn.textContent = '✉️ Web Appda javob berish';
                  }
                });
              }

              messagesContainer.appendChild(card);
            });
          }
        } catch (msgErr) {
          messagesContainer.innerHTML = `<div class="empty-state">Xabarlarni yuklashda xatolik: ${msgErr.message}</div>`;
        }
      }

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
