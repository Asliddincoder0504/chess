import { getUserById } from '../storage/users.js';
import { getUserRatingHistory } from '../storage/ratings.js';

export async function handleGetRatings(userId, gameType = 'chess') {
  const user = await getUserById(userId);
  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  const elo = gameType === 'checkers' ? user.checkersElo : user.chessElo;
  const history = await getUserRatingHistory(userId, gameType, 20);

  return {
    success: true,
    gameType,
    elo,
    history
  };
}
