import api from './api.js';
import { GameController, sounds } from './game.js';
import { MatchmakingController } from './matchmaking.js';
import { ProfileController } from './profile.js';
import { LiveController } from './live.js';
import { GameReplayer } from './replayer.js';
import { ICONS } from '../assets/icons.js';

class WellChessApp {
  constructor() {
    this.currentUser = {
      id: 1001,
      firstName: 'O‘yinchi',
      username: 'player',
      photoUrl: '',
      chessElo: 1200,
      checkersElo: 1200,
      checkers8Elo: 1200
    };

    this.currentView = 'home';
    this.gameController = new GameController(this);
    this.matchmakingController = new MatchmakingController(this);
    this.profileController = new ProfileController(this);
    this.liveController = new LiveController(this);
    this.gameReplayer = new GameReplayer();

    this.selectedGameType = 'chess';
    this.selectedTimeControl = '3+2';
    this.invitePollTimer = null;
    this.pendingInviteGameId = null;
    this.pendingChallengesTimer = null;
    this.activeIncomingChallenge = null;
    this.currentTheme = 'dark';
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
          languageCode: tg.initDataUnsafe.user.language_code || 'uz',
          photoUrl: tg.initDataUnsafe.user.photo_url || ''
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
    this.initTheme();
    this.renderIcons();
    this.bindEvents();
    this.initPieceTheme();
    this.startPendingChallengesPoll();

    const params = new URLSearchParams(window.location.search);
    const joinMatchHost = params.get('joinMatch');
    const deepGameId = params.get('gameId');
    const autoPlay = params.get('game');
    const autoQuick = params.get('quick');
    const contactAdminParam = params.get('contact_admin');
    const rulesParam = params.get('rules');

    const adminParam = params.get('admin');
    const viewParam = params.get('view');

    if (contactAdminParam === '1' || viewParam === 'contact_admin' || viewParam === 'chat') {
      this.openContactAdminModal();
    } else if (adminParam === '1' || viewParam === 'admin') {
      this.navigate('admin');
    } else if (rulesParam === '1') {
      this.openRulesModal();
    }

    if (joinMatchHost) {
      await this.handleJoinMatchFromInvite(joinMatchHost, autoPlay || 'chess', params.get('tc') || '3+2');
    } else if (deepGameId) {
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
      let changed = false;
      if (url.searchParams.has('gameId')) {
        url.searchParams.delete('gameId');
        changed = true;
      }
      if (url.searchParams.has('joinMatch')) {
        url.searchParams.delete('joinMatch');
        changed = true;
      }
      if (changed) {
        window.history.replaceState({}, document.title, url.pathname);
      }
    } catch {}
  }

  async handleJoinMatchFromInvite(hostUserId, gameType, timeControl) {
    if (Number(hostUserId) === Number(this.currentUser.id)) {
      this.clearGameUrlParam();
      this.showToast('O‘zingiz bilan o‘ynay olmaysiz', 'error');
      this.navigate('home');
      return;
    }

    this.showToast('⚔️ O‘yinga ulanmoqda...', 'info');

    try {
      const res = await api.acceptMatchChallenge(hostUserId, gameType, timeControl);
      if (res.success && res.status === 'matched' && res.gameId) {
        this.clearGameUrlParam();
        this.showToast('Bellashuv qabul qilindi! O‘yin boshlandi!', 'success');
        this.launchGame(res.gameId);
        return;
      }

      this.clearGameUrlParam();
      this.showToast(res.message || 'Ushbu taklif muddati o‘tgan yoki o‘yin allaqachon boshlangan', 'info');
      this.navigate('home');
    } catch (err) {
      this.clearGameUrlParam();
      this.showToast(`Xatolik: ${err.message}`, 'error');
      this.navigate('home');
    }
  }

  startPendingChallengesPoll() {
    if (this.pendingChallengesTimer) clearInterval(this.pendingChallengesTimer);
    this.pendingChallengesTimer = setInterval(async () => {
      // Don't interrupt while inside an active game or while challenge dialog is open
      if (this.currentView === 'game' || this.activeIncomingChallenge) return;

      try {
        const res = await api.getPendingChallenges();
        if (res.success && res.challenges && res.challenges.length > 0) {
          const latest = res.challenges[0];
          this.showIncomingChallenge(latest);
        }
      } catch {
        // Silent poll
      }
    }, 3200);
  }

