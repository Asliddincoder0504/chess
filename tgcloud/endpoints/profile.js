import { EndpointError } from 'sdk';
import { getOrCreateUser, getUserById } from '../lib/storage/users.js';
import { getUserGameHistory } from '../lib/storage/games.js';
import { isAdminUser } from '../lib/core/admin.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user || input?.devUser;
  if (!user || !user.id) {
    throw new EndpointError('Authentication required', { code: 'UNAUTHORIZED' });
  }

  const dbUser = await getOrCreateUser(user);
  const action = input.action || 'profile';

  if (action === 'profile') {
    return {
      success: true,
      user: {
        ...dbUser,
        isAdmin: isAdminUser(dbUser.id)
      }
    };
  }

  if (action === 'stats') {
    const chessTotal = (dbUser.chessWins || 0) + (dbUser.chessLosses || 0) + (dbUser.chessDraws || 0);
    const checkersTotal = (dbUser.checkersWins || 0) + (dbUser.checkersLosses || 0) + (dbUser.checkersDraws || 0);
    const checkers8Total = (dbUser.checkers8Wins || 0) + (dbUser.checkers8Losses || 0) + (dbUser.checkers8Draws || 0);

    return {
      success: true,
      stats: {
        chess: {
          elo: dbUser.chessElo || 1200,
          wins: dbUser.chessWins || 0,
          losses: dbUser.chessLosses || 0,
          draws: dbUser.chessDraws || 0,
          total: chessTotal,
          winRate: chessTotal > 0 ? Math.round((dbUser.chessWins / chessTotal) * 100) : 0
        },
        checkers: {
          elo: dbUser.checkersElo || 1200,
          wins: dbUser.checkersWins || 0,
          losses: dbUser.checkersLosses || 0,
          draws: dbUser.checkersDraws || 0,
          total: checkersTotal,
          winRate: checkersTotal > 0 ? Math.round((dbUser.checkersWins / checkersTotal) * 100) : 0
        },
        checkers8: {
          elo: dbUser.checkers8Elo || dbUser.checkersElo || 1200,
          wins: dbUser.checkers8Wins || 0,
          losses: dbUser.checkers8Losses || 0,
          draws: dbUser.checkers8Draws || 0,
          total: checkers8Total,
          winRate: checkers8Total > 0 ? Math.round((dbUser.checkers8Wins / checkers8Total) * 100) : 0
        }
      }
    };
  }

  if (action === 'history') {
    const limit = input.limit || 50;
    const history = await getUserGameHistory(dbUser.id, limit);
    return {
      success: true,
      history
    };
  }

  if (action === 'inspect') {
    const targetId = input.targetUserId ? Number(input.targetUserId) : null;
    if (!targetId) throw new EndpointError('Missing targetUserId', { code: 'MISSING_ID' });

    const targetUser = await getUserById(targetId);
    if (!targetUser) throw new EndpointError('User not found', { code: 'NOT_FOUND' });

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

  return {
    success: true,
    user: {
      ...dbUser,
      isAdmin: isAdminUser(dbUser.id)
    }
  };
}
