import { EndpointError } from 'sdk';
import { getLeaderboard } from '../lib/storage/users.js';

export default async function (input, ctx) {
  const gameType = input.gameType || 'chess';
  const limit = Math.min(input.limit || 50, 100);

  if (gameType !== 'chess' && gameType !== 'checkers' && gameType !== 'checkers8') {
    throw new EndpointError('Invalid game type. Must be "chess", "checkers", or "checkers8"', { code: 'INVALID_GAME_TYPE' });
  }

  const leaderboard = await getLeaderboard(gameType, limit);

  return {
    success: true,
    gameType,
    leaderboard
  };
}
