import { EndpointError, api } from 'sdk';
import { isAdminUser } from '../lib/core/admin.js';
import { getAllUsers, setUserBanStatus, getUserById } from '../lib/storage/users.js';
import { getAllActiveGames, getGameById, updateGame } from '../lib/storage/games.js';
import { getQueueStats } from '../lib/storage/matchmaking.js';
import { getAdminMessages, replyToAdminMessage } from '../lib/storage/messages.js';
import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { users } from '../schema.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user || input?.devUser;
  if (!user || !user.id) {
    throw new EndpointError('Authentication required', { code: 'UNAUTHORIZED' });
  }

  if (!isAdminUser(user.id)) {
    throw new EndpointError('Unauthorized: Admin access required', { code: 'FORBIDDEN' });
  }

  const action = input.action || 'stats';

  if (action === 'stats') {
    const allUsers = await getAllUsers(500);
    const activeGames = await getAllActiveGames();
    const queueStats = await getQueueStats();

    return {
      success: true,
      stats: {
        totalUsers: allUsers.length,
        bannedUsers: allUsers.filter(u => u.isBanned === 1).length,
        activeGamesCount: activeGames.length,
        matchmakingQueue: queueStats
      }
    };
  }

  if (action === 'users') {
    const limit = input.limit || 100;
    const all = await getAllUsers(limit);
    const q = (input.query || '').trim().toLowerCase();

    const filtered = q
      ? all.filter(u =>
          String(u.id).includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.firstName && u.firstName.toLowerCase().includes(q))
        )
      : all;

    return { success: true, users: filtered };
  }

  if (action === 'active_games') {
    const games = await getAllActiveGames();
    return { success: true, games };
  }

  if (action === 'ban') {
    const { targetUserId, isBanned } = input;
    if (!targetUserId) {
      throw new EndpointError('Missing targetUserId', { code: 'MISSING_TARGET_USER' });
    }
    const updatedUser = await setUserBanStatus(targetUserId, Boolean(isBanned));
    return { success: true, user: updatedUser };
  }

  if (action === 'reset_rating') {
    const { targetUserId, newRating = 1200 } = input;
    if (!targetUserId) {
      throw new EndpointError('Missing targetUserId', { code: 'MISSING_TARGET_USER' });
    }
    await db.update(users)
      .set({
        chessElo: Number(newRating),
        checkersElo: Number(newRating),
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(eq(users.id, Number(targetUserId)))
      .run();

    const updated = await getUserById(targetUserId);
    return { success: true, user: updated };
  }

  if (action === 'abort_game') {
    const { gameId } = input;
    if (!gameId) throw new EndpointError('Missing gameId', { code: 'MISSING_GAME_ID' });
    const game = await getGameById(gameId);
    if (!game) throw new EndpointError('Game not found', { code: 'NOT_FOUND' });

    const updated = await updateGame(gameId, {
      status: 'aborted',
      winReason: 'admin_intervention'
    });

    return { success: true, message: 'O‘yin admin tomonidan bekor qilindi', game: updated };
  }

  if (action === 'reply_message') {
    const { messageId, replyText } = input;
    if (!messageId || !replyText) {
      throw new EndpointError('Missing messageId or replyText', { code: 'MISSING_FIELDS' });
    }
    const adminName = user.first_name || 'Admin';
    const repliedMsg = await replyToAdminMessage(messageId, replyText, adminName);
    if (!repliedMsg) throw new EndpointError('Message not found or reply failed', { code: 'NOT_FOUND' });

    if (repliedMsg.senderId) {
      try {
        const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';
        const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        await api.sendMessage({
          chat_id: repliedMsg.senderId,
          text: `🛡️ <b>Admin sizning murojaatingizga javob berdi!</b>\n\n💬 <b>Javob:</b>\n${escapeHtml(replyText)}\n\n<i>Quyidagi tugma orqali Web Appda chatni ochishingiz va muloqotni davom ettirishingiz mumkin:</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Web Appda chatni ochish', web_app: { url: `${MINI_APP_URL}?contact_admin=1` } }]
            ]
          }
        });
      } catch (tgErr) {
        console.warn('[Admin reply telegram notify]:', tgErr.message);
      }
    }
    return { success: true, message: repliedMsg };
  }

  if (action === 'messages') {
    const limit = input.limit || 50;
    const messages = await getAdminMessages(limit);
    return { success: true, messages };
  }

  throw new EndpointError(`Unknown admin action: ${action}`, { code: 'UNKNOWN_ACTION' });
}
