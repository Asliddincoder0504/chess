import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { matchmakingQueue } from '../../schema.js';

export async function addToQueue({ userId, gameType, timeControl, userElo }) {
  const entry = {
    userId: Number(userId),
    gameType,
    timeControl,
    userElo: Number(userElo),
    joinedAt: Math.floor(Date.now() / 1000),
    matchedGameId: null,
    assignedColor: null
  };

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
  const res = await db.delete(matchmakingQueue)
    .where(eq(matchmakingQueue.userId, Number(userId)))
    .run();
  return (res?.rowsAffected || 0) > 0;
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

export async function cleanExpiredQueue(maxAgeSeconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - maxAgeSeconds;
  const all = await db.select().from(matchmakingQueue).all();
  for (const entry of all) {
    if (entry.joinedAt < cutoff) {
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
