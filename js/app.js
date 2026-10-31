import api from './api.js';
import { GameController, sounds } from './game.js';
import { MatchmakingController } from './matchmaking.js';
import { ProfileController } from './profile.js';
import { LiveController } from './live.js';
import { ICONS } from '../assets/icons.js';

class WellChessApp {
  constructor() {
    this.currentUser = {
      id: 1001,
      firstName: 'O‘yinchi',
      username: 'player',
      chessElo: 1200,
      checkersElo: 1200,
      checkers8Elo: 1200
    };

    this.currentView = 'home';
    this.gameController = new GameController(this);
    this.matchmakingController = new MatchmakingController(this);
    this.profileController = new ProfileController(this);
    this.liveController = new LiveController(this);

    this.selectedGameType = 'chess';
    this.selectedTimeControl = '3+2';
    this.invitePollTimer = null;
    this.pendingInviteGameId = null;
  }

  async init() {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.enableClosingConfirmation) {
        tg.enableClosingConfirmation();
      }
      if (tg.initDataUnsafe?.user) {
        this.currentUser = {
          id: tg.initDataUnsafe.user.id,
          firstName: tg.initDataUnsafe.user.first_name || 'O‘yinchi',
          lastName: tg.initDataUnsafe.user.last_name || '',
          username: tg.initDataUnsafe.user.username || '',
          languageCode: tg.initDataUnsafe.user.language_code || 'uz'
        };
      }
    }

    try {
      const res = await api.getProfile();
      if (res.success && res.user) {
        this.currentUser = { ...this.currentUser, ...res.user };
      }
    } catch (err) {
      console.warn('[App Init Profile Warn]:', err.message);
    }

    this.updateUserUI();
    this.renderIcons();
    this.bindEvents();

    const params = new URLSearchParams(window.location.search);
    const deepGameId = params.get('gameId');
    const autoPlay = params.get('game');
    const autoQuick = params.get('quick');

    if (deepGameId) {
      await this.handleDeepGameLink(deepGameId);
    } else if (autoQuick) {
      this.matchmakingController.startSearch('chess', '3+2');
    } else if (autoPlay) {
      this.selectedGameType = autoPlay;
      this.navigate('home');
    } else {
      this.navigate('home');
    }
  }

  clearGameUrlParam() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('gameId')) {
        url.searchParams.delete('gameId');
        window.history.replaceState({}, document.title, url.pathname);
      }
    } catch {}
  }

  async handleDeepGameLink(gameId) {
    try {
      const res = await api.getGame(gameId);
      if (!res.success || !res.game) {
        this.showToast('O‘yin topilmadi', 'error');
        this.clearGameUrlParam();
        this.navigate('home');
        return;
      }

      const game = res.game;

      // If the game has already finished, DO NOT reopen it!
      if (game.status === 'completed' || game.status === 'aborted') {
        this.clearGameUrlParam();
        this.showToast('Oldingi o‘yin allaqachon yakunlangan. Yangi o‘yin boshlashingiz mumkin!', 'info');
        this.navigate('home');
        return;
      }

      if (game.status === 'active') {
        const userId = Number(this.currentUser.id);
        const isParticipant = userId === Number(game.whiteId) || userId === Number(game.blackId);
        if (isParticipant) {
          this.launchGame(gameId);
        } else {
          // Open as spectator
          this.spectateGame(gameId);
        }
        return;
      }

      if (game.status === 'waiting') {
        if (Number(game.whiteId) === Number(this.currentUser.id)) {
          // Current user is host
          this.openInviteModalWithExisting(gameId, game.gameType, game.timeControl);
        } else {
          // Current user is the invitee friend! Show accept dialog
          this.showAcceptInviteDialog(game);
        }
        return;
      }

      this.clearGameUrlParam();
      this.navigate('home');
    } catch (err) {
      this.clearGameUrlParam();
      this.showToast(`Xatolik: ${err.message}`, 'error');
      this.navigate('home');
    }
  }

  spectateGame(gameId) {
    this.navigate('game');
    this.gameController.loadGame(gameId, true);
  }

  closeGameAndReturnHome() {
    const modal = document.getElementById('game-over-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }

    this.clearGameUrlParam();
    this.gameController.stopPolling();
    this.gameController.stopClock();
    this.gameController.gameId = null;
    this.gameController.gameData = null;
    this.gameController.isSpectator = false;
    this.pendingInviteGameId = null;

    const container = document.getElementById('game-board-container');
    if (container) container.innerHTML = '';

    this.navigate('home');
  }

  showAcceptInviteDialog(game) {
    const modal = document.getElementById('accept-invite-modal');
    if (!modal) return;

    const hostName = game.whitePlayer?.firstName || 'Do‘stingiz';
    let gameName = 'Shaxmat (8x8)';
    if (game.gameType === 'checkers8') gameName = 'Klassik shashka (8x8, 12 tosh)';
    else if (game.gameType === 'checkers') gameName = 'Xalqaro shashka (10x10, 20 tosh)';

    document.getElementById('accept-invite-desc').textContent = `${hostName} sizni ${gameName} o‘yiniga taklif qildi!`;
    document.getElementById('accept-invite-meta').textContent = `${gameName} • ${game.timeControl}`;

    this.pendingInviteGameId = game.id;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  updateUserUI() {
    const nameEl = document.getElementById('home-user-name');
    const chessEloEl = document.getElementById('home-chess-elo');
    const checkers8EloEl = document.getElementById('home-checkers8-elo');
    const checkersEloEl = document.getElementById('home-checkers-elo');

    if (nameEl) nameEl.textContent = this.currentUser.firstName || 'O‘yinchi';
    if (chessEloEl) chessEloEl.textContent = `${this.currentUser.chessElo || 1200} ELO (Shaxmat)`;
    if (checkers8EloEl) checkers8EloEl.textContent = `${this.currentUser.checkers8Elo || this.currentUser.checkersElo || 1200} ELO (Shashka 8x8)`;
    if (checkersEloEl) checkersEloEl.textContent = `${this.currentUser.checkersElo || 1200} ELO (Shashka 10x10)`;

    const adminTab = document.getElementById('nav-tab-admin');
    if (adminTab) {
      if (this.currentUser.isAdmin) {
        adminTab.classList.remove('hidden');
      } else {
        adminTab.classList.add('hidden');
      }
    }
  }

  renderIcons() {
    const iconMap = {
      'icon-brand-logo': ICONS.logo,
      'icon-hero-trophy': ICONS.trophy,
      'icon-game-chess': ICONS.chess,
      'icon-game-checkers8': ICONS.checkers8,
      'icon-game-checkers': ICONS.checkers,
      'icon-btn-lightning': ICONS.lightning,
      'icon-btn-friends': ICONS.friends,
      'icon-radar-swords': ICONS.swords,
      'icon-btn-draw': ICONS.handshake,
      'icon-btn-resign': ICONS.flag,
      'icon-modal-rematch': ICONS.rematch,
      'icon-profile-user': ICONS.user,
      'icon-lb-chess': ICONS.chess,
      'icon-lb-checkers8': ICONS.checkers8,
      'icon-lb-checkers': ICONS.checkers,
      'icon-search-slot': ICONS.search,
      'icon-admin-search-slot': ICONS.search,
      'icon-nav-home': ICONS.home,
      'icon-nav-live': ICONS.live,
      'icon-btn-live': ICONS.live,
      'icon-btn-exit-spectate': ICONS.live,
      'icon-nav-ranks': ICONS.podium,
      'icon-nav-history': ICONS.history,
      'icon-nav-profile': ICONS.user,
      'icon-nav-admin': ICONS.shield
    };

    for (const [id, svg] of Object.entries(iconMap)) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = svg;
    }
  }

  bindEvents() {
    // Navigation bar tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.dataset.view;
        this.navigate(targetView);
      });
    });

    // Game type selector on Home (3 options: chess, checkers8, checkers)
    document.querySelectorAll('.game-type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.game-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedGameType = card.dataset.game;
      });
    });

    // Time control selector on Home
    document.querySelectorAll('.tc-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.tc-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        this.selectedTimeControl = pill.dataset.tc;
      });
    });

    // Find Matchmaking button
    document.getElementById('start-matchmaking-btn')?.addEventListener('click', () => {
      this.matchmakingController.startSearch(this.selectedGameType, this.selectedTimeControl);
    });

    // Cancel Matchmaking button
    document.getElementById('cancel-matchmaking-btn')?.addEventListener('click', () => {
      this.matchmakingController.cancel();
    });

    // Friend Invite Button on Home
    document.getElementById('friend-invite-btn')?.addEventListener('click', () => {
      this.openFriendInviteModal();
    });

    // Generate Invite Link
    document.getElementById('generate-invite-link-btn')?.addEventListener('click', async () => {
      const gameType = document.getElementById('invite-game-type').value;
      const timeControl = document.getElementById('invite-time-control').value;
      await this.createAndShowInviteLink(gameType, timeControl);
    });

    // Copy Invite Link
    document.getElementById('copy-invite-link-btn')?.addEventListener('click', () => {
      const input = document.getElementById('invite-link-input');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        this.showToast('Havola buferga nusxalandi! 📋', 'success');
      }
    });

    // Share Invite Link to Telegram
    document.getElementById('share-telegram-btn')?.addEventListener('click', () => {
      const input = document.getElementById('invite-link-input');
      if (input && input.value) {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(input.value)}&text=${encodeURIComponent('WellChess: Qani, shaxmat / shashka o‘ynaymiz! Havolani bosib o‘yinga qo‘shil:')}`;
        if (window.Telegram?.WebApp?.openTelegramLink) {
          window.Telegram.WebApp.openTelegramLink(shareUrl);
        } else {
          window.open(shareUrl, '_blank');
        }
      }
    });

    // Close Invite Modal
    document.getElementById('close-invite-modal-btn')?.addEventListener('click', () => {
      this.closeInviteModal();
    });

    // Accept Invite Dialog buttons
    document.getElementById('confirm-accept-invite-btn')?.addEventListener('click', async () => {
      if (!this.pendingInviteGameId) return;
      try {
        const res = await api.acceptInvite(this.pendingInviteGameId);
        if (res.success) {
          const modal = document.getElementById('accept-invite-modal');
          if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
          }
          this.showToast('Taklif qabul qilindi! O‘yin boshlandi!', 'success');
          this.launchGame(this.pendingInviteGameId);
        } else {
          this.showToast(res.error || 'Taklifni qabul qilib bo‘lmadi', 'error');
        }
      } catch (err) {
        this.showToast(`Xatolik: ${err.message}`, 'error');
      }
    });

    document.getElementById('decline-invite-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('accept-invite-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      this.pendingInviteGameId = null;
      this.navigate('home');
    });

    // Game action buttons
    document.getElementById('resign-btn')?.addEventListener('click', () => {
      this.gameController.resign();
    });

    document.getElementById('draw-btn')?.addEventListener('click', () => {
      this.gameController.offerDraw();
    });

    document.getElementById('accept-draw-btn')?.addEventListener('click', () => {
      this.gameController.acceptDraw();
    });

    document.getElementById('decline-draw-btn')?.addEventListener('click', () => {
      this.gameController.declineDraw();
    });

    document.getElementById('rematch-btn')?.addEventListener('click', () => {
      this.gameController.offerRematch();
    });

    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      this.closeGameAndReturnHome();
    });

    document.getElementById('exit-spectate-btn')?.addEventListener('click', () => {
      this.closeGameAndReturnHome();
      this.navigate('live');
    });

    document.getElementById('btn-quick-live')?.addEventListener('click', () => {
      this.navigate('live');
    });

    // Profile game tabs
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.profileController.updateProfileStatCard(tab.dataset.profileGame);
      });
    });

    // Leaderboard tabs
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.profileController.renderLeaderboard(tab.dataset.game);
      });
    });

    // Leaderboard search filter
    document.getElementById('lb-search-input')?.addEventListener('input', e => {
      this.profileController.filterLeaderboard(e.target.value);
    });

    // Admin user search filter
    document.getElementById('admin-user-search')?.addEventListener('input', e => {
      this.profileController.renderAdmin(e.target.value);
    });

    // Settings sound toggle
    document.getElementById('sound-toggle')?.addEventListener('change', e => {
      sounds.enabled = e.target.checked;
    });
  }

  openFriendInviteModal() {
    const modal = document.getElementById('friend-invite-modal');
    if (modal) {
      document.getElementById('invite-share-box')?.classList.add('hidden');
      document.getElementById('generate-invite-link-btn').style.display = 'block';
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  }

  closeInviteModal() {
    if (this.invitePollTimer) {
      clearInterval(this.invitePollTimer);
      this.invitePollTimer = null;
    }
    const modal = document.getElementById('friend-invite-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  async createAndShowInviteLink(gameType, timeControl) {
    try {
      const res = await api.createInvite(gameType, timeControl);
      if (!res.success || !res.gameId) {
        throw new Error(res.error || 'Havola yaratib bo‘lmadi');
      }

      this.openInviteModalWithExisting(res.gameId, gameType, timeControl);
    } catch (err) {
      this.showToast(`Xatolik: ${err.message}`, 'error');
    }
  }

  openInviteModalWithExisting(gameId, gameType, timeControl) {
    const inviteUrl = `https://t.me/chess_checkerbot?start=game_${gameId}`;
    const directMiniAppUrl = `https://app9223102562.tgcloud.ai/?gameId=${gameId}`;

    const input = document.getElementById('invite-link-input');
    if (input) input.value = inviteUrl;

    document.getElementById('invite-share-box')?.classList.remove('hidden');
    document.getElementById('generate-invite-link-btn').style.display = 'none';

    const modal = document.getElementById('friend-invite-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }

    // Host polls until friend joins and game becomes active
    if (this.invitePollTimer) clearInterval(this.invitePollTimer);
    this.invitePollTimer = setInterval(async () => {
      try {
        const gameRes = await api.getGame(gameId);
        if (gameRes.success && gameRes.game && gameRes.game.status === 'active') {
          clearInterval(this.invitePollTimer);
          this.invitePollTimer = null;
          this.closeInviteModal();
          this.showToast('Raqib qo‘shildi! O‘yin boshlandi!', 'success');
          this.launchGame(gameId);
        }
      } catch {
        // Polling retry
      }
    }, 1500);
  }

  navigate(viewName) {
    if (viewName === 'admin' && !this.currentUser.isAdmin) {
      this.showToast('Ruxsat etilmagan: Faqat adminlar uchun', 'error');
      return;
    }

    if (this.currentView === 'live' && viewName !== 'live') {
      this.liveController.stop();
    }
    if (this.currentView === 'game' && viewName !== 'game') {
      this.gameController.stopClock();
      this.gameController.stopPolling();
    }

    this.currentView = viewName;

    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    if (viewName === 'live') {
      this.liveController.start();
    } else if (viewName === 'profile') {
      this.profileController.renderProfile();
    } else if (viewName === 'leaderboard') {
      this.profileController.renderLeaderboard(this.profileController.leaderboardType);
    } else if (viewName === 'history') {
      this.profileController.renderHistory();
    } else if (viewName === 'admin') {
      this.profileController.renderAdmin();
    }
  }

  launchGame(gameId) {
    this.navigate('game');
    this.gameController.loadGame(gameId);
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast toast-${type} show`;

    setTimeout(() => {
      toast.className = 'toast hidden';
    }, 3200);
  }
}

window.app = new WellChessApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
