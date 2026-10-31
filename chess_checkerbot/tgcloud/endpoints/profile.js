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

    return {
      success: true,
      stats: {
        chess: {
          elo: dbUser.chessElo,
          wins: dbUser.chessWins,
          losses: dbUser.chessLosses,
          draws: dbUser.chessDraws,
          total: chessTotal,
          winRate: chessTotal > 0 ? Math.round((dbUser.chessWins / chessTotal) * 100) : 0
        },
        checkers: {
          elo: dbUser.checkersElo,
          wins: dbUser.checkersWins,
          losses: dbUser.checkersLosses,
          draws: dbUser.checkersDraws,
          total: checkersTotal,
          winRate: checkersTotal > 0 ? Math.round((dbUser.checkersWins / checkersTotal) * 100) : 0
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
