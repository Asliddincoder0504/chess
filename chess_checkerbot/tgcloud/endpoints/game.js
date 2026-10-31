import { EndpointError, api } from 'sdk';
import {
  handleGetGame,
  handleMakeMove,
  handleResign,
  handleDrawAction,
  handleRematchAction,
  handleCreateInvite,
  handleAcceptInvite,
  handleGetPendingChallenges,
  handleDeclineInvite,
  handleGetLiveGames,
  handleGetOnlinePlayers,
  syncGameClocks
} from '../lib/game_service.js';
import { getGameById } from '../lib/storage/games.js';

export default async function (input, ctx) {
  // Allow read-only actions (live games, online players, spectating) for guests/visitors
  const rawUser = ctx.initData?.user || input?.devUser;
  const user = rawUser || { id: 999999, firstName: 'Mehmon' };
  const userId = Number(user.id);
  const { action, gameId } = input;

  // 1. Read-only live games and online players
  if (action === 'live_games') {
    return await handleGetLiveGames();
  }

  if (action === 'online_players') {
    return await handleGetOnlinePlayers(userId);
  }

  // 2. Game state retrieval (spectator or participant)
  if (action === 'state' || action === 'get' || !action) {
    if (!gameId) throw new EndpointError('Missing gameId', { code: 'MISSING_GAME_ID' });
    const res = await handleGetGame(gameId);
    if (res.error) {
      throw new EndpointError(res.error, { code: res.status === 404 ? 'NOT_FOUND' : 'ERROR' });
    }
    return res;
  }

  if (action === 'create_invite') {
    const targetId = input.targetUserId ? Number(input.targetUserId) : null;
    const res = await handleCreateInvite(userId, {
      gameType: input.gameType || 'chess',
      timeControl: input.timeControl || '5+0',
      targetUserId: targetId
    });

    if (targetId && res.success && res.gameId) {
      try {
        const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';
        const challengerName = user.first_name || user.firstName || 'Do‘stingiz';
        let gName = 'Shaxmat (8x8 FIDE)';
        if (input.gameType === 'checkers8') gName = 'Klassik shashka (8x8, 12 tosh)';
        else if (input.gameType === 'checkers') gName = 'Xalqaro shashka (10x10, 20 tosh)';

        await api.sendMessage({
          chat_id: targetId,
          text: `⚔️ *${challengerName} sizni o‘yinga taklif qildi!*\n\n🎮 O‘yin turi: *${gName}*\n⏱ Vaqt: *${input.timeControl || '5+0'}*\n\nPastdagi tugmani bosing va o‘yinga qo‘shiling:`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚔️ Qabul qilish va o‘yinga kirish', web_app: { url: `${MINI_APP_URL}?gameId=${res.gameId}` } }]
            ]
          }
        });
      } catch (err) {
        console.warn('[Direct Challenge Telegram Notification]:', err.message);
      }
    }

    return res;
  }

  if (action === 'pending_challenges') {
    return await handleGetPendingChallenges(userId);
  }

  if (action === 'decline_invite') {
    if (!gameId) throw new EndpointError('Missing gameId', { code: 'MISSING_GAME_ID' });
    const res = await handleDeclineInvite(gameId, userId);
    if (res.error) throw new EndpointError(res.error, { code: 'DECLINE_ERROR' });
    return res;
  }

  if (action === 'accept_invite') {
    if (!gameId) throw new EndpointError('Missing gameId', { code: 'MISSING_GAME_ID' });
    const res = await handleAcceptInvite(gameId, userId);
    if (res.error) throw new EndpointError(res.error, { code: 'INVITE_ERROR' });
    return res;
  }

  if (!gameId) {
    throw new EndpointError('Missing gameId', { code: 'MISSING_GAME_ID' });
  }

  if (action === 'move') {
    const { move, version, clientVersion } = input;
    const v = clientVersion !== undefined ? clientVersion : version;
    if (!move) {
      throw new EndpointError('Missing move data', { code: 'MISSING_MOVE' });
    }

    const res = await handleMakeMove(gameId, userId, { move, clientVersion: v });
    if (res.error) {
      throw new EndpointError(res.error, { code: res.status === 409 ? 'VERSION_MISMATCH' : 'ILLEGAL_MOVE' });
    }
    return res;
  }

  if (action === 'resign') {
    const res = await handleResign(gameId, userId);
    if (res.error) {
      throw new EndpointError(res.error, { code: 'RESIGN_ERROR' });
    }
    return res;
  }

  if (action === 'draw' || action === 'draw_offer' || action === 'draw_respond') {
    const drawAct = input.drawAction || (action === 'draw_offer' ? 'offer' : (input.accept ? 'accept' : 'decline'));
    const res = await handleDrawAction(gameId, userId, { action: drawAct });
    if (res.error) throw new EndpointError(res.error, { code: 'DRAW_ERROR' });
    return res;
  }

  if (action === 'timeout') {
    const game = await getGameById(gameId);
    if (!game) throw new EndpointError('Game not found', { code: 'NOT_FOUND' });
    const synced = await syncGameClocks(game);
    return { success: true, game: synced };
  }

  if (action === 'rematch') {
    const rematchAct = input.rematchAction || input.actionType || 'offer';
    const res = await handleRematchAction(gameId, userId, { action: rematchAct });
    if (res.error) throw new EndpointError(res.error, { code: 'REMATCH_ERROR' });
    return res;
  }

  throw new EndpointError(`Unknown action: ${action}`, { code: 'UNKNOWN_ACTION' });
}
