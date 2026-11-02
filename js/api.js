/**
 * WellChess API Client
 * Seamlessly handles Telegram Cloud Serverless RPC, REST endpoints,
 * and robust standalone offline fallback for GitHub Pages & browser testing.
 */

class ApiClient {
  constructor() {
    this.tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    this.baseUrl = window.WELLCHESS_API_URL || '';
    if (!this.baseUrl && typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
      this.baseUrl = 'https://app9223102562.tgcloud.ai';
    }
    this.initLocalStorage();
  }

  getInitData() {
    return this.tg?.initData || '';
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const initData = this.getInitData();
    if (initData) {
      // Official Telegram Cloud Serverless header: TMA <base64(initData)>
      try {
        const b64 = typeof window !== 'undefined' && window.btoa ? window.btoa(initData) : initData;
        headers['Authorization'] = `TMA ${b64}`;
      } catch {
        headers['Authorization'] = `TMA ${initData}`;
      }
      headers['x-telegram-init-data'] = initData;
    } else {
      headers['x-test-user-id'] = (typeof localStorage !== 'undefined' && localStorage.getItem('wellchess_dev_user_id')) || '1001';
    }

    return headers;
  }

  unwrapResponse(data) {
    if (!data || typeof data !== 'object') return data;
    // Unwraps Telegram Serverless { ok: true, result: ... } envelope
    if (data.ok === true && data.result !== undefined) {
      return this.unwrapResponse(data.result);
    }
    if (data.result !== undefined && data.success === undefined && data.status === undefined) {
      return this.unwrapResponse(data.result);
    }
    return data;
  }

