import { getLeaderboard } from '../storage/users.js';

export async function handleGetLeaderboard(gameType = 'chess', limit = 100) {
  const players = await getLeaderboard(gameType, limit);
  return {
    success: true,
    gameType,
    leaderboard: players
  };
}
