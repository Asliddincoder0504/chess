import { handleGetProfile, handleGetProfileStats, handleGetProfileHistory } from '../../backend/api/profile.js';

export default async function (payload, ctx) {
  const user = ctx.initData?.user || ctx.user;
  if (!user || !user.id) {
    throw new Error('Unauthorized: Telegram user context missing');
  }

  const action = payload.action || 'profile';

  if (action === 'stats') {
    return await handleGetProfileStats(user.id);
  }
  if (action === 'history') {
    return await handleGetProfileHistory(user.id, payload.limit || 50);
  }

  return await handleGetProfile(user);
}
