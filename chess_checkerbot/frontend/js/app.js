import api from './api.js';
import { GameController, sounds } from './game.js';
import { MatchmakingController } from './matchmaking.js';
import { ProfileController } from './profile.js';
import { ICONS } from '../assets/icons.js';

class WellChessApp {
  constructor() {
    this.currentUser = {
      id: 1001,
      firstName: 'Grandmaster',
      username: 'player',
      chessElo: 1000,
      checkersElo: 1000
    };

    this.currentView = 'home';
    this.gameController = new GameController(this);
    this.matchmakingController = new MatchmakingController(this);
    this.profileController = new ProfileController(this);

    this.selectedGameType = 'chess';
    this.selectedTimeControl = '3+2';
  }

  async init() {
    // 1. Initialize Telegram WebApp SDK
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
          firstName: tg.initDataUnsafe.user.first_name || 'Player',
          lastName: tg.initDataUnsafe.user.last_name || '',
          username: tg.initDataUnsafe.user.username || '',
          languageCode: tg.initDataUnsafe.user.language_code || 'en'
        };
      }
    }

    // 2. Fetch authenticated profile from backend
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

    // 3. Handle deep link query parameters
    const params = new URLSearchParams(window.location.search);
    const deepGameId = params.get('gameId');
    const autoPlay = params.get('game');
    const autoQuick = params.get('quick');

    if (deepGameId) {
      this.launchGame(deepGameId);
    } else if (autoQuick) {
      this.matchmakingController.startSearch('chess', '3+2');
    } else if (autoPlay) {
      this.selectedGameType = autoPlay;
      this.navigate('home');
    } else {
      this.navigate('home');
    }
  }

  updateUserUI() {
    const nameEl = document.getElementById('home-user-name');
    const chessEloEl = document.getElementById('home-chess-elo');
    const checkersEloEl = document.getElementById('home-checkers-elo');

    if (nameEl) nameEl.textContent = this.currentUser.firstName || 'Player';
    if (chessEloEl) chessEloEl.textContent = `${this.currentUser.chessElo || 1000} ELO`;
    if (checkersEloEl) checkersEloEl.textContent = `${this.currentUser.checkersElo || 1000} ELO`;

    // Only show admin tab if user ID is in ADMIN_IDS
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
      'icon-game-checkers': ICONS.checkers,
      'icon-btn-lightning': ICONS.lightning,
      'icon-radar-swords': ICONS.swords,
      'icon-btn-draw': ICONS.handshake,
      'icon-btn-resign': ICONS.flag,
      'icon-modal-rematch': ICONS.rematch,
      'icon-profile-user': ICONS.user,
      'icon-lb-chess': ICONS.chess,
      'icon-lb-checkers': ICONS.checkers,
      'icon-search-slot': ICONS.search,
      'icon-nav-home': ICONS.home,
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

    // Game type selector on Home
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

    // Quick Play / Find Match button
    document.getElementById('start-matchmaking-btn')?.addEventListener('click', () => {
      this.matchmakingController.startSearch(this.selectedGameType, this.selectedTimeControl);
    });

    // Cancel Matchmaking button
    document.getElementById('cancel-matchmaking-btn')?.addEventListener('click', () => {
      this.matchmakingController.cancel();
    });

    // Game controls (resign, draw, rematch)
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
      const modal = document.getElementById('game-over-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      this.navigate('home');
    });

    // Leaderboard tabs (Chess vs Checkers)
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

    // Settings sound toggle
    document.getElementById('sound-toggle')?.addEventListener('change', e => {
      sounds.enabled = e.target.checked;
    });
  }

  navigate(viewName) {
    // Prevent non-admins from opening admin view
    if (viewName === 'admin' && !this.currentUser.isAdmin) {
      this.showToast('Access restricted: Admins only', 'error');
      return;
    }

    this.currentView = viewName;

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    // Show target view panel
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('hidden');
    }

    // Update nav tab highlights
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Trigger view-specific data refresh
    if (viewName === 'profile') {
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
    }, 3000);
  }
}

window.app = new WellChessApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
