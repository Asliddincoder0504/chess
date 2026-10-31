/**
 * WellChess API Client
 * Seamlessly handles both Telegram Serverless native calls and REST fetch over HTTP
 */

class ApiClient {
  constructor() {
    this.baseUrl = window.WELLCHESS_API_URL || '';
    this.tg = window.Telegram?.WebApp;
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
      headers['Authorization'] = `tma ${initData}`;
      headers['x-telegram-init-data'] = initData;
    } else {
      // Local development test user bypass
      headers['x-test-user-id'] = localStorage.getItem('wellchess_dev_user_id') || '1001';
    }

    return headers;
  }

  /**
   * Universal API call dispatcher
   * @param {string} endpoint e.g. 'profile', 'matchmaking', 'game'
   * @param {Object} payload Arguments or request body
   * @param {string} [httpMethod='POST'] HTTP method for REST fallback
   * @param {string} [httpPath=null] REST pathname override
   */
  async call(endpoint, payload = {}, httpMethod = 'POST', httpPath = null) {
    // 1. If running natively inside Telegram Serverless runtime with Serverless.call
    if (this.tg?.Serverless?.call) {
      try {
        const res = await new Promise((resolve, reject) => {
          let resolved = false;
          try {
            const ret = this.tg.Serverless.call(endpoint, payload, (err, result) => {
              if (resolved) return;
              resolved = true;
              if (err) {
                reject(new Error(err.message || err.description || 'Serverless error'));
              } else {
                resolve(result);
              }
            });
            if (ret && typeof ret.then === 'function') {
              ret.then(r => { if (!resolved) { resolved = true; resolve(r); } })
                 .catch(e => { if (!resolved) { resolved = true; reject(e); } });
            }
          } catch (e) {
            reject(e);
          }
        });
        if (res !== undefined) return res;
      } catch (err) {
        console.warn(`[Serverless.call fallback on ${endpoint}]:`, err);
        // Fallback to fetch below
      }
    }

    // 2. Standard fetch request with Authorization header
    const path = httpPath || `/api/${endpoint}`;
    const url = `${this.baseUrl}${path}`;

    const options = {
      method: httpMethod,
      headers: this.getHeaders()
    };

    if (httpMethod !== 'GET' && httpMethod !== 'HEAD') {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: Request failed`);
    }

    return data;
  }

  // Profile API
  async getProfile() {
    return this.call('profile', { action: 'profile' }, 'GET', '/api/profile');
  }

  async getProfileStats() {
    return this.call('profile', { action: 'stats' }, 'GET', '/api/profile/stats');
  }

  async getProfileHistory(limit = 50) {
    return this.call('profile', { action: 'history', limit }, 'GET', `/api/profile/history?limit=${limit}`);
  }

  // Ratings & Leaderboard API
  async getRatings(gameType = 'chess') {
    return this.call('ratings', { gameType }, 'GET', `/api/ratings/${gameType}`);
  }

  async getLeaderboard(gameType = 'chess') {
    return this.call('leaderboard', { gameType }, 'GET', `/api/leaderboard/${gameType}`);
  }

  // Matchmaking API
  async joinMatchmaking(gameType, timeControl) {
    return this.call('matchmaking', { action: 'join', gameType, timeControl }, 'POST', '/api/matchmaking/join');
  }

  async cancelMatchmaking() {
    return this.call('matchmaking', { action: 'cancel' }, 'POST', '/api/matchmaking/cancel');
  }

  async getMatchmakingStatus() {
    return this.call('matchmaking', { action: 'status' }, 'GET', '/api/matchmaking/status');
  }

  // Game API
  async getGame(gameId) {
    return this.call('game', { gameId, action: 'get' }, 'GET', `/api/game/${gameId}`);
  }

  async makeMove(gameId, move, version) {
    return this.call('game', { gameId, action: 'move', move, version }, 'POST', `/api/game/${gameId}/move`);
  }

  async resignGame(gameId) {
    return this.call('game', { gameId, action: 'resign' }, 'POST', `/api/game/${gameId}/resign`);
  }

  async sendDrawAction(gameId, drawAction) {
    return this.call('game', { gameId, action: 'draw', drawAction }, 'POST', `/api/game/${gameId}/draw`);
  }

  async sendRematchAction(gameId, rematchAction) {
    return this.call('game', { gameId, action: 'rematch', rematchAction }, 'POST', `/api/game/${gameId}/rematch`);
  }

  // Admin API
  async getAdminStats() {
    return this.call('admin', { action: 'stats' }, 'GET', '/api/admin/stats');
  }

  async getAdminUsers() {
    return this.call('admin', { action: 'users' }, 'GET', '/api/admin/users');
  }

  async setAdminUserBan(targetUserId, isBanned) {
    return this.call('admin', { action: 'ban', targetUserId, isBanned }, 'POST', '/api/admin/ban');
  }
}

export const api = new ApiClient();
export default api;
