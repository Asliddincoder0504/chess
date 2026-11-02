import { api } from 'sdk';
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
import { createGame, getUserActiveGame, getAllActiveGames } from '../storage/games.js';
import { getUserById, getAllUsers } from '../storage/users.js';

export const INITIAL_ELO_TOLERANCE = 100;
export const EXPANSION_STEP_SECONDS = 10;
export const ELO_EXPANSION_RATE = 50; // Expand ±50 per 10s wait

const notificationThrottleMap = new Map();
const hostNotifiedCandidatesMap = new Map();

export function calculateAllowedEloRange(joinedAtTimestamp) {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - joinedAtTimestamp);
  const steps = Math.floor(elapsed / EXPANSION_STEP_SECONDS);
  return INITIAL_ELO_TOLERANCE + steps * ELO_EXPANSION_RATE;
}

async function findAndPairMatch(entry) {
  const opponents = await findOpponentsInQueue({
    userId: entry.userId,
    gameType: entry.gameType,
    timeControl: entry.timeControl
  });

  if (!opponents || opponents.length === 0) return null;

  opponents.sort((a, b) => Math.abs(a.userElo - entry.userElo) - Math.abs(b.userElo - entry.userElo));

  const now = Math.floor(Date.now() / 1000);
  for (const opp of opponents) {
    if (isQueueEntryStale(opp.userId, opp.joinedAt, now, 20)) {
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

      const newGame = await createGame({
        gameType: entry.gameType,
        timeControl: entry.timeControl,
        whiteId,
        blackId
      });

      await setMatchedGame(entry.userId, newGame.id, isUserWhite ? 'white' : 'black');
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

  return null;
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

  // Always remove any previous/stuck queue record for this user before joining a fresh search
  await removeFromQueue(userId);
  await cleanExpiredQueue(20);
  hostNotifiedCandidatesMap.set(Number(userId), new Set());

  const queueEntry = await addToQueue({
    userId,
    gameType,
    timeControl,
    userElo,
    joinedAt: Math.floor(Date.now() / 1000)
  });

  const match = await findAndPairMatch(queueEntry);
  if (match) {
    hostNotifiedCandidatesMap.delete(Number(userId));
    return match;
  }

  return {
    status: 'waiting',
    joinedAt: queueEntry.joinedAt,
    userElo,
    gameType,
    timeControl,
    allowedTolerance: calculateAllowedEloRange(queueEntry.joinedAt)
  };
}

export async function pollMatchmakingStatus(userId) {
  await cleanExpiredQueue(20);

  const entry = await getQueueEntry(userId);
  if (!entry) {
    hostNotifiedCandidatesMap.delete(Number(userId));
    return { status: 'idle' };
  }

  if (entry.matchedGameId) {
    await removeFromQueue(userId);
    hostNotifiedCandidatesMap.delete(Number(userId));
    return {
      status: 'matched',
      gameId: entry.matchedGameId,
      assignedColor: entry.assignedColor
    };
  }

  // Active heartbeat update so searching user stays fresh in queue without resetting joinedAt
  touchQueueHeartbeat(userId);

  // Attempt pairing with the dynamically expanded ELO tolerance
  const match = await findAndPairMatch(entry);
  if (match) {
    hostNotifiedCandidatesMap.delete(Number(userId));
    return match;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, now - entry.joinedAt);
  const currentTolerance = calculateAllowedEloRange(entry.joinedAt);

  return {
    status: 'waiting',
    joinedAt: entry.joinedAt,
    userElo: entry.userElo,
    gameType: entry.gameType,
    timeControl: entry.timeControl,
    elapsedSeconds: elapsed,
    allowedTolerance: currentTolerance
  };
}

export async function cancelMatchmaking(userId) {
  hostNotifiedCandidatesMap.delete(Number(userId));
  await removeFromQueue(userId);
  return { cancelled: true };
}

const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function broadcastMatchmakingRequest({ hostUser, gameType, timeControl, userElo, tolerance = 100 }) {
  try {
    if (!hostUser || !hostUser.id) return { dispatchedCount: 0, targets: [] };
    const hostId = Number(hostUser.id);
    const allUsers = await getAllUsers(200);
    const activeGames = await getAllActiveGames();

    const now = Date.now();
    const busyUserIds = new Set();
    for (const g of activeGames) {
      // Only treat players as busy if active game had activity in last 15 minutes
      const lastActive = g.lastMoveTimestamp || g.createdAt || 0;
      if (now - lastActive < 15 * 60 * 1000) {
        if (g.whiteId) busyUserIds.add(Number(g.whiteId));
        if (g.blackId) busyUserIds.add(Number(g.blackId));
      }
    }

    if (!hostNotifiedCandidatesMap.has(hostId)) {
      hostNotifiedCandidatesMap.set(hostId, new Set());
    }
    const alreadyNotified = hostNotifiedCandidatesMap.get(hostId);
    const hostElo = Number(userElo) || 1200;

    const getElo = (u) => {
      if (gameType === 'checkers8') return u.checkers8Elo || u.checkersElo || 1200;
      if (gameType === 'checkers') return u.checkersElo || 1200;
      return u.chessElo || 1200;
    };

    const candidates = allUsers.filter(u => {
      const uId = Number(u.id);
      if (!uId || isNaN(uId) || uId <= 1000) return false;
      if (uId === hostId) return false;
      if (u.isBanned) return false;
      if (busyUserIds.has(uId)) return false;

      // Do not re-notify candidate who already received an invitation for this active search
      if (alreadyNotified.has(uId)) return false;

      // Global throttle: don't notify same user more than once every 15s
      const lastSent = notificationThrottleMap.get(uId) || 0;
      if (now - lastSent < 15000) return false;

      return true;
    });

    if (candidates.length === 0) return { dispatchedCount: 0, targets: [] };

    // Sort candidates by closest ELO difference
    candidates.sort((a, b) => Math.abs(getElo(a) - hostElo) - Math.abs(getElo(b) - hostElo));

    // Prefer candidates within current tolerance, or if none, closest available candidates
    const withinTol = candidates.filter(u => Math.abs(getElo(u) - hostElo) <= tolerance);
    const targetsToNotify = (withinTol.length > 0 ? withinTol : candidates).slice(0, 3);

    const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';

    let gName = 'Shaxmat (8x8 FIDE)';
    if (gameType === 'checkers8') gName = 'Klassik shashka (8x8, 12 tosh)';
    else if (gameType === 'checkers') gName = 'Xalqaro shashka (10x10, 20 tosh)';

    const hostName = [hostUser.first_name || hostUser.firstName, hostUser.last_name || hostUser.lastName].filter(Boolean).join(' ') || 'O‘yinchi';

    const safeHost = escapeHtml(hostName);
    const safeGame = escapeHtml(gName);
    const safeTime = escapeHtml(timeControl || '3+2');
    const safeUrl = `${MINI_APP_URL}?joinMatch=${hostId}&game=${encodeURIComponent(gameType || 'chess')}&tc=${encodeURIComponent(timeControl || '3+2')}`;

    const dispatchedTargets = [];

    for (const target of targetsToNotify) {
      try {
        await api.sendMessage({
          chat_id: Number(target.id),
          text: `⚡ <b>Sizga yangi onlayn o‘yin so‘rovi bor!</b>\n\n👤 Raqib: <b>${safeHost}</b> (<b>${hostElo} ELO</b>)\n🎮 O‘yin turi: <b>${safeGame}</b>\n⏱ Vaqt nazorati: <b>${safeTime}</b>\n\n🏆 <i>Raqibingiz sizni jonli bellashuvga chorlamoqda! Pastdagi tugmani bosing va o‘yin darhol boshlanadi:</i>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{
                text: '⚔️ Qabul qilish va o‘yinga kirish',
                web_app: { url: safeUrl }
              }]
            ]
          }
        });

        alreadyNotified.add(Number(target.id));
        notificationThrottleMap.set(Number(target.id), now);
        dispatchedTargets.push({
          id: target.id,
          firstName: target.firstName || target.first_name || 'O‘yinchi',
          username: target.username || '',
          elo: getElo(target)
        });
      } catch (err) {
        console.warn(`[Broadcast to ${target.id} failed]:`, err.message);
      }
    }

    return {
      dispatchedCount: dispatchedTargets.length,
      targets: dispatchedTargets
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
