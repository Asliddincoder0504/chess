import { db, eq, and, ne } from './index.js';
import { matchmakingQueue } from '../../schema.js';

const lastHeartbeatMap = new Map();

export function touchQueueHeartbeat(userId) {
  lastHeartbeatMap.set(Number(userId), Date.now());
}

export function isQueueEntryStale(userId, joinedAt, nowSeconds, maxAgeSeconds = 180) {
  const hb = lastHeartbeatMap.get(Number(userId));
  const lastActive = hb ? Math.floor(hb / 1000) : joinedAt;
  return (nowSeconds - lastActive) > maxAgeSeconds;
}

export async function addToQueue({ userId, gameType, timeControl, userElo, joinedAt }) {
  const entry = {
    userId: Number(userId),
    gameType,
    timeControl,
    userElo: Number(userElo),
    joinedAt: joinedAt || Math.floor(Date.now() / 1000),
    matchedGameId: null,
    assignedColor: null
  };

  touchQueueHeartbeat(userId);

  await db.insert(matchmakingQueue)
    .values(entry)
    .onConflictDoUpdate({
      target: matchmakingQueue.userId,
      set: entry
    })
    .run();

  return entry;
}

export async function removeFromQueue(userId) {
  lastHeartbeatMap.delete(Number(userId));
  const res = await db.delete(matchmakingQueue)
    .where(eq(matchmakingQueue.userId, Number(userId)))
    .run();
  return (res?.changes || 0) > 0;
}

export async function getQueueEntry(userId) {
  return await db.select()
    .from(matchmakingQueue)
    .where(eq(matchmakingQueue.userId, Number(userId)))
    .get();
}

export async function findOpponentsInQueue({ userId, gameType, timeControl }) {
  const allInQueue = await db.select()
    .from(matchmakingQueue)
    .where(and(
      eq(matchmakingQueue.gameType, gameType),
      eq(matchmakingQueue.timeControl, timeControl)
    ))
    .all();

  // Filter out current user and already matched entries
  return allInQueue.filter(entry =>
    entry.userId !== Number(userId) && !entry.matchedGameId
  );
}

export async function setMatchedGame(userId, gameId, assignedColor) {
  await db.update(matchmakingQueue)
    .set({
      matchedGameId: gameId,
      assignedColor
    })
    .where(eq(matchmakingQueue.userId, Number(userId)))
    .run();
}

export async function cleanExpiredQueue(maxAgeSeconds = 180) {
  const now = Math.floor(Date.now() / 1000);
  const all = await db.select().from(matchmakingQueue).all();
  for (const entry of all) {
    if (isQueueEntryStale(entry.userId, entry.joinedAt, now, maxAgeSeconds)) {
      await removeFromQueue(entry.userId);
    }
  }
}

export async function getQueueStats() {
  const all = await db.select().from(matchmakingQueue).all();
  const waiting = all.filter(e => !e.matchedGameId);
  return {
    totalWaiting: waiting.length,
    chessWaiting: waiting.filter(e => e.gameType === 'chess').length,
    checkersWaiting: waiting.filter(e => e.gameType === 'checkers').length
  };
}