  /**
   * Universal API call dispatcher
   */
  async call(endpoint, payload = {}) {
    // 1. Try native Telegram Cloud Serverless runtime
    if (this.tg?.Serverless?.call && this.getInitData()) {
      try {
        const res = await new Promise((resolve, reject) => {
          let resolved = false;
          try {
            this.tg.Serverless.call(endpoint, payload, (err, result) => {
              if (resolved) return;
              resolved = true;
              if (err) {
                reject(new Error(err.message || err.description || 'Serverless error'));
              } else {
                resolve(result);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
        if (res !== undefined) {
          return this.unwrapResponse(res);
        }
      } catch (err) {
        console.warn(`[Serverless.call on ${endpoint}]:`, err.message);
      }
    }

    // 2. Standard fetch POST to /api/<endpoint>
    const url = `${this.baseUrl}/api/${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response: ${text.slice(0, 80)}`);
      }

      if (!response.ok || data.ok === false) {
        const msg = data.error || data.description || data.message || `HTTP ${response.status}: Request failed`;
        throw new Error(msg);
      }

      return this.unwrapResponse(data);
    } catch (err) {
      console.warn(`[API network fallback for ${endpoint}]:`, err.message);
      // 3. Fallback to local standalone client storage
      return this.handleLocalFallback(endpoint, payload);
    }
  }

  // ================= Local Fallback Storage & Mock Engine =================
  initLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    if (!localStorage.getItem('wellchess_local_games')) {
      localStorage.setItem('wellchess_local_games', JSON.stringify({}));
    }
  }

  getLocalGames() {
    try {
      return JSON.parse(localStorage.getItem('wellchess_local_games') || '{}');
    } catch {
      return {};
    }
  }

  saveLocalGames(games) {
    try {
      localStorage.setItem('wellchess_local_games', JSON.stringify(games));
    } catch {}
  }

  handleLocalFallback(endpoint, payload) {
    const action = payload.action;
    const user = {
      id: Number((typeof localStorage !== 'undefined' && localStorage.getItem('wellchess_dev_user_id')) || 1001),
      firstName: this.tg?.initDataUnsafe?.user?.first_name || 'O‘yinchi',
      username: this.tg?.initDataUnsafe?.user?.username || 'player',
      chessElo: 1200,
      checkers8Elo: 1200,
      checkersElo: 1200,
      chessWins: 3,
      chessLosses: 1,
      chessDraws: 0,
      checkers8Wins: 5,
      checkers8Losses: 2,
      checkers8Draws: 1,
      checkersWins: 4,
      checkersLosses: 1,
      checkersDraws: 0,
      isAdmin: true
    };

    if (endpoint === 'profile') {
      if (action === 'stats') {
        return {
          success: true,
          stats: {
            chess: { elo: user.chessElo, wins: user.chessWins, losses: user.chessLosses, draws: user.chessDraws, total: 4, winRate: 75 },
            checkers8: { elo: user.checkers8Elo, wins: user.checkers8Wins, losses: user.checkers8Losses, draws: user.checkers8Draws, total: 8, winRate: 63 },
            checkers: { elo: user.checkersElo, wins: user.checkersWins, losses: user.checkersLosses, draws: user.checkersDraws, total: 5, winRate: 80 }
          }
        };
      }
      if (action === 'inspect') {
        const targetId = payload.targetUserId || 1002;
        return {
          success: true,
          user: {
            id: targetId,
            firstName: targetId === 6472114736 ? 'Asliddin Norqobilov' : 'Rustam Qosimov',
            username: targetId === 6472114736 ? 'asliddincoder0504' : 'rustam_gm',
            chessElo: 1290,
            checkers8Elo: 1260,
            checkersElo: 1250,
            chessWins: 14,
            chessLosses: 3,
            chessDraws: 1,
            chessTotal: 18,
            chessWinRate: 78,
            checkers8Wins: 12,
            checkers8Losses: 2,
            checkers8Draws: 1,
            checkers8Total: 15,
            checkers8WinRate: 80,
            checkersWins: 10,
            checkersLosses: 2,
            checkersDraws: 0,
            checkersTotal: 12,
            checkersWinRate: 83
          }
        };
      }
      return { success: true, user };
    }

    if (endpoint === 'contact_admin' || action === 'contact') {
      let localSupport = [];
      try { localSupport = JSON.parse(localStorage.getItem('wellchess_support_chat') || '[]'); } catch {}
      if (action === 'get_messages') {
        if (localSupport.length === 0) {
          localSupport = [
            {
              id: 1,
              senderId: user.id,
              senderName: user.firstName,
              topic: 'Umumiy',
              message: 'Assalomu alaykum! Mini ilovada qanday yangiliklar bor?',
              replyText: 'Va alaykum assalom! Yaqinda yangi toshlar va doskalar dizaynlari qo‘shildi. Omad tilaymiz!',
              repliedBy: 'Admin',
              createdAt: Math.floor(Date.now() / 1000) - 3600,
              repliedAt: Math.floor(Date.now() / 1000) - 1800
            }
          ];
          try { localStorage.setItem('wellchess_support_chat', JSON.stringify(localSupport)); } catch {}
        }
        return { success: true, messages: localSupport };
      }

      const newMsg = {
        id: Date.now(),
        senderId: user.id,
        senderName: user.firstName,
        topic: payload.topic || 'Umumiy',
        message: payload.message || payload.text,
        createdAt: Math.floor(Date.now() / 1000),
        replyText: null
      };
      localSupport.push(newMsg);
      try { localStorage.setItem('wellchess_support_chat', JSON.stringify(localSupport)); } catch {}
      return { success: true, message: 'Murojaatingiz adminlarga yetkazildi!', chatMessage: newMsg };
    }

    if (endpoint === 'admin') {
      if (action === 'stats') {
        return {
          success: true,
          stats: {
            totalUsers: 142,
            bannedUsers: 0,
            activeGamesCount: 2,
            matchmakingQueue: { totalWaiting: 0 }
          }
        };
      }
      if (action === 'messages') {
        return {
          success: true,
          messages: [
            {
              id: 1,
              senderId: 1002,
              senderName: 'Rustam Qosimov',
              username: 'rustam_gm',
              topic: 'Taklif',
              message: 'Assalomu alaykum! Turnirlar bo‘limi ham qo‘shilsa juda ajoyib bo‘lar edi.',
              createdAt: Math.floor(Date.now() / 1000) - 1800,
              isRead: 0
            }
          ]
        };
      }
      if (action === 'users') {
        return {
          success: true,
          users: [
            { id: 6472114736, firstName: 'Asliddin Norqobilov', username: 'asliddincoder0504', chessElo: 1350, checkers8Elo: 1320, checkersElo: 1300, isBanned: 0 },
            { id: 8455692606, firstName: 'Hamkor O‘yinchi', username: 'chess_friend', chessElo: 1280, checkers8Elo: 1250, checkersElo: 1240, isBanned: 0 },
            { id: 1002, firstName: 'Rustam Qosimov', username: 'rustam_gm', chessElo: 1290, checkers8Elo: 1240, checkersElo: 1210, isBanned: 0 }
          ]
        };
      }
      if (action === 'active_games') {
        return { success: true, games: [] };
      }
      return { success: true };
    }

    if (endpoint === 'leaderboard') {
      const gType = payload.gameType || 'chess';
      return {
        success: true,
        gameType: gType,
        leaderboard: [
          { rank: 1, id: 6472114736, firstName: 'Asliddin Norqobilov', username: 'asliddincoder0504', elo: 1350, wins: 28, losses: 4, draws: 2 },
          { rank: 2, id: 1002, firstName: 'Rustam Qosimov', username: 'rustam_gm', elo: 1290, wins: 21, losses: 5, draws: 3 },
          { rank: 3, id: 1003, firstName: 'Javohir Sindarov', username: 'sindarov_uz', elo: 1275, wins: 19, losses: 6, draws: 1 },
          { rank: 4, id: 1004, firstName: 'Nodirbek Abdusattorov', username: 'nodirbek', elo: 1260, wins: 17, losses: 4, draws: 2 },
          { rank: 5, id: user.id, firstName: user.firstName, username: user.username, elo: 1200, wins: 12, losses: 4, draws: 1 }
        ]
      };
    }

    if (endpoint === 'matchmaking') {
      if (action === 'join') {
        const gameId = `local_mm_${Date.now()}`;
        const game = this.createLocalGame(gameId, payload.gameType || 'chess', payload.timeControl || '3+2', user.id, 999);
        return {
          success: true,
          status: 'matched',
          gameId: game.id,
          assignedColor: 'white',
          game
        };
      }
      if (action === 'accept_challenge') {
        const gameId = `local_accept_${Date.now()}`;
        const game = this.createLocalGame(gameId, payload.gameType || 'chess', payload.timeControl || '3+2', payload.hostUserId || 1002, user.id);
        return {
          success: true,
          status: 'matched',
          gameId: game.id,
          assignedColor: 'black',
          game
        };
      }
      return { success: true, status: 'waiting' };
    }

    if (endpoint === 'game') {
      const localGames = this.getLocalGames();

      if (action === 'chat_send') {
        const localChatKey = `wellchess_chat_${payload.gameId}`;
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem(localChatKey) || '[]'); } catch {}
        const newMsg = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: user.id,
          senderName: user.firstName,
          text: payload.text,
          timestamp: Date.now()
        };
        existing.push(newMsg);
        try { localStorage.setItem(localChatKey, JSON.stringify(existing)); } catch {}
        return { success: true, message: newMsg, chat: existing };
      }

      if (action === 'chat_get') {
        const localChatKey = `wellchess_chat_${payload.gameId}`;
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem(localChatKey) || '[]'); } catch {}
        return { success: true, chat: existing };
      }

      if (action === 'pending_challenges') {
        return { success: true, challenges: [] };
      }

      if (action === 'decline_invite') {
        return { success: true };
      }

      if (action === 'live_games') {
        return {
          success: true,
          games: [
            {
              id: 'demo_live_1',
              gameType: 'checkers8',
              timeControl: '5+0',
              currentTurn: 'white',
              moveCount: 8,
              whitePlayer: { id: 6472114736, firstName: 'Asliddin Norqobilov', elo: 1350 },
              blackPlayer: { id: 1002, firstName: 'Rustam Qosimov', elo: 1290 }
            },
            {
              id: 'demo_live_2',
              gameType: 'chess',
              timeControl: '3+2',
              currentTurn: 'black',
              moveCount: 14,
              whitePlayer: { id: 1003, firstName: 'Javohir Sindarov', elo: 1275 },
              blackPlayer: { id: 1004, firstName: 'Nodirbek Abdusattorov', elo: 1260 }
            }
          ]
        };
      }

      if (action === 'online_players') {
        return {
          success: true,
          players: [
            { id: 6472114736, firstName: 'Asliddin Norqobilov', username: 'asliddincoder0504', chessElo: 1350, checkers8Elo: 1320, checkersElo: 1300, isPlaying: false },
            { id: 8455692606, firstName: 'Hamkor O‘yinchi', username: 'chess_friend', chessElo: 1280, checkers8Elo: 1250, checkersElo: 1240, isPlaying: false },
            { id: 1002, firstName: 'Rustam Qosimov', username: 'rustam_gm', chessElo: 1290, checkers8Elo: 1240, checkersElo: 1210, isPlaying: false },
            { id: 1003, firstName: 'Javohir Sindarov', username: 'sindarov_uz', chessElo: 1275, checkers8Elo: 1200, checkersElo: 1200, isPlaying: true },
            { id: 1004, firstName: 'Nodirbek Abdusattorov', username: 'nodirbek', chessElo: 1260, checkers8Elo: 1250, checkersElo: 1230, isPlaying: false }
          ]
        };
      }

      if (action === 'create_invite') {
        const gameId = `local_invite_${Date.now()}`;
        const game = this.createLocalGame(gameId, payload.gameType || 'chess', payload.timeControl || '5+0', user.id, null, 'waiting');
        return { success: true, gameId: game.id, game };
      }

      if (action === 'accept_invite') {
        const gameId = payload.gameId;
        let game = localGames[gameId];
        const secondPlayerId = Number(user.id) === 6472114736 ? 8455692606 : 6472114736;
        if (!game) {
          game = this.createLocalGame(gameId, 'checkers8', '5+0', user.id, secondPlayerId, 'active');
        } else {
          game.status = 'active';
          game.blackId = Number(user.id) === Number(game.whiteId) ? secondPlayerId : Number(user.id);
          localGames[gameId] = game;
          this.saveLocalGames(localGames);
        }
        return { success: true, message: 'Taklif qabul qilindi, o‘yin boshlandi!', game };
      }

      const gameId = payload.gameId;
      let game = localGames[gameId];

      if (action === 'get' || action === 'state' || !action) {
        if (!game) {
          // If the game does not exist in local storage, do not forge an active game against oneself!
          // Only create if demo_live or offline demo
          if (gameId && (gameId.startsWith('demo_live') || gameId.startsWith('offline_'))) {
            const is8x8 = gameId.includes('8') || gameId.includes('checkers8');
            const isCheckers = gameId.includes('checker');
            const gType = is8x8 ? 'checkers8' : (isCheckers ? 'checkers' : 'chess');
            game = this.createLocalGame(gameId, gType, '5+0', user.id, user.id);
          } else {
            return { success: false, error: 'O‘yin topilmadi' };
          }
        }
        const now = Date.now();
        const elapsed = Math.max(0, now - (game.lastMoveTimestamp || now));
        let wTime = game.whiteTimeMs;
        let bTime = game.blackTimeMs;
        if (game.status === 'active') {
          if (game.currentTurn === 'white') wTime = Math.max(0, wTime - elapsed);
          else bTime = Math.max(0, bTime - elapsed);
        }
        return {
          success: true,
          game: {
            ...game,
            whiteTimeMs: wTime,
            blackTimeMs: bTime
          }
        };
      }

      if (action === 'move') {
        if (!game) game = this.createLocalGame(gameId, 'chess', '5+0', user.id, user.id);
        const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
        game.version = (game.version || 1) + 1;
        game.currentTurn = nextTurn;
        game.moveCount = (game.moveCount || 0) + 1;
        game.lastMoveTimestamp = Date.now();
        if (payload.move?.newBoardState) {
          game.boardState = payload.move.newBoardState;
        }
        try {
          const parsedHist = JSON.parse(game.history || '[]');
          parsedHist.push({
            player: game.currentTurn,
            move: payload.move?.notation || 'move',
            boardState: game.boardState,
            timestamp: Date.now()
          });
          game.history = JSON.stringify(parsedHist);
        } catch {}
        localGames[gameId] = game;
        this.saveLocalGames(localGames);
        return { success: true, game };
      }

      if (action === 'resign') {
        if (game) {
          game.status = 'completed';
          game.winner = game.currentTurn === 'white' ? 'black' : 'white';
          game.winReason = 'resignation';
          localGames[gameId] = game;
          this.saveLocalGames(localGames);
        }
        return { success: true, game };
      }

      if (action === 'draw') {
        if (game) {
          const drawAct = payload.drawAction || 'offer';
          if (drawAct === 'offer') {
            game.drawOfferedBy = game.currentTurn;
            game.version = (game.version || 1) + 1;
          } else if (drawAct === 'accept') {
            game.status = 'completed';
            game.winner = 'draw';
            game.winReason = 'draw_agreement';
            game.drawOfferedBy = null;
            game.version = (game.version || 1) + 1;
          } else if (drawAct === 'decline') {
            game.drawOfferedBy = null;
            game.version = (game.version || 1) + 1;
          }
          localGames[gameId] = game;
          this.saveLocalGames(localGames);
        }
        return { success: true, game };
      }

      if (action === 'rematch') {
        const newId = `local_rematch_${Date.now()}`;
        const newGame = this.createLocalGame(newId, game?.gameType || 'chess', game?.timeControl || '5+0', user.id, user.id);
        return { success: true, newGameId: newGame.id, game: newGame };
      }
    }

    return { success: true };
  }

  createLocalGame(gameId, gameType = 'chess', timeControl = '5+0', whiteId = 1001, blackId = 1001, status = 'active') {
    let boardState = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    if (gameType === 'checkers8') {
      boardState = 'bbbbbbbbbbbb........wwwwwwwwwwww';
    } else if (gameType === 'checkers') {
      boardState = 'bbbbbbbbbbbbbbbbbbbb..........wwwwwwwwwwwwwwwwwwww';
    }

    const timeMap = { '1+0': 60000, '2+1': 120000, '3+0': 180000, '3+2': 180000, '5+0': 300000, '10+0': 600000, '15+10': 900000 };
    const initialTime = timeMap[timeControl] || 300000;

    const game = {
      id: gameId,
      gameType,
      timeControl,
      boardState,
      currentTurn: 'white',
      status,
      version: 1,
      whiteId: Number(whiteId),
      blackId: blackId ? Number(blackId) : null,
      whiteTimeMs: initialTime,
      blackTimeMs: initialTime,
      lastMoveTimestamp: Date.now(),
      moveCount: 0,
      createdAt: Math.floor(Date.now() / 1000),
      whitePlayer: { id: whiteId, firstName: 'Siz (Oqlar)', elo: 1200 },
      blackPlayer: { id: blackId || 999, firstName: blackId === whiteId ? 'Siz (Qoralar)' : (blackId === 999 ? 'Kompyuter (Bot)' : 'Raqib'), elo: 1200 }
    };

    const localGames = this.getLocalGames();
    localGames[gameId] = game;
    this.saveLocalGames(localGames);
    return game;
  }

  // Profile API
  async getProfile() {
    return this.call('profile', { action: 'profile' });
  }

  async inspectUser(targetUserId) {
    return this.call('profile', { action: 'inspect', targetUserId });
  }

  async getProfileStats() {
    return this.call('profile', { action: 'stats' });
  }

  async getProfileHistory(limit = 50) {
    return this.call('profile', { action: 'history', limit });
  }

  // Ratings & Leaderboard API
  async getRatings(gameType = 'chess') {
    return this.call('profile', { action: 'ratings', gameType });
  }

  async getLeaderboard(gameType = 'chess') {
    return this.call('leaderboard', { gameType });
  }

  // Matchmaking API
  async joinMatchmaking(gameType, timeControl) {
    return this.call('matchmaking', { action: 'join', gameType, timeControl });
  }

  async cancelMatchmaking() {
    return this.call('matchmaking', { action: 'cancel' });
  }

  async getMatchmakingStatus() {
    return this.call('matchmaking', { action: 'status' });
  }

  // Game API
  async getGame(gameId) {
    return this.call('game', { action: 'get', gameId });
  }

  async makeMove(gameId, move, version) {
    return this.call('game', { action: 'move', gameId, move, version });
  }

  async resignGame(gameId) {
    return this.call('game', { action: 'resign', gameId });
  }

  async sendDrawAction(gameId, drawAction) {
    return this.call('game', { action: 'draw', gameId, drawAction });
  }

  async sendRematchAction(gameId, rematchAction) {
    return this.call('game', { action: 'rematch', gameId, rematchAction });
  }

  async createInvite(gameType, timeControl, targetUserId = null) {
    return this.call('game', { action: 'create_invite', gameType, timeControl, targetUserId });
  }

  async acceptInvite(gameId) {
    return this.call('game', { action: 'accept_invite', gameId });
  }

  async declineInvite(gameId) {
    return this.call('game', { action: 'decline_invite', gameId });
  }

  async getPendingChallenges() {
    return this.call('game', { action: 'pending_challenges' });
  }

  async acceptMatchChallenge(hostUserId, gameType = 'chess', timeControl = '3+2') {
    return this.call('matchmaking', { action: 'accept_challenge', hostUserId, gameType, timeControl });
  }

  async getLiveGames() {
    return this.call('game', { action: 'live_games' });
  }

  async getOnlinePlayers() {
    return this.call('game', { action: 'online_players' });
  }

  // Real-Time In-Game Chat API
  async sendGameChat(gameId, text) {
    return this.call('game', { action: 'chat_send', gameId, text });
  }

  async getGameChat(gameId) {
    return this.call('game', { action: 'chat_get', gameId });
  }

  // Admin API
  async getAdminStats() {
    return this.call('admin', { action: 'stats' });
  }

  async getAdminUsers(query = '') {
    return this.call('admin', { action: 'users', query });
  }

  async getAdminActiveGames() {
    return this.call('admin', { action: 'active_games' });
  }

  async abortAdminGame(gameId) {
    return this.call('admin', { action: 'abort_game', gameId });
  }

  async resetAdminRating(targetUserId, newRating = 1200) {
    return this.call('admin', { action: 'reset_rating', targetUserId, newRating });
  }

  async setAdminUserBan(targetUserId, isBanned) {
    return this.call('admin', { action: 'ban', targetUserId, isBanned });
  }

  async getAdminMessages(limit = 50) {
    return this.call('admin', { action: 'messages', limit });
  }

  async adminReplyMessage(messageId, replyText) {
    return this.call('admin', { action: 'reply_message', messageId, replyText });
  }

  // User Support Chat API
  async getSupportMessages() {
    return this.call('contact_admin', { action: 'get_messages' });
  }

  async sendSupportMessage(message, topic = 'Umumiy') {
    return this.call('contact_admin', { action: 'send', message, topic });
  }

  // Contact Admin
  async contactAdmin(message, topic = 'Umumiy') {
    return this.call('contact_admin', { message, topic, user: this.tg?.initDataUnsafe?.user });
  }
}

export const api = new ApiClient();
export default api;
