import { handleGetLeaderboard } from '../../backend/api/leaderboard.js';

export default async function (payload) {
  const gameType = payload.gameType || 'chess';
  const limit = payload.limit || 100;
  return await handleGetLeaderboard(gameType, limit);
}
