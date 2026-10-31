import { EndpointError } from 'sdk';
import { getLeaderboard } from '../lib/storage/users.js';

export default async function (input, ctx) {
  const gameType = input.gameType || 'chess';
  const limit = Math.min(input.limit || 50, 100);

  if (gameType !== 'chess' && gameType !== 'checkers') {
    throw new EndpointError('Invalid game type. Must be "chess" or "checkers"', { code: 'INVALID_GAME_TYPE' });
  }

  const leaderboard = await getLeaderboard(gameType, limit);

  return {
    success: true,
    gameType,
    leaderboard
  };
}
