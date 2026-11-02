import {
  addToQueue,
  removeFromQueue,
  getQueueEntry,
  findOpponentsInQueue,
  setMatchedGame,
  cleanExpiredQueue,
  getQueueStats
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

  // Clean stale queue items older than 20 seconds
  await cleanExpiredQueue(20);

  // Add / refresh user queue record
  const queueEntry = await addToQueue({
    userId,
    gameType,
    timeControl,
    userElo
  });

  // Search for an eligible opponent in queue
  const opponents = await findOpponentsInQueue({ userId, gameType, timeControl });

  if (opponents.length > 0) {
    // Sort opponents by closest ELO
    opponents.sort((a, b) => Math.abs(a.userElo - userElo) - Math.abs(b.userElo - userElo));

    const now = Math.floor(Date.now() / 1000);
    for (const opp of opponents) {
      // Ignore and purge opponents older than 20 seconds
      if (now - opp.joinedAt > 20) {
        await removeFromQueue(opp.userId);
        continue;
      }

      const oppAllowed = calculateAllowedEloRange(opp.joinedAt);
      const userAllowed = calculateAllowedEloRange(queueEntry.joinedAt);
      const effectiveAllowed = Math.max(oppAllowed, userAllowed);
      const diff = Math.abs(opp.userElo - userElo);

      if (diff <= effectiveAllowed) {
        // Concurrency check: Ensure opponent hasn't been snatched
        const latestOppEntry = await getQueueEntry(opp.userId);
        if (!latestOppEntry || latestOppEntry.matchedGameId) {
          continue;
        }

        // Randomly assign White and Black
        const isUserWhite = Math.random() < 0.5;
        const whiteId = isUserWhite ? userId : opp.userId;
        const blackId = isUserWhite ? opp.userId : userId;

        // Create new authoritative game
        const game = await createGame({
          gameType,
          timeControl,
          whiteId,
          blackId
        });

        // Set match in queue for both players
        await setMatchedGame(userId, game.id, isUserWhite ? 'white' : 'black');
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
  await cleanExpiredQueue(20);
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

  const allowedRange = calculateAllowedEloRange(entry.joinedAt);
  const elapsed = Math.floor(Date.now() / 1000) - entry.joinedAt;

  // Attempt pairing during poll cycle as well
  const matchResult = await joinMatchmaking({
    userId,
    gameType: entry.gameType,
    timeControl: entry.timeControl
  });

  if (matchResult.status === 'matched') {
    return matchResult;
  }

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