  showIncomingChallenge(challenge) {
    this.activeIncomingChallenge = challenge;
    const modal = document.getElementById('incoming-challenge-modal');
    if (!modal) return;

    sounds.play('move');

    const pName = challenge.whitePlayer?.firstName || 'O‘yinchi';
    const pElo = challenge.whitePlayer?.elo || 1200;
    let gName = 'Shaxmat (8x8 FIDE)';
    if (challenge.gameType === 'checkers8') gName = 'Klassik shashka (8x8, 12 tosh)';
    else if (challenge.gameType === 'checkers') gName = 'Xalqaro shashka (10x10, 20 tosh)';

    const nameEl = document.getElementById('incoming-challenger-name');
    const eloEl = document.getElementById('incoming-challenger-elo');
    const typeEl = document.getElementById('incoming-challenge-type');
    const tcEl = document.getElementById('incoming-challenge-tc');

    if (nameEl) nameEl.textContent = pName;
    if (eloEl) eloEl.textContent = `${pElo} ELO`;
    if (typeEl) typeEl.textContent = gName;
    if (tcEl) tcEl.textContent = challenge.timeControl || '5+0';

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  closeIncomingChallenge() {
    this.activeIncomingChallenge = null;
    const modal = document.getElementById('incoming-challenge-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  async handleDeepGameLink(gameId) {
    try {
      const cleanGameId = String(gameId || '').replace(/^game_game_/, 'game_');
      const res = await api.getGame(cleanGameId);
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
          this.launchGame(cleanGameId);
        } else {
          // Open as spectator
          this.spectateGame(cleanGameId);
        }
        return;
      }

      if (game.status === 'waiting') {
        if (Number(game.whiteId) === Number(this.currentUser.id)) {
          // Current user is host
          this.openInviteModalWithExisting(cleanGameId, game.gameType, game.timeControl);
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
    const headerAvatar = document.getElementById('header-user-avatar');
    const chessEloEl = document.getElementById('home-chess-elo');
    const checkers8EloEl = document.getElementById('home-checkers8-elo');
    const checkersEloEl = document.getElementById('home-checkers-elo');

    const firstName = this.currentUser.firstName || 'O‘yinchi';
    if (nameEl) nameEl.textContent = firstName;

    const initial = firstName.charAt(0).toUpperCase();
    if (headerAvatar) {
      if (this.currentUser.photoUrl) {
        headerAvatar.innerHTML = `<img src="${this.currentUser.photoUrl}" class="avatar-img" alt="${firstName}" onerror="this.parentElement.innerHTML='<span class=\\'avatar-initials\\'>${initial}</span>'" />`;
      } else {
        headerAvatar.innerHTML = `<span class="avatar-initials">${initial}</span>`;
      }
    }

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

  initPieceTheme() {
    this.initCustomizationThemes();
  }

  initCustomizationThemes() {
    const savedBoard = localStorage.getItem('wellchess_board_theme') || 'wood';
    const savedPiece = localStorage.getItem('wellchess_piece_theme') || 'classic';
    document.body.dataset.boardTheme = savedBoard;
    document.body.dataset.pieceTheme = savedPiece;

    // Board theme pills in settings
    const boardPills = document.querySelectorAll('.board-theme-pill');
    boardPills.forEach(pill => {
      pill.classList.toggle('selected', pill.dataset.boardTheme === savedBoard);
      pill.addEventListener('click', () => {
        const theme = pill.dataset.boardTheme;
        localStorage.setItem('wellchess_board_theme', theme);
        document.body.dataset.boardTheme = theme;
        boardPills.forEach(p => p.classList.toggle('selected', p === pill));
        this.showToast(`Taxta dizayni tanlandi: ${pill.textContent.trim()}`, 'success');
      });
    });

    // Piece theme pills in settings
    const piecePills = document.querySelectorAll('.piece-theme-pill');
    piecePills.forEach(pill => {
      pill.classList.toggle('selected', pill.dataset.pieceTheme === savedPiece);
      pill.addEventListener('click', () => {
        const theme = pill.dataset.pieceTheme;
        localStorage.setItem('wellchess_piece_theme', theme);
        document.body.dataset.pieceTheme = theme;
        piecePills.forEach(p => p.classList.toggle('selected', p === pill));
        this.showToast(`Toshlar dizayni tanlandi: ${pill.textContent.trim()}`, 'success');
      });
    });

    // In-game theme customizer modal
    document.getElementById('game-theme-btn')?.addEventListener('click', () => {
      this.openThemeSelectorModal();
    });
    document.getElementById('close-theme-modal-btn')?.addEventListener('click', () => {
      this.closeThemeSelectorModal();
    });
    document.getElementById('theme-selector-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'theme-selector-modal') this.closeThemeSelectorModal();
    });

    document.querySelectorAll('.theme-choice-card[data-modal-board]').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.theme-choice-card[data-modal-board]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    document.querySelectorAll('.theme-choice-card[data-modal-piece]').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.theme-choice-card[data-modal-piece]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    document.getElementById('btn-save-theme-modal')?.addEventListener('click', () => {
      const selectedBoardCard = document.querySelector('.theme-choice-card[data-modal-board].selected');
      const selectedPieceCard = document.querySelector('.theme-choice-card[data-modal-piece].selected');
      if (selectedBoardCard) {
        const boardTheme = selectedBoardCard.dataset.modalBoard;
        localStorage.setItem('wellchess_board_theme', boardTheme);
        document.body.dataset.boardTheme = boardTheme;
        boardPills.forEach(p => p.classList.toggle('selected', p.dataset.boardTheme === boardTheme));
      }
      if (selectedPieceCard) {
        const pieceTheme = selectedPieceCard.dataset.modalPiece;
        localStorage.setItem('wellchess_piece_theme', pieceTheme);
        document.body.dataset.pieceTheme = pieceTheme;
        piecePills.forEach(p => p.classList.toggle('selected', p.dataset.pieceTheme === pieceTheme));
      }
      this.closeThemeSelectorModal();
      this.showToast('🎨 Dizayn sozlamalari muvaffaqiyatli saqlandi!', 'success');
    });
  }

  openThemeSelectorModal() {
    const modal = document.getElementById('theme-selector-modal');
    if (!modal) return;
    const currentBoard = document.body.dataset.boardTheme || 'wood';
    const currentPiece = document.body.dataset.pieceTheme || 'classic';

    document.querySelectorAll('.theme-choice-card[data-modal-board]').forEach(card => {
      card.classList.toggle('selected', card.dataset.modalBoard === currentBoard);
    });
    document.querySelectorAll('.theme-choice-card[data-modal-piece]').forEach(card => {
      card.classList.toggle('selected', card.dataset.modalPiece === currentPiece);
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  closeThemeSelectorModal() {
    const modal = document.getElementById('theme-selector-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  async openPlayerInspectModal(targetUserId) {
    const modal = document.getElementById('player-inspect-modal');
    if (!modal) return;

    const nameEl = document.getElementById('inspect-player-name');
    const userEl = document.getElementById('inspect-player-username');
    const avatarBox = document.getElementById('inspect-avatar-box');

    if (nameEl) nameEl.textContent = 'Yuklanmoqda...';
    if (userEl) userEl.textContent = '...';
    if (avatarBox) avatarBox.innerHTML = '<div class="avatar-wrap avatar-lg"><span class="avatar-initials">...</span></div>';

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    try {
      const res = await api.inspectUser(targetUserId);
      if (!res.success || !res.user) throw new Error(res.error || 'Ma‘lumot topilmadi');

      const u = res.user;
      const initial = (u.firstName || 'O').charAt(0).toUpperCase();

      if (nameEl) nameEl.textContent = `${u.firstName || 'O‘yinchi'} ${u.lastName || ''}`;
      if (userEl) userEl.textContent = u.username ? `@${u.username}` : `ID: ${u.id}`;

      if (avatarBox) {
        if (u.photoUrl) {
          avatarBox.innerHTML = `<div class="avatar-wrap avatar-lg"><img src="${u.photoUrl}" class="avatar-img" alt="${u.firstName}" onerror="this.parentElement.innerHTML='<span class=\\'avatar-initials\\'>${initial}</span>'" /></div>`;
        } else {
          avatarBox.innerHTML = `<div class="avatar-wrap avatar-lg"><span class="avatar-initials">${initial}</span></div>`;
        }
      }

      // Chess stats
      document.getElementById('inspect-chess-elo').textContent = `${u.chessElo || 1200} ELO`;
      document.getElementById('inspect-chess-total').textContent = u.chessTotal || 0;
      document.getElementById('inspect-chess-record').textContent = `${u.chessWins || 0}G' / ${u.chessLosses || 0}M / ${u.chessDraws || 0}D`;
      document.getElementById('inspect-chess-winrate').textContent = `${u.chessWinRate || 0}%`;

      // Checkers 8x8 stats
      document.getElementById('inspect-checkers8-elo').textContent = `${u.checkers8Elo || 1200} ELO`;
      document.getElementById('inspect-checkers8-total').textContent = u.checkers8Total || 0;
      document.getElementById('inspect-checkers8-record').textContent = `${u.checkers8Wins || 0}G' / ${u.checkers8Losses || 0}M / ${u.checkers8Draws || 0}D`;
      document.getElementById('inspect-checkers8-winrate').textContent = `${u.checkers8WinRate || 0}%`;

      // Checkers 10x10 stats
      document.getElementById('inspect-checkers-elo').textContent = `${u.checkersElo || 1200} ELO`;
      document.getElementById('inspect-checkers-total').textContent = u.checkersTotal || 0;
      document.getElementById('inspect-checkers-record').textContent = `${u.checkersWins || 0}G' / ${u.checkersLosses || 0}M / ${u.checkersDraws || 0}D`;
      document.getElementById('inspect-checkers-winrate').textContent = `${u.checkersWinRate || 0}%`;

      // Challenge button
      const challengeBtn = document.getElementById('inspect-challenge-btn');
      if (challengeBtn) {
        challengeBtn.onclick = () => {
          this.closePlayerInspectModal();
          this.liveController.openChallengeModal(u);
        };
      }
    } catch (err) {
      if (nameEl) nameEl.textContent = 'Xatolik';
      if (userEl) userEl.textContent = err.message;
    }
  }

  closePlayerInspectModal() {
    const modal = document.getElementById('player-inspect-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
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
      'icon-nav-admin': ICONS.shield,
      'icon-admin-view-title': ICONS.shield,
      'icon-admin-refresh': ICONS.refresh,
      'icon-admin-msg-title': ICONS.mail,
      'icon-btn-open-rules': ICONS.book,
      'icon-btn-open-contact': ICONS.mail,
      'icon-btn-send-contact': ICONS.send,
      'icon-contact-modal-title': ICONS.mail,
      'icon-theme-mode': this.currentTheme === 'light' ? ICONS.moon : ICONS.sun,
      'icon-pill-dark': ICONS.moon,
      'icon-pill-light': ICONS.sun,
      'icon-btn-chat': ICONS.chat,
      'icon-chat-drawer-title': ICONS.chat,
      'icon-btn-send-chat': ICONS.send
    };

    for (const [id, svg] of Object.entries(iconMap)) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = svg;
    }
  }

  initTheme() {
    let saved = 'dark';
    try {
      saved = localStorage.getItem('wellchess_theme') || 'dark';
    } catch {}
    this.setTheme(saved, false);
  }

  setTheme(theme, showToast = true) {
    this.currentTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = this.currentTheme;
    try {
      localStorage.setItem('wellchess_theme', this.currentTheme);
    } catch {}

    const themeText = document.getElementById('header-theme-text');
    if (themeText) {
      themeText.textContent = this.currentTheme === 'light' ? 'Oq' : 'Qora';
    }

    const themeIcon = document.getElementById('icon-theme-mode');
    if (themeIcon) {
      themeIcon.innerHTML = this.currentTheme === 'light' ? ICONS.moon : ICONS.sun;
    }

    document.querySelectorAll('.theme-mode-pill').forEach(pill => {
      pill.classList.toggle('selected', pill.dataset.themeMode === this.currentTheme);
    });

    if (showToast) {
      this.showToast(this.currentTheme === 'light' ? '☀️ Oq rejim faollashtirildi' : '🌙 Qora rejim faollashtirildi', 'info');
    }
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme, true);
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

    // Incoming Challenge accept/decline
    document.getElementById('incoming-accept-btn')?.addEventListener('click', async () => {
      if (!this.activeIncomingChallenge) return;
      const gameId = this.activeIncomingChallenge.id;
      this.closeIncomingChallenge();

      try {
        const res = await api.acceptInvite(gameId);
        if (res.success) {
          this.showToast('Taklif qabul qilindi! O‘yin boshlandi!', 'success');
          this.launchGame(gameId);
        } else {
          this.showToast(res.error || 'Taklifni qabul qilib bo‘lmadi', 'error');
        }
      } catch (err) {
        this.showToast(`Xatolik: ${err.message}`, 'error');
      }
    });

    document.getElementById('incoming-decline-btn')?.addEventListener('click', async () => {
      if (!this.activeIncomingChallenge) return;
      const gameId = this.activeIncomingChallenge.id;
      this.closeIncomingChallenge();

      try {
        await api.declineInvite(gameId);
        this.showToast('Taklif rad etildi', 'info');
      } catch {
        // ignore
      }
    });

    // Direct Telegram ID invite
    document.getElementById('direct-invite-id-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('direct-invite-id-input');
      const targetId = input?.value?.trim();
      if (!targetId) {
        this.showToast('Iltimos, Telegram ID ni kiriting', 'error');
        return;
      }
      await this.sendDirectInvite(targetId, `Foydalanuvchi (${targetId})`);
    });

    // Toggle fallback link
    document.getElementById('toggle-fallback-link-btn')?.addEventListener('click', () => {
      const shareBox = document.getElementById('invite-share-box');
      if (shareBox) {
        shareBox.classList.toggle('hidden');
      }
    });

    // Cancel invite waiting
    document.getElementById('cancel-invite-wait-btn')?.addEventListener('click', () => {
      this.closeInviteModal();
      this.showToast('Taklif bekor qilindi', 'info');
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

    document.getElementById('modal-new-game-btn')?.addEventListener('click', () => {
      this.closeGameAndReturnHome();
      this.navigate('home');
      this.showToast('Yangi o‘yin rejimini tanlang va boshlang!', 'info');
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

    // Admin refresh button
    document.getElementById('admin-refresh-btn')?.addEventListener('click', () => {
      const q = document.getElementById('admin-user-search')?.value || '';
      this.profileController.renderAdmin(q);
      this.showToast('Admin paneli yangilandi', 'info');
    });

    // Settings sound toggle
    document.getElementById('sound-toggle')?.addEventListener('change', e => {
      sounds.enabled = e.target.checked;
    });

    // Player Inspect Modal close events
    document.getElementById('close-inspect-modal-btn')?.addEventListener('click', () => {
      this.closePlayerInspectModal();
    });

    document.getElementById('player-inspect-modal')?.addEventListener('click', e => {
      if (e.target.id === 'player-inspect-modal') {
        this.closePlayerInspectModal();
      }
    });

    // Contact Admin Modal events
    document.getElementById('btn-open-contact-admin')?.addEventListener('click', () => {
      this.openContactAdminModal();
    });
    document.getElementById('close-contact-modal-btn')?.addEventListener('click', () => {
      this.closeContactAdminModal();
    });
    document.getElementById('btn-cancel-contact')?.addEventListener('click', () => {
      this.closeContactAdminModal();
    });
    document.getElementById('btn-send-contact')?.addEventListener('click', () => {
      this.submitContactAdmin();
    });
    document.getElementById('contact-message-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submitContactAdmin();
      }
    });
    document.getElementById('contact-admin-modal')?.addEventListener('click', e => {
      if (e.target.id === 'contact-admin-modal') {
        this.closeContactAdminModal();
      }
    });

    // Rules Modal events
    document.getElementById('btn-open-rules')?.addEventListener('click', () => {
      this.openRulesModal();
    });
    document.getElementById('btn-close-rules')?.addEventListener('click', () => {
      this.closeRulesModal();
    });
    document.getElementById('btn-close-rules-bottom')?.addEventListener('click', () => {
      this.closeRulesModal();
    });
    document.getElementById('rules-modal')?.addEventListener('click', e => {
      if (e.target.id === 'rules-modal') {
        this.closeRulesModal();
      }
    });
    document.querySelectorAll('.rules-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchRulesTab(btn.dataset.rulesTab);
      });
    });

    // Theme Toggle Header & Settings
    document.getElementById('header-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    document.querySelectorAll('.theme-mode-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const mode = pill.dataset.themeMode;
        if (mode) this.setTheme(mode, true);
      });
    });

    // In-Game Real-Time Chat actions
    document.getElementById('game-chat-toggle-btn')?.addEventListener('click', () => {
      this.gameController.toggleChat();
    });

    document.getElementById('close-game-chat-btn')?.addEventListener('click', () => {
      this.gameController.toggleChat(false);
    });

    document.getElementById('game-chat-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('game-chat-input');
      const val = input ? input.value : '';
      if (val.trim()) {
        this.gameController.sendChatMessage(val);
        if (input) input.value = '';
      }
    });

