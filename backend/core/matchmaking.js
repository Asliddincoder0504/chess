import {
  addToQueue,
  removeFromQueue,
  getQueueEntry,
  findOpponentsInQueue,
  setMatchedGame,
  cleanExpiredQueue,
  getQueueStats,
  touchQueueHeartbeat,
  isQueueEntryStale
} from '../storage/matchmaking.js';
import { createGame, getUserActiveGame } from '../storage/games.js';
import { getUserById } from '../storage/users.js';

export const INITIAL_ELO_TOLERANCE = 100;
export const EXPANSION_STEP_SECONDS = 10;
export const ELO_EXPANSION_RATE = 50; // Expand ±50 per 10s wait

/**
 * Calculate dynamic allowed ELO tolerance based on queue wait time
 * @param {number} joinedAtTimestamp
 * @returns {number}
 */
export function calculateAllowedEloRange(joinedAtTimestamp) {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - joinedAtTimestamp);
  const steps = Math.floor(elapsed / EXPANSION_STEP_SECONDS);
  return INITIAL_ELO_TOLERANCE + steps * ELO_EXPANSION_RATE;
}

async function attemptPairInQueue(entry) {
  const opponents = await findOpponentsInQueue({
    userId: entry.userId,
    gameType: entry.gameType,
    timeControl: entry.timeControl
  });

  if (!opponents || opponents.length === 0) return null;

  opponents.sort((a, b) => Math.abs(a.userElo - entry.userElo) - Math.abs(b.userElo - entry.userElo));

  const now = Math.floor(Date.now() / 1000);
  for (const opp of opponents) {
    if (isQueueEntryStale(opp.userId, opp.joinedAt, now, 180)) {
      await removeFromQueue(opp.userId);
      continue;
    }

    const oppAllowed = calculateAllowedEloRange(opp.joinedAt);
    const userAllowed = calculateAllowedEloRange(entry.joinedAt);
    const effectiveAllowed = Math.max(oppAllowed, userAllowed);
    const diff = Math.abs(opp.userElo - entry.userElo);

    if (diff <= effectiveAllowed) {
      const latestOppEntry = await getQueueEntry(opp.userId);
      if (!latestOppEntry || latestOppEntry.matchedGameId) {
        continue;
      }

      const isUserWhite = Math.random() < 0.5;
      const whiteId = isUserWhite ? entry.userId : opp.userId;
      const blackId = isUserWhite ? opp.userId : entry.userId;

      const game = await createGame({
        gameType: entry.gameType,
        timeControl: entry.timeControl,
        whiteId,
        blackId
      });

      await setMatchedGame(entry.userId, game.id, isUserWhite ? 'white' : 'black');
      await setMatchedGame(opp.userId, game.id, isUserWhite ? 'black' : 'white');

      return {
        status: 'matched',
        gameId: game.id,
        assignedColor: isUserWhite ? 'white' : 'black',
        opponent: {
          id: opp.userId,
          elo: opp.userElo
        }
      };
    }
  }

  return null;
}

/**
 * Join matchmaking queue and attempt pairing
 * @param {Object} params
 * @param {number} params.userId
 * @param {'chess' | 'checkers'} params.gameType
 * @param {string} params.timeControl
 * @returns {Promise<Object>}
 */
export async function joinMatchmaking({ userId, gameType, timeControl }) {
  // Check if user already has an active ongoing game
  const activeGame = await getUserActiveGame(userId);
  if (activeGame) {
    return {
      status: 'active_game_exists',
      gameId: activeGame.id,
      message: 'You already have an ongoing game in progress'
    };
  }

  // Get user profile for current rating
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User does not exist');
  }

  const userElo = gameType === 'chess' ? (user.chessElo || 1000) : (user.checkersElo || 1000);

  // Always remove any previous/stuck queue record for this user before joining a fresh search
  await removeFromQueue(userId);

  // Clean stale queue items older than 180 seconds (3 minutes)
  await cleanExpiredQueue(180);

  // Add user queue record with fresh timestamp
  const queueEntry = await addToQueue({
    userId,
    gameType,
    timeControl,
    userElo,
    joinedAt: Math.floor(Date.now() / 1000)
  });

  const match = await attemptPairInQueue(queueEntry);
  if (match) {
    return match;
  }

  // No immediate match found: player is queued and waiting
  return {
    status: 'searching',
    joinedAt: queueEntry.joinedAt,
    elo: userElo,
    currentTolerance: calculateAllowedEloRange(queueEntry.joinedAt)
  };
}

/**
 * Poll matchmaking status
 * @param {number} userId
 * @returns {Promise<Object>}
 */
export async function getMatchmakingStatus(userId) {
  await cleanExpiredQueue(180);
  const entry = await getQueueEntry(userId);
  if (!entry) {
    return { status: 'idle' };
  }

  if (entry.matchedGameId) {
    // Opponent found! Clean up queue for user
    await removeFromQueue(userId);
    return {
      status: 'matched',
      gameId: entry.matchedGameId,
      assignedColor: entry.assignedColor
    };
  }

  touchQueueHeartbeat(userId);

  // Attempt pairing with expanded tolerance during poll cycle
  const matchResult = await attemptPairInQueue(entry);
  if (matchResult) {
    return matchResult;
  }

  const allowedRange = calculateAllowedEloRange(entry.joinedAt);
  const elapsed = Math.floor(Date.now() / 1000) - entry.joinedAt;

  return {
    status: 'searching',
    gameType: entry.gameType,
    timeControl: entry.timeControl,
    userElo: entry.userElo,
    elapsedSeconds: elapsed,
    allowedTolerance: allowedRange
  };
}

/**
 * Cancel matchmaking search
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function cancelMatchmaking(userId) {
  return await removeFromQueue(userId);
}

export { getQueueStats };
