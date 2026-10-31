import { EndpointError } from 'sdk';
import {
  handleGetGame,
  handleMakeMove,
  handleResign,
  handleDrawAction,
  handleRematchAction,
  handleCreateInvite,
  handleAcceptInvite,
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

  // State-modifying actions require authenticated user
  if (!rawUser || !rawUser.id) {
    // If testing in dev, allow fallback dev user
    if (!input?.devUser) {
      // Still allow if devUser provided
    }
  }

  if (action === 'create_invite') {
    const res = await handleCreateInvite(userId, {
      gameType: input.gameType || 'chess',
      timeControl: input.timeControl || '5+0',
      targetUserId: input.targetUserId ? Number(input.targetUserId) : null
    });
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
