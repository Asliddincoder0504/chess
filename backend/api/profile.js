import { getUserById, getOrCreateUser } from '../storage/users.js';
import { getUserGameHistory } from '../storage/games.js';

export async function handleGetProfile(user) {
  const dbUser = await getOrCreateUser(user);
  return {
    success: true,
    user: dbUser
  };
}

export async function handleGetProfileStats(userId) {
  const user = await getUserById(userId);
  if (!user) {
    return { error: 'User not found', status: 404 };
  }

  const chessTotal = (user.chessWins || 0) + (user.chessLosses || 0) + (user.chessDraws || 0);
  const checkersTotal = (user.checkersWins || 0) + (user.checkersLosses || 0) + (user.checkersDraws || 0);

  const chessWinRate = chessTotal > 0 ? Math.round((user.chessWins / chessTotal) * 100) : 0;
  const checkersWinRate = checkersTotal > 0 ? Math.round((user.checkersWins / checkersTotal) * 100) : 0;

  return {
    success: true,
    stats: {
      chess: {
        elo: user.chessElo,
        wins: user.chessWins,
        losses: user.chessLosses,
        draws: user.chessDraws,
        total: chessTotal,
        winRate: chessWinRate
      },
      checkers: {
        elo: user.checkersElo,
        wins: user.checkersWins,
        losses: user.checkersLosses,
        draws: user.checkersDraws,
        total: checkersTotal,
        winRate: checkersWinRate
      }
    }
  };
}

export async function handleGetProfileHistory(userId, limit = 50) {
  const history = await getUserGameHistory(userId, limit);
  return {
    success: true,
    history
  };
}
