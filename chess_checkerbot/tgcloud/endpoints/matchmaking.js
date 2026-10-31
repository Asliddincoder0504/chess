import { EndpointError } from 'sdk';
import {
  joinMatchmaking,
  pollMatchmakingStatus,
  cancelMatchmaking,
  getQueueStats,
  broadcastMatchmakingRequest,
  acceptMatchmakingChallenge
} from '../lib/core/matchmaking.js';
import { isValidGameType, isValidTimeControl } from '../lib/core/validation.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user || input?.devUser;
  if (!user || !user.id) {
    throw new EndpointError('Authentication required', { code: 'UNAUTHORIZED' });
  }

  const userId = Number(user.id);
  const action = input.action || 'poll';

  if (action === 'join') {
    const { gameType, timeControl } = input;
    if (!isValidGameType(gameType)) {
      throw new EndpointError(`Invalid game type: ${gameType}`, { code: 'INVALID_GAME_TYPE' });
    }
    if (!isValidTimeControl(timeControl)) {
      throw new EndpointError(`Invalid time control: ${timeControl}`, { code: 'INVALID_TIME_CONTROL' });
    }

    try {
      const result = await joinMatchmaking({ userId, gameType, timeControl });
      if (result.status === 'waiting') {
        // Asynchronously notify players with close ELO
        broadcastMatchmakingRequest({
          hostUser: user,
          gameType,
          timeControl,
          userElo: result.userElo
        }).catch(err => console.warn('[Broadcast matchmaking bg error]:', err.message));
      }
      return { success: true, ...result };
    } catch (err) {
      throw new EndpointError(err.message, { code: 'MATCHMAKING_ERROR' });
    }
  }

  if (action === 'accept_challenge') {
    const { hostUserId, gameType, timeControl } = input;
    if (!hostUserId) {
      throw new EndpointError('Missing hostUserId', { code: 'MISSING_HOST' });
    }
    try {
      const result = await acceptMatchmakingChallenge({
        hostUserId: Number(hostUserId),
        candidateUserId: userId,
        gameType,
        timeControl
      });
      return { success: true, ...result };
    } catch (err) {
      throw new EndpointError(err.message, { code: 'ACCEPT_CHALLENGE_ERROR' });
    }
  }

  if (action === 'poll' || action === 'status') {
    const result = await pollMatchmakingStatus(userId);
    return { success: true, ...result };
  }

  if (action === 'cancel') {
    const result = await cancelMatchmaking(userId);
    return { success: true, ...result };
  }

  if (action === 'stats') {
    const stats = await getQueueStats();
    return { success: true, stats };
  }

  return { error: 'Unknown action' };
}
