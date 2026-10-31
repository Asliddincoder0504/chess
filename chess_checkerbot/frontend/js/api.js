/**
 * WellChess API Client
 * Seamlessly handles Telegram Serverless runtime POST calls and universal REST
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
   * Telegram Cloud serverless endpoints accept POST to /api/<endpoint>
   * @param {string} endpoint e.g. 'profile', 'matchmaking', 'game', 'admin', 'leaderboard'
   * @param {Object} payload Arguments or request body
   */
  async call(endpoint, payload = {}) {
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
      }
    }

    // 2. Standard fetch POST to /api/<endpoint>
    const url = `${this.baseUrl}/api/${endpoint}`;

    const options = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    };

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.description || `HTTP ${response.status}: Request failed`);
    }

    return data;
  }

  // Profile API
  async getProfile() {
    return this.call('profile', { action: 'profile' });
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

  async createInvite(gameType, timeControl) {
    return this.call('game', { action: 'create_invite', gameType, timeControl });
  }

  async acceptInvite(gameId) {
    return this.call('game', { action: 'accept_invite', gameId });
  }

  async getLiveGames() {
    return this.call('game', { action: 'live_games' });
  }

  async getOnlinePlayers() {
    return this.call('game', { action: 'online_players' });
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
}

export const api = new ApiClient();
export default api;
