import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env configuration natively
try {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch {}

import { validateTelegramInitData } from './core/validation.js';
import { handleGetProfile, handleGetProfileStats, handleGetProfileHistory } from './api/profile.js';
import { handleGetRatings } from './api/ratings.js';
import { handleGetLeaderboard } from './api/leaderboard.js';
import {
  handleJoinMatchmaking,
  handleCancelMatchmaking,
  handleGetMatchmakingStatus,
  handleGetQueueStats
} from './api/matchmaking.js';
import {
  handleGetGame,
  handleMakeMove,
  handleResign,
  handleDrawAction,
  handleRematchAction
} from './api/games.js';
import {
  handleGetAdminStats,
  handleGetAdminUsers,
  handleAdminBanUser,
  handleGetAdminActiveGames
} from './api/admin.js';
import { handleTelegramUpdate } from './bot/handlers.js';

export const BOT_TOKEN = process.env.BOT_TOKEN || 'test_bot_token';

/**
 * Authorize and authenticate incoming request using Telegram initData
 */
export function authenticateRequest(headers = {}, body = {}) {
  // Allow test / dev mock bypass in development or test environments
  if (process.env.NODE_ENV !== 'production' && (headers['x-test-user-id'] || body?._testUser)) {
    const userId = Number(headers['x-test-user-id']) || 1001;
    const testUser = body?._testUser || { id: userId, username: `user_${userId}`, firstName: `Player ${userId}` };
    return { authenticated: true, user: testUser };
  }

  const authHeader = headers['authorization'] || headers['Authorization'] || '';
  const initDataHeader = headers['x-telegram-init-data'] || headers['X-Telegram-Init-Data'] || '';
  let rawInitData = initDataHeader;

  if (!rawInitData && authHeader.startsWith('tma ')) {
    rawInitData = authHeader.slice(4).trim();
  }

  if (!rawInitData && body && body._initData) {
    rawInitData = body._initData;
  }

  if (!rawInitData) {
    return { authenticated: false, error: 'Missing Telegram authentication credentials', status: 401 };
  }

  const result = validateTelegramInitData(rawInitData, BOT_TOKEN);
  if (!result.valid) {
    return { authenticated: false, error: result.error, status: 401 };
  }

  return { authenticated: true, user: result.user };
}

/**
 * Universal API Dispatcher for REST endpoints and serverless calls
 */
export async function dispatchApiRequest({ method, pathname, query = {}, body = {}, headers = {}, preVerifiedUser = null }) {
  const normMethod = method.toUpperCase();

  // Public endpoints (no authentication required)
  if (pathname === '/api/leaderboard/chess' && normMethod === 'GET') {
    return await handleGetLeaderboard('chess', parseInt(query.limit, 10) || 100);
  }
  if (pathname === '/api/leaderboard/checkers' && normMethod === 'GET') {
    return await handleGetLeaderboard('checkers', parseInt(query.limit, 10) || 100);
  }
  if (pathname === '/api/matchmaking/stats' && normMethod === 'GET') {
    return await handleGetQueueStats();
  }

  // Webhook for Telegram Bot API updates
  if (pathname === '/webhook' && normMethod === 'POST') {
    await handleTelegramUpdate(body);
    return { ok: true };
  }

  // Protected endpoints: Authenticate user
  let user = preVerifiedUser;
  if (!user) {
    const auth = authenticateRequest(headers, body);
    if (!auth.authenticated) {
      return { error: auth.error, status: auth.status || 401 };
    }
    user = auth.user;
  }

  // USER endpoints
  if (pathname === '/api/profile' && normMethod === 'GET') {
    return await handleGetProfile(user);
  }
  if (pathname === '/api/profile/stats' && normMethod === 'GET') {
    return await handleGetProfileStats(user.id);
  }
  if (pathname === '/api/profile/history' && normMethod === 'GET') {
    return await handleGetProfileHistory(user.id, parseInt(query.limit, 10) || 50);
  }

  // RATINGS endpoints
  if (pathname === '/api/ratings/chess' && normMethod === 'GET') {
    return await handleGetRatings(user.id, 'chess');
  }
  if (pathname === '/api/ratings/checkers' && normMethod === 'GET') {
    return await handleGetRatings(user.id, 'checkers');
  }

  // MATCHMAKING endpoints
  if (pathname === '/api/matchmaking/join' && normMethod === 'POST') {
    return await handleJoinMatchmaking(user.id, {
      gameType: body.gameType,
      timeControl: body.timeControl
    });
  }
  if (pathname === '/api/matchmaking/cancel' && normMethod === 'POST') {
    return await handleCancelMatchmaking(user.id);
  }
  if (pathname === '/api/matchmaking/status' && normMethod === 'GET') {
    return await handleGetMatchmakingStatus(user.id);
  }

  // GAME endpoints
  // Match /api/game/:id/:action or /api/game/:id
  const gameMatch = pathname.match(/^\/api\/game\/([^/]+)(?:\/(move|resign|draw|rematch))?$/);
  if (gameMatch) {
    const gameId = gameMatch[1];
    const action = gameMatch[2];

    if (!action && normMethod === 'GET') {
      return await handleGetGame(gameId, user.id);
    }
    if (action === 'move' && normMethod === 'POST') {
      return await handleMakeMove(gameId, user.id, {
        move: body.move,
        clientVersion: body.version
      });
    }
    if (action === 'resign' && normMethod === 'POST') {
      return await handleResign(gameId, user.id);
    }
    if (action === 'draw' && normMethod === 'POST') {
      return await handleDrawAction(gameId, user.id, { action: body.action });
    }
    if (action === 'rematch' && normMethod === 'POST') {
      return await handleRematchAction(gameId, user.id, { action: body.action });
    }
  }

  // ADMIN endpoints
  if (pathname === '/api/admin/stats' && normMethod === 'GET') {
    return await handleGetAdminStats(user.id);
  }
  if (pathname === '/api/admin/users' && normMethod === 'GET') {
    return await handleGetAdminUsers(user.id, parseInt(query.limit, 10) || 100);
  }
  if (pathname === '/api/admin/ban' && normMethod === 'POST') {
    return await handleAdminBanUser(user.id, body.targetUserId, body.isBanned);
  }
  if (pathname === '/api/admin/games' && normMethod === 'GET') {
    return await handleGetAdminActiveGames(user.id);
  }

  return { error: `Not found: ${normMethod} ${pathname}`, status: 404 };
}
