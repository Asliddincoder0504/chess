import {
  joinMatchmaking,
  cancelMatchmaking,
  getMatchmakingStatus,
  getQueueStats
} from '../core/matchmaking.js';
import { isValidGameType, isValidTimeControl } from '../core/validation.js';

export async function handleJoinMatchmaking(userId, { gameType, timeControl }) {
  if (!isValidGameType(gameType)) {
    return { error: `Invalid game type: ${gameType}. Must be 'chess' or 'checkers'`, status: 400 };
  }

  if (!isValidTimeControl(timeControl)) {
    return { error: `Invalid time control: ${timeControl}`, status: 400 };
  }

  try {
    const result = await joinMatchmaking({ userId, gameType, timeControl });
    return { success: true, ...result };
  } catch (err) {
    return { error: err.message, status: 500 };
  }
}

export async function handleCancelMatchmaking(userId) {
  const cancelled = await cancelMatchmaking(userId);
  return { success: true, cancelled };
}

export async function handleGetMatchmakingStatus(userId) {
  const status = await getMatchmakingStatus(userId);
  return { success: true, ...status };
}

export async function handleGetQueueStats() {
  const stats = await getQueueStats();
  return { success: true, stats };
}
