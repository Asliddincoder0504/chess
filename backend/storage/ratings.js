import { db, eq, desc, and } from './index.js';
import { ratingHistory } from '../../schema.js';

export async function recordRatingHistory({
  userId,
  gameType,
  gameId,
  oldRating,
  newRating,
  change,
  result,
  opponentId
}) {
  const record = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    userId: Number(userId),
    gameType,
    gameId,
    oldRating,
    newRating,
    change,
    result,
    opponentId: Number(opponentId),
    timestamp: Math.floor(Date.now() / 1000)
  };

  await db.insert(ratingHistory).values(record).run();
  return record;
}

export async function getUserRatingHistory(userId, gameType = null, limit = 50) {
  let query = db.select().from(ratingHistory);
  if (gameType) {
    query = query.where(and(eq(ratingHistory.userId, Number(userId)), eq(ratingHistory.gameType, gameType)));
  } else {
    query = query.where(eq(ratingHistory.userId, Number(userId)));
  }

  return await query
    .orderBy(desc(ratingHistory.timestamp))
    .limit(limit)
    .all();
}
