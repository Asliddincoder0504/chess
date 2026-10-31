import {
  handleGetGame,
  handleMakeMove,
  handleResign,
  handleDrawAction,
  handleRematchAction
} from '../../backend/api/games.js';

export default async function (payload, ctx) {
  const user = ctx.initData?.user || ctx.user;
  if (!user || !user.id) {
    throw new Error('Unauthorized: Telegram user context missing');
  }

  const { gameId, action } = payload;
  if (!gameId) {
    throw new Error('Missing gameId parameter');
  }

  if (action === 'move') {
    return await handleMakeMove(gameId, user.id, {
      move: payload.move,
      clientVersion: payload.version
    });
  }

  if (action === 'resign') {
    return await handleResign(gameId, user.id);
  }

  if (action === 'draw') {
    return await handleDrawAction(gameId, user.id, { action: payload.drawAction });
  }

  if (action === 'rematch') {
    return await handleRematchAction(gameId, user.id, { action: payload.rematchAction });
  }

  // Default: get game state
  return await handleGetGame(gameId, user.id);
}
