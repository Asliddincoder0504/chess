import {
  handleJoinMatchmaking,
  handleCancelMatchmaking,
  handleGetMatchmakingStatus,
  handleGetQueueStats
} from '../../backend/api/matchmaking.js';

export default async function (payload, ctx) {
  const user = ctx.initData?.user || ctx.user;
  if (!user || !user.id) {
    throw new Error('Unauthorized: Telegram user context missing');
  }

  const action = payload.action || 'status';

  if (action === 'join') {
    return await handleJoinMatchmaking(user.id, {
      gameType: payload.gameType,
      timeControl: payload.timeControl
    });
  }

  if (action === 'cancel') {
    return await handleCancelMatchmaking(user.id);
  }

  if (action === 'stats') {
    return await handleGetQueueStats();
  }

  return await handleGetMatchmakingStatus(user.id);
}
