import { getAllUsers, setUserBanStatus, getUserById, resetUserElo } from '../storage/users.js';
import { getAllActiveGames } from '../storage/games.js';
import { getQueueStats } from '../core/matchmaking.js';
import { getAdminMessages } from '../storage/messages.js';

export function isAdminUser(userId) {
  const adminIdsStr = process.env.ADMIN_IDS || '6472114736,8455692606';
  const adminIds = adminIdsStr
    .split(/[,\s.]+/)
    .map(s => Number(s.trim()))
    .filter(n => !isNaN(n) && n > 0);
  return adminIds.includes(Number(userId));
}

export async function handleGetAdminStats(requestingUserId) {
  if (!isAdminUser(requestingUserId)) {
    return { error: 'Unauthorized: Admin access required', status: 403 };
  }

  const allUsers = await getAllUsers(500);
  const activeGames = await getAllActiveGames();
  const queueStats = await getQueueStats();

  const totalUsers = allUsers.length;
  const bannedUsers = allUsers.filter(u => u.isBanned === 1).length;

  return {
    success: true,
    stats: {
      totalUsers,
      bannedUsers,
      activeGamesCount: activeGames.length,
      matchmakingQueue: queueStats
    }
  };
}

export async function handleGetAdminUsers(requestingUserId, limit = 100) {
  if (!isAdminUser(requestingUserId)) {
    return { error: 'Unauthorized: Admin access required', status: 403 };
  }

  const users = await getAllUsers(limit);
  return { success: true, users };
}

export async function handleAdminBanUser(requestingUserId, targetUserId, isBanned) {
  if (!isAdminUser(requestingUserId)) {
    return { error: 'Unauthorized: Admin access required', status: 403 };
  }

  const user = await setUserBanStatus(targetUserId, isBanned);
  return { success: true, user };
}

export async function handleGetAdminActiveGames(requestingUserId) {
  if (!isAdminUser(requestingUserId)) {
    return { error: 'Unauthorized: Admin access required', status: 403 };
  }

  const games = await getAllActiveGames();
  return { success: true, games };
}

export async function handleResetUserRating(requestingUserId, targetUserId, newRating = 1200) {
  if (!isAdminUser(requestingUserId)) {
    return { error: 'Unauthorized: Admin access required', status: 403 };
  }
  await resetUserElo(targetUserId, newRating);
  return { success: true, rating: newRating };
}

export async function handleGetAdminMessages(requestingUserId, limit = 50) {
  if (!isAdminUser(requestingUserId)) {
    return { error: 'Unauthorized: Admin access required', status: 403 };
  }
  const messages = await getAdminMessages(limit);
  return { success: true, messages };
}

