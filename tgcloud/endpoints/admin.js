import {
  handleGetAdminStats,
  handleGetAdminUsers,
  handleAdminBanUser,
  handleGetAdminActiveGames
} from '../../backend/api/admin.js';

export default async function (payload, ctx) {
  const user = ctx.initData?.user || ctx.user;
  if (!user || !user.id) {
    throw new Error('Unauthorized: Telegram user context missing');
  }

  const action = payload.action || 'stats';

  if (action === 'stats') {
    return await handleGetAdminStats(user.id);
  }
  if (action === 'users') {
    return await handleGetAdminUsers(user.id, payload.limit);
  }
  if (action === 'ban') {
    return await handleAdminBanUser(user.id, payload.targetUserId, payload.isBanned);
  }
  if (action === 'games') {
    return await handleGetAdminActiveGames(user.id);
  }

  throw new Error(`Unknown admin action: ${action}`);
}
