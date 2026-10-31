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

  return {
    success: true,
    user: {
      ...dbUser,
      isAdmin: isAdminUser(dbUser.id)
    }
  };
}
