import { EndpointError } from 'sdk';
import { isAdminUser } from '../lib/core/admin.js';
import { getAllUsers, setUserBanStatus } from '../lib/storage/users.js';
import { getAllActiveGames } from '../lib/storage/games.js';
import { getQueueStats } from '../lib/storage/matchmaking.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user || input?.devUser;
  if (!user || !user.id) {
    throw new EndpointError('Authentication required', { code: 'UNAUTHORIZED' });
  }

  if (!isAdminUser(user.id)) {
    throw new EndpointError('Unauthorized: Admin access required', { code: 'FORBIDDEN' });
  }

  const action = input.action || 'stats';

  if (action === 'stats') {
    const allUsers = await getAllUsers(500);
    const activeGames = await getAllActiveGames();
    const queueStats = await getQueueStats();

    return {
      success: true,
      stats: {
        totalUsers: allUsers.length,
        bannedUsers: allUsers.filter(u => u.isBanned === 1).length,
        activeGamesCount: activeGames.length,
        matchmakingQueue: queueStats
      }
    };
  }

  if (action === 'users') {
    const limit = input.limit || 100;
    const users = await getAllUsers(limit);
    return { success: true, users };
  }

  if (action === 'active_games') {
    const games = await getAllActiveGames();
    return { success: true, games };
  }

  if (action === 'ban') {
    const { targetUserId, isBanned } = input;
    if (!targetUserId) {
      throw new EndpointError('Missing targetUserId', { code: 'MISSING_TARGET_USER' });
    }
    const updatedUser = await setUserBanStatus(targetUserId, Boolean(isBanned));
    return { success: true, user: updatedUser };
  }

  throw new EndpointError(`Unknown admin action: ${action}`, { code: 'UNKNOWN_ACTION' });
}
