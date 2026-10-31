import { handleGetRatings } from '../../backend/api/ratings.js';

export default async function (payload, ctx) {
  const user = ctx.initData?.user || ctx.user;
  if (!user || !user.id) {
    throw new Error('Unauthorized: Telegram user context missing');
  }

  const gameType = payload.gameType || 'chess';
  return await handleGetRatings(user.id, gameType);
}
