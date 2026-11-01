import { getUserById, getOrCreateUser } from '../storage/users.js';
import { getUserGameHistory } from '../storage/games.js';
import { isAdminUser } from './admin.js';

export async function handleGetProfile(user) {
  const dbUser = await getOrCreateUser(user);
  return {
    success: true,
    user: {
      ...dbUser,
      isAdmin: isAdminUser(dbUser.id)
    }
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

export async function handleInspectUser(targetUserId) {
  const targetId = Number(targetUserId);
  if (!targetId) return { error: 'Invalid targetUserId', status: 400 };

  const targetUser = await getUserById(targetId);
  if (!targetUser) return { error: 'User not found', status: 404 };

  const chessTotal = (targetUser.chessWins || 0) + (targetUser.chessLosses || 0) + (targetUser.chessDraws || 0);
  const checkersTotal = (targetUser.checkersWins || 0) + (targetUser.checkersLosses || 0) + (targetUser.checkersDraws || 0);
  const checkers8Total = (targetUser.checkers8Wins || 0) + (targetUser.checkers8Losses || 0) + (targetUser.checkers8Draws || 0);

  return {
    success: true,
    user: {
      id: targetUser.id,
      firstName: targetUser.firstName || 'O‘yinchi',
      lastName: targetUser.lastName || '',
      username: targetUser.username || '',
      photoUrl: targetUser.photoUrl || null,
      chessElo: targetUser.chessElo || 1200,
      checkersElo: targetUser.checkersElo || 1200,
      checkers8Elo: targetUser.checkers8Elo || targetUser.checkersElo || 1200,
      chessWins: targetUser.chessWins || 0,
      chessLosses: targetUser.chessLosses || 0,
      chessDraws: targetUser.chessDraws || 0,
      chessTotal,
      chessWinRate: chessTotal > 0 ? Math.round(((targetUser.chessWins || 0) / chessTotal) * 100) : 0,
      checkersWins: targetUser.checkersWins || 0,
      checkersLosses: targetUser.checkersLosses || 0,
      checkersDraws: targetUser.checkersDraws || 0,
      checkersTotal,
      checkersWinRate: checkersTotal > 0 ? Math.round(((targetUser.checkersWins || 0) / checkersTotal) * 100) : 0,
      checkers8Wins: targetUser.checkers8Wins || 0,
      checkers8Losses: targetUser.checkers8Losses || 0,
      checkers8Draws: targetUser.checkers8Draws || 0,
      checkers8Total,
      checkers8WinRate: checkers8Total > 0 ? Math.round(((targetUser.checkers8Wins || 0) / checkers8Total) * 100) : 0
    }
  };
}