    document.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.quickChat;
        if (text) {
          this.gameController.sendChatMessage(text);
        }
      });
    });
  }

  openContactAdminModal() {
    const modal = document.getElementById('contact-admin-modal');
    if (!modal) return;
    const msgInput = document.getElementById('contact-message-input');
    const feedback = document.getElementById('contact-feedback-msg');
    if (msgInput) msgInput.value = '';
    if (feedback) {
      feedback.className = 'contact-status-alert hidden';
      feedback.textContent = '';
      feedback.style.display = 'none';
    }
    const sendBtn = document.getElementById('btn-send-contact');
    if (sendBtn) {
      sendBtn.disabled = false;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    this.loadSupportChatThread();

    // Start live polling while modal is open (every 2.5 seconds)
    if (this.supportPollTimer) clearInterval(this.supportPollTimer);
    this.supportPollTimer = setInterval(() => {
      this.loadSupportChatThread(true);
    }, 2500);
  }

  closeContactAdminModal() {
    const modal = document.getElementById('contact-admin-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
    if (this.supportPollTimer) {
      clearInterval(this.supportPollTimer);
      this.supportPollTimer = null;
    }
  }

  async loadSupportChatThread(isBackground = false) {
    const thread = document.getElementById('support-chat-thread');
    if (!thread) return;

    try {
      const res = await api.getSupportMessages();
      if (res && res.success && Array.isArray(res.messages)) {
        this.renderSupportChatThread(res.messages, isBackground);
      } else if (!isBackground) {
        thread.innerHTML = '<div class="support-empty-state">Hozircha xabarlar yo‘q. Murojaatingizni yozib qoldiring, admin tez orada javob beradi!</div>';
      }
    } catch (err) {
      if (!isBackground) {
        thread.innerHTML = `<div class="support-error-state">Xabarlarni yuklashda xatolik: ${err.message}</div>`;
      }
    }
  }

  renderSupportChatThread(messages, isBackground = false) {
    const thread = document.getElementById('support-chat-thread');
    if (!thread) return;

    if (!messages || messages.length === 0) {
      thread.innerHTML = `
        <div class="support-empty-state">
          <div class="support-empty-icon">💬</div>
          <div class="support-empty-title">Admin bilan jonli muloqot</div>
          <div class="support-empty-text">Platforma bo‘yicha har qanday savol, taklif yoki texnik muammoni shu yerga yozing. Admin tez orada javob qaytaradi!</div>
        </div>
      `;
      return;
    }

    const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let html = '';
    messages.forEach(m => {
      const msgDate = m.createdAt
        ? new Date(m.createdAt * 1000).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '';
      const replyDate = m.repliedAt
        ? new Date(m.repliedAt * 1000).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '';

      html += `
        <div class="support-msg-pair">
          <div class="support-user-bubble">
            <div class="support-bubble-header">
              <span class="support-topic-tag">📌 ${escapeHtml(m.topic || 'Umumiy')}</span>
              <span class="support-time">${msgDate}</span>
            </div>
            <div class="support-user-text">${escapeHtml(m.message)}</div>
            <div class="support-msg-status">
              ${m.replyText ? '<span class="status-replied">✓ Javob berildi</span>' : '<span class="status-waiting">⏳ Admin ko‘rib chiqmoqda...</span>'}
            </div>
          </div>

          ${m.replyText ? `
            <div class="support-admin-bubble">
              <div class="support-admin-badge">
                <span class="admin-badge-icon">🛡️</span>
                <span class="admin-badge-name">${escapeHtml(m.repliedBy || 'Admin')}</span>
                <span class="admin-badge-time">${replyDate}</span>
              </div>
              <div class="support-admin-text">${escapeHtml(m.replyText)}</div>
            </div>
          ` : ''}
        </div>
      `;
    });

    const isScrolledToBottom = (thread.scrollHeight - thread.scrollTop - thread.clientHeight) < 60;
    thread.innerHTML = html;
    if (!isBackground || isScrolledToBottom) {
      thread.scrollTop = thread.scrollHeight;
    }
  }

  async submitContactAdmin() {
    const msgInput = document.getElementById('contact-message-input');
    const topicSelect = document.getElementById('contact-topic-select');
    const feedback = document.getElementById('contact-feedback-msg');
    const sendBtn = document.getElementById('btn-send-contact');

    const message = (msgInput?.value || '').trim();
    const topic = topicSelect?.value || 'Umumiy';

    if (!message) {
      if (feedback) {
        feedback.className = 'contact-status-alert error';
        feedback.style.display = 'block';
        feedback.textContent = 'Iltimos, murojaat matnini kiriting!';
        feedback.classList.remove('hidden');
      }
      return;
    }

    if (feedback) {
      feedback.className = 'contact-status-alert hidden';
      feedback.style.display = 'none';
    }

    if (sendBtn) {
      sendBtn.disabled = true;
    }

    try {
      const res = await api.sendSupportMessage(message, topic);
      if (res && res.success) {
        if (msgInput) msgInput.value = '';
        this.showToast('✅ Murojaatingiz yuborildi!', 'success');
        await this.loadSupportChatThread();
      } else {
        throw new Error(res?.error || res?.message || 'Xatolik yuz berdi');
      }
    } catch (err) {
      if (feedback) {
        feedback.className = 'contact-status-alert error';
        feedback.style.display = 'block';
        feedback.textContent = `Xatolik: ${err.message}`;
        feedback.classList.remove('hidden');
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
      }
    }
  }

  openRulesModal(defaultTab = 'chess') {
    const modal = document.getElementById('rules-modal');
    if (!modal) return;
    this.switchRulesTab(defaultTab);
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  closeRulesModal() {
    const modal = document.getElementById('rules-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  switchRulesTab(tabKey) {
    document.querySelectorAll('.rules-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.rulesTab === tabKey);
    });
    document.querySelectorAll('.rules-section').forEach(sec => {
      sec.classList.add('hidden');
      sec.style.display = 'none';
    });
    const target = document.getElementById(`rules-sec-${tabKey}`);
    if (target) {
      target.classList.remove('hidden');
      target.style.display = 'block';
    }
  }

  async openFriendInviteModal() {
    const modal = document.getElementById('friend-invite-modal');
    if (!modal) return;

    // Reset visibility states
    document.getElementById('invite-waiting-box')?.classList.add('hidden');
    document.getElementById('invite-share-box')?.classList.add('hidden');
    document.getElementById('friend-invite-main-section')?.classList.remove('hidden');

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    await this.loadFriendInvitePlayers();
  }

  async loadFriendInvitePlayers() {
    const listEl = document.getElementById('friend-invite-players-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="loader-spinner-sm"></div>';

    try {
      const res = await api.getOnlinePlayers();
      if (!res.success || !res.players || res.players.length === 0) {
        listEl.innerHTML = '<div class="text-muted" style="font-size: 0.8rem; padding: 6px;">Hozircha onlayn o‘yinchilar yo‘q. Quyida Telegram ID orqali chaqirishingiz mumkin.</div>';
        return;
      }

      listEl.innerHTML = '';
      const topPlayers = res.players.slice(0, 6);

      for (const p of topPlayers) {
        const item = document.createElement('div');
        item.className = 'friend-player-item';
        item.innerHTML = `
          <div class="friend-player-info">
            <span class="friend-player-name">${p.firstName || 'O‘yinchi'}</span>
            <span class="friend-player-elo">${p.chessElo || 1200} ELO</span>
          </div>
          <button class="btn-small btn-primary friend-invite-btn" data-user-id="${p.id}" data-name="${p.firstName || 'O‘yinchi'}">
            <span class="btn-inline-icon">${ICONS.challenge}</span>
            <span>Taklif qilish</span>
          </button>
        `;

        item.querySelector('.friend-invite-btn')?.addEventListener('click', async () => {
          await this.sendDirectInvite(p.id, p.firstName || 'O‘yinchi');
        });

        listEl.appendChild(item);
      }
    } catch (err) {
      listEl.innerHTML = `<div class="text-muted" style="font-size: 0.8rem;">Xatolik: ${err.message}</div>`;
    }
  }

  async sendDirectInvite(targetUserId, targetName) {
    const gameType = document.getElementById('invite-game-type')?.value || this.selectedGameType || 'checkers8';
    const timeControl = document.getElementById('invite-time-control')?.value || this.selectedTimeControl || '5+0';

    try {
      this.showToast(`Bot orqali ${targetName}ga taklif yuborilmoqda...`, 'info');
      const res = await api.createInvite(gameType, timeControl, targetUserId);
      if (!res.success || !res.gameId) {
        throw new Error(res.error || 'Taklif yaratib bo‘lmadi');
      }

      this.openInviteWaitingModal(res.gameId, targetName, gameType, timeControl);
      this.showToast(`✅ ${targetName}ga bot orqali taklif yuborildi!`, 'success');
    } catch (err) {
      this.showToast(`Xatolik: ${err.message}`, 'error');
    }
  }

  openInviteWaitingModal(gameId, targetName, gameType, timeControl) {
    const modal = document.getElementById('friend-invite-modal');
    if (!modal) return;

    document.getElementById('friend-invite-main-section')?.classList.add('hidden');
    const waitingBox = document.getElementById('invite-waiting-box');
    const waitingText = document.getElementById('invite-waiting-text');

    if (waitingBox) waitingBox.classList.remove('hidden');
    if (waitingText) {
      waitingText.innerHTML = `<b>${targetName}</b>ga bot orqali taklif yuborildi!<br><small style="color: var(--text-muted);">U qabul qilishi bilan o‘yin darhol boshlanadi...</small>`;
    }

    // Also populate fallback link input
    const cleanId = String(gameId || '').replace(/^game_game_/, 'game_');
    const inviteUrl = `https://t.me/chess_checkerbot?start=${cleanId.startsWith('game_') ? cleanId : 'game_' + cleanId}`;
    const input = document.getElementById('invite-link-input');
    if (input) input.value = inviteUrl;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Host polls until friend joins and game becomes active
    if (this.invitePollTimer) clearInterval(this.invitePollTimer);
    this.invitePollTimer = setInterval(async () => {
      try {
        const gameRes = await api.getGame(gameId);
        if (gameRes.success && gameRes.game && gameRes.game.status === 'active') {
          clearInterval(this.invitePollTimer);
          this.invitePollTimer = null;
          this.closeInviteModal();
          this.showToast('Raqib taklifni qabul qildi! O‘yin boshlandi!', 'success');
          this.launchGame(gameId);
        }
      } catch {
        // Polling retry
      }
    }, 1500);
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
    const cleanId = String(gameId || '').replace(/^game_game_/, 'game_');
    const inviteUrl = `https://t.me/chess_checkerbot?start=${cleanId.startsWith('game_') ? cleanId : 'game_' + cleanId}`;
    const input = document.getElementById('invite-link-input');
    if (input) input.value = inviteUrl;

    document.getElementById('friend-invite-main-section')?.classList.add('hidden');
    const waitingBox = document.getElementById('invite-waiting-box');
    const waitingText = document.getElementById('invite-waiting-text');
    if (waitingBox) waitingBox.classList.remove('hidden');
    if (waitingText) {
      waitingText.innerHTML = `Taklif tayyorlandi!<br><small style="color: var(--text-muted);">Do‘stingiz qabul qilishi bilan o‘yin darhol boshlanadi...</small>`;
    }

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
