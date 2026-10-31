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

export function calculateAllowedEloRange(joinedAtTimestamp) {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - joinedAtTimestamp);
  const steps = Math.floor(elapsed / EXPANSION_STEP_SECONDS);
  return INITIAL_ELO_TOLERANCE + steps * ELO_EXPANSION_RATE;
}

export async function joinMatchmaking({ userId, gameType, timeControl }) {
  const activeGame = await getUserActiveGame(userId);
  if (activeGame) {
    return {
      status: 'active_game_exists',
      gameId: activeGame.id,
      message: 'You already have an ongoing game in progress'
    };
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User does not exist');
  }

  const userElo = gameType === 'chess' ? (user.chessElo || 1200) : (user.checkersElo || 1200);

  const currentQueueEntry = await getQueueEntry(userId);
  if (currentQueueEntry && currentQueueEntry.matchedGameId) {
    return {
      status: 'matched',
      gameId: currentQueueEntry.matchedGameId,
      assignedColor: currentQueueEntry.assignedColor
    };
  }

  await cleanExpiredQueue(300);

  const queueEntry = await addToQueue({
    userId,
    gameType,
    timeControl,
    userElo
  });

  const opponents = await findOpponentsInQueue({ userId, gameType, timeControl });

  if (opponents.length > 0) {
    opponents.sort((a, b) => Math.abs(a.userElo - userElo) - Math.abs(b.userElo - userElo));

    for (const opp of opponents) {
      const oppAllowed = calculateAllowedEloRange(opp.joinedAt);
      const userAllowed = calculateAllowedEloRange(queueEntry.joinedAt);
      const effectiveAllowed = Math.max(oppAllowed, userAllowed);
      const diff = Math.abs(opp.userElo - userElo);

      if (diff <= effectiveAllowed) {
        const latestOppEntry = await getQueueEntry(opp.userId);
        if (!latestOppEntry || latestOppEntry.matchedGameId) {
          continue;
        }

        const isUserWhite = Math.random() < 0.5;
        const whiteId = isUserWhite ? userId : opp.userId;
        const blackId = isUserWhite ? opp.userId : userId;

        const newGame = await createGame({
          gameType,
          timeControl,
          whiteId,
          blackId
        });

        await setMatchedGame(userId, newGame.id, isUserWhite ? 'white' : 'black');
        await setMatchedGame(opp.userId, newGame.id, isUserWhite ? 'black' : 'white');

        return {
          status: 'matched',
          gameId: newGame.id,
          assignedColor: isUserWhite ? 'white' : 'black',
          opponentId: opp.userId,
          game: newGame
        };
      }
    }
  }

  return {
    status: 'waiting',
    joinedAt: queueEntry.joinedAt,
    userElo,
    allowedTolerance: calculateAllowedEloRange(queueEntry.joinedAt)
  };
}

export async function pollMatchmakingStatus(userId) {
  const entry = await getQueueEntry(userId);
  if (!entry) {
    const activeGame = await getUserActiveGame(userId);
    if (activeGame) {
      const isWhite = Number(activeGame.whiteId) === Number(userId);
      return {
        status: 'matched',
        gameId: activeGame.id,
        assignedColor: isWhite ? 'white' : 'black',
        game: activeGame
      };
    }
    return { status: 'idle' };
  }

  if (entry.matchedGameId) {
    await removeFromQueue(userId);
    return {
      status: 'matched',
      gameId: entry.matchedGameId,
      assignedColor: entry.assignedColor
    };
  }

  return {
    status: 'waiting',
    joinedAt: entry.joinedAt,
    userElo: entry.userElo,
    allowedTolerance: calculateAllowedEloRange(entry.joinedAt)
  };
}

export async function cancelMatchmaking(userId) {
  const entry = await getQueueEntry(userId);
  if (!entry) return { cancelled: false, message: 'Not in queue' };

  if (entry.matchedGameId) {
    return {
      cancelled: false,
      status: 'matched',
      gameId: entry.matchedGameId,
      assignedColor: entry.assignedColor
    };
  }

  await removeFromQueue(userId);
  return { cancelled: true };
}

export { getQueueStats };
