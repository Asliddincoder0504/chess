import { api } from 'sdk';
import {
  addToQueue,
  removeFromQueue,
  getQueueEntry,
  findOpponentsInQueue,
  setMatchedGame,
  cleanExpiredQueue,
  getQueueStats
} from '../storage/matchmaking.js';
import { createGame, getUserActiveGame, getAllActiveGames } from '../storage/games.js';
import { getUserById, getAllUsers } from '../storage/users.js';

export const INITIAL_ELO_TOLERANCE = 100;
export const EXPANSION_STEP_SECONDS = 10;
export const ELO_EXPANSION_RATE = 50; // Expand ±50 per 10s wait

const notificationThrottleMap = new Map();

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

  await cleanExpiredQueue(20);

  const queueEntry = await addToQueue({
    userId,
    gameType,
    timeControl,
    userElo
  });

  const opponents = await findOpponentsInQueue({ userId, gameType, timeControl });

  if (opponents.length > 0) {
    opponents.sort((a, b) => Math.abs(a.userElo - userElo) - Math.abs(b.userElo - userElo));

    const now = Math.floor(Date.now() / 1000);
    for (const opp of opponents) {
      // Strictly ignore and purge stale opponents whose heartbeat is older than 20 seconds
      if (now - opp.joinedAt > 20) {
        await removeFromQueue(opp.userId);
        continue;
      }

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
  await cleanExpiredQueue(20);

  const entry = await getQueueEntry(userId);
  if (!entry) {
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

  // Active heartbeat update so searching user stays fresh in queue
  entry.joinedAt = Math.floor(Date.now() / 1000);
  await addToQueue(entry);

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

export async function broadcastMatchmakingRequest({ hostUser, gameType, timeControl, userElo }) {
  try {
    if (!hostUser || !hostUser.id) return;
    const hostId = Number(hostUser.id);
    const allUsers = await getAllUsers(100);
    const activeGames = await getAllActiveGames();

    const busyUserIds = new Set();
    for (const g of activeGames) {
      if (g.whiteId) busyUserIds.add(Number(g.whiteId));
      if (g.blackId) busyUserIds.add(Number(g.blackId));
    }

    const now = Date.now();
    const candidates = allUsers.filter(u => {
      const uId = Number(u.id);
      if (uId === hostId) return false;
      if (u.isBanned) return false;
      if (busyUserIds.has(uId)) return false;

      // Throttle: don't notify same user more than once every 60s
      const lastSent = notificationThrottleMap.get(uId) || 0;
      if (now - lastSent < 60000) return false;

      return true;
    });

    if (candidates.length === 0) return;

    // Sort candidates by closest ELO difference
    const getElo = (u) => {
      if (gameType === 'checkers8') return u.checkers8Elo || u.checkersElo || 1200;
      if (gameType === 'checkers') return u.checkersElo || 1200;
      return u.chessElo || 1200;
    };

    candidates.sort((a, b) => Math.abs(getElo(a) - userElo) - Math.abs(getElo(b) - userElo));

    // Choose top 3 closest candidates
    const targets = candidates.slice(0, 3);
    const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';

    let gName = 'Shaxmat (8x8 FIDE)';
    if (gameType === 'checkers8') gName = 'Klassik shashka (8x8, 12 tosh)';
    else if (gameType === 'checkers') gName = 'Xalqaro shashka (10x10, 20 tosh)';

    const hostName = hostUser.first_name || hostUser.firstName || 'O‘yinchi';

    for (const target of targets) {
      try {
        notificationThrottleMap.set(Number(target.id), now);
        await api.sendMessage({
          chat_id: target.id,
          text: `⚡ *Yangi onlayn o‘yin chaqiruvi!*\n\n👤 Raqib: *${hostName}*\n🏆 Reyting: *${userElo} ELO* (darajangizga mos)\n🎮 O‘yin turi: *${gName}*\n⏱ Vaqt nazorati: *${timeControl}*\n\n🏆 *Birinchi qabul qilgan o‘yinchi bilan o‘yin darhol boshlanadi!*`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{
                text: '⚔️ Qabul qilish va bellashuvga kirish',
                web_app: { url: `${MINI_APP_URL}?joinMatch=${hostId}&game=${gameType}&tc=${timeControl}` }
              }]
            ]
          }
        });
      } catch (err) {
        console.warn(`[Broadcast to ${target.id} failed]:`, err.message);
      }
    }

    return {
      dispatchedCount: targets.length,
      targets: targets.map(t => ({
        id: t.id,
        firstName: t.firstName || 'O‘yinchi',
        username: t.username || '',
        elo: getElo(t)
      }))
    };
  } catch (err) {
    console.warn('[broadcastMatchmakingRequest error]:', err.message);
    return { dispatchedCount: 0, targets: [] };
  }
}

export async function acceptMatchmakingChallenge({ hostUserId, candidateUserId, gameType, timeControl }) {
  const hostId = Number(hostUserId);
  const candId = Number(candidateUserId);

  if (hostId === candId) {
    return { status: 'error', message: 'O‘zingiz bilan o‘ynay olmaysiz' };
  }

  // Check if candidate already has active game
  const candActive = await getUserActiveGame(candId);
  if (candActive) {
    return {
      status: 'matched',
      gameId: candActive.id,
      assignedColor: Number(candActive.whiteId) === candId ? 'white' : 'black',
      game: candActive
    };
  }

  const hostEntry = await getQueueEntry(hostId);
  if (!hostEntry) {
    // Check if game already created with host
    const hostActive = await getUserActiveGame(hostId);
    if (hostActive && (Number(hostActive.whiteId) === candId || Number(hostActive.blackId) === candId)) {
      return {
        status: 'matched',
        gameId: hostActive.id,
        assignedColor: Number(hostActive.whiteId) === candId ? 'white' : 'black',
        game: hostActive
      };
    }
    return {
      status: 'expired',
      message: 'Ushbu taklif muddati o‘tgan yoki o‘yin allaqachon boshlangan'
    };
  }

  if (hostEntry.matchedGameId) {
    return {
      status: 'already_matched',
      message: 'Ushbu chaqiruvni boshqa o‘yinchi qabul qilib bo‘ldi'
    };
  }

  // Atomically create game and match both
  const isHostWhite = Math.random() < 0.5;
  const whiteId = isHostWhite ? hostId : candId;
  const blackId = isHostWhite ? candId : hostId;

  const resolvedGameType = gameType || hostEntry.gameType || 'chess';
  const resolvedTc = timeControl || hostEntry.timeControl || '3+2';

  const newGame = await createGame({
    gameType: resolvedGameType,
    timeControl: resolvedTc,
    whiteId,
    blackId
  });

  await setMatchedGame(hostId, newGame.id, isHostWhite ? 'white' : 'black');
  await setMatchedGame(candId, newGame.id, isHostWhite ? 'black' : 'white');

  return {
    status: 'matched',
    gameId: newGame.id,
    assignedColor: isHostWhite ? 'black' : 'white',
    opponentId: hostId,
    game: newGame
  };
}

export { getQueueStats };
