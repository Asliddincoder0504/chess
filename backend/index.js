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
import { handleGetProfile, handleGetProfileStats, handleGetProfileHistory, handleInspectUser } from './api/profile.js';
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
  handleRematchAction,
  handleCreateInvite,
  handleAcceptInvite,
  handleGetLiveGames,
  handleGetOnlinePlayers
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

  // UNIVERSAL /api/profile endpoint (POST or GET)
  if (pathname === '/api/profile') {
    const act = body.action || query.action || 'profile';
    if (act === 'stats') return await handleGetProfileStats(user.id);
    if (act === 'history') return await handleGetProfileHistory(user.id, parseInt(body.limit || query.limit, 10) || 50);
    if (act === 'ratings') return await handleGetRatings(user.id, body.gameType || 'chess');
    if (act === 'inspect') return await handleInspectUser(body.targetUserId || query.targetUserId);
    return await handleGetProfile(user);
  }

  // UNIVERSAL /api/leaderboard endpoint (POST or GET)
  if (pathname === '/api/leaderboard' || pathname.startsWith('/api/leaderboard/')) {
    const type = body.gameType || query.gameType || (pathname.split('/')[3]) || 'chess';
    return await handleGetLeaderboard(type, parseInt(body.limit || query.limit, 10) || 100);
  }

  // UNIVERSAL /api/matchmaking endpoint (POST or GET)
  if (pathname === '/api/matchmaking') {
    const act = body.action || query.action || 'status';
    if (act === 'join') {
      return await handleJoinMatchmaking(user.id, { gameType: body.gameType, timeControl: body.timeControl });
    }
    if (act === 'cancel') {
      return await handleCancelMatchmaking(user.id);
    }
    if (act === 'status') {
      return await handleGetMatchmakingStatus(user.id);
    }
    if (act === 'stats') {
      return await handleGetQueueStats();
    }
  }

  // UNIVERSAL /api/game endpoint (POST or GET)
  if (pathname === '/api/game') {
    const { action, gameId } = body;
    if (action === 'create_invite') {
      const targetId = body.targetUserId ? Number(body.targetUserId) : null;
      const res = await handleCreateInvite(user.id, {
        gameType: body.gameType,
        timeControl: body.timeControl,
        targetUserId: targetId
      });
      if (targetId && res.success && res.gameId) {
        try {
          const { sendTelegramMessage } = await import('./bot/notifications.js');
          const challengerName = user.firstName || 'Do‘stingiz';
          let gName = 'Shaxmat (8x8 FIDE)';
          if (body.gameType === 'checkers8') gName = 'Klassik shashka (8x8, 12 tosh)';
          else if (body.gameType === 'checkers') gName = 'Xalqaro shashka (10x10, 20 tosh)';
          const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          const safeName = escapeHtml(challengerName);
          const safeGame = escapeHtml(gName);
          const safeTime = escapeHtml(body.timeControl || '5+0');
          const MINI_APP_URL = process.env.MINI_APP_URL || 'https://app9223102562.tgcloud.ai/';
          await sendTelegramMessage(
            targetId,
            `⚔️ <b>${safeName} sizni o‘yinga taklif qildi!</b>\n\n🎮 O‘yin turi: <b>${safeGame}</b>\n⏱ Vaqt: <b>${safeTime}</b>\n\nPastdagi tugmani bosing va o‘yinga qo‘shiling:`,
            {
              inline_keyboard: [
                [{ text: '⚔️ Qabul qilish va o‘yinga kirish', web_app: { url: `${MINI_APP_URL}?gameId=${res.gameId}` } }]
              ]
            }
          );
        } catch (e) {
          console.warn('[Direct Challenge Telegram Notification]:', e.message);
        }
      }
      return res;
    }
    if (action === 'accept_invite') {
      return await handleAcceptInvite(gameId, user.id);
    }
    if (action === 'live_games') {
      return await handleGetLiveGames();
    }
    if (action === 'online_players') {
      return await handleGetOnlinePlayers(user.id);
    }
    if (action === 'move') {
      return await handleMakeMove(gameId, user.id, { move: body.move, clientVersion: body.version });
    }
    if (action === 'resign') {
      return await handleResign(gameId, user.id);
    }
    if (action === 'draw') {
      return await handleDrawAction(gameId, user.id, { action: body.drawAction || body.action });
    }
    if (action === 'rematch') {
      return await handleRematchAction(gameId, user.id, { action: body.rematchAction || body.action });
    }
    if (action === 'chat_send') {
      const { handleSendChatMessage } = await import('./api/games.js');
      return await handleSendChatMessage(gameId, user.id, {
        text: body.text || body.message,
        senderName: user.firstName || 'O‘yinchi'
      });
    }
    if (action === 'chat_get') {
      const { getGameChat } = await import('./storage/games.js');
      return { success: true, chat: getGameChat(gameId) };
    }
    if (action === 'get' || action === 'state' || !action) {
      return await handleGetGame(gameId, user.id);
    }
  }

  // UNIVERSAL /api/admin endpoint (POST or GET)
  if (pathname === '/api/admin') {
    const act = body.action || query.action || 'stats';
    if (act === 'stats') return await handleGetAdminStats(user.id);
    if (act === 'users') return await handleGetAdminUsers(user.id, parseInt(body.limit || query.limit, 10) || 100);
    if (act === 'active_games') return await handleGetAdminActiveGames(user.id);
    if (act === 'ban') return await handleAdminBanUser(user.id, body.targetUserId, body.isBanned);
    if (act === 'abort_game') {
      const { abortGame } = await import('./storage/games.js');
      await abortGame(body.gameId);
      return { success: true };
    }
    if (act === 'reset_rating') {
      const { resetUserElo } = await import('./storage/users.js');
      await resetUserElo(body.targetUserId, body.newRating || 1200);
      return { success: true };
    }
    if (act === 'messages') {
      const { handleGetAdminMessages } = await import('./api/admin.js');
      return await handleGetAdminMessages(user.id, parseInt(body.limit || query.limit, 10) || 50);
    }
    if (act === 'reply_message') {
      const { replyToAdminMessage } = await import('./storage/messages.js');
      const replied = await replyToAdminMessage(body.messageId, body.replyText, user.firstName || 'Admin');
      return { success: true, message: replied };
    }
  }

  // CONTACT ADMIN endpoint
  if (pathname === '/api/contact_admin' || (pathname === '/api/admin' && body.action === 'contact')) {
    if (body.action === 'get_messages' || query.action === 'get_messages') {
      const { getUserAdminMessages } = await import('./storage/messages.js');
      const messages = await getUserAdminMessages(user.id);
      return { success: true, messages };
    }
    const message = (body.message || body.text || '').trim();
    const topic = body.topic || 'Umumiy';
    if (!message) {
      return { status: 400, error: 'Xabar matni bo‘sh bo‘lishi mumkin emas' };
    }

    const senderName = `${user.firstName || 'O‘yinchi'} ${user.lastName || ''}`.trim();
    const username = user.username ? `@${user.username}` : 'Yo‘q';

    // Persist message to database
    try {
      const { saveAdminMessage } = await import('./storage/messages.js');
      await saveAdminMessage({
        senderId: user.id,
        senderName,
        username: user.username || '',
        topic,
        message
      });
    } catch (saveErr) {
      console.error('[contact_admin save error]:', saveErr.message);
    }

    const { sendTelegramMessage } = await import('./bot/notifications.js');
    const text = [
      `📩 *Yangi murojaat (WellChess)*\n`,
      `📌 *Mavzu:* ${topic}`,
      `👤 *Yuboruvchi:* ${senderName}`,
      `🆔 *Telegram ID:* \`${user.id}\``,
      `🔗 *Username:* ${username}\n`,
      `💬 *Murojaat:*`,
      message
    ].join('\n');

    const ADMIN_IDS = ['6472114736', '8455692606'];
    for (const adminId of ADMIN_IDS) {
      try {
        await sendTelegramMessage(adminId, text);
      } catch (err) {
        console.error(`Local contact_admin send error:`, err.message);
      }
    }
    return { success: true, message: 'Murojaatingiz adminlarga muvaffaqiyatli yetkazildi!' };
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
