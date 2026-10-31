import { db, eq, desc, and } from './index.js';
import { users } from '../../schema.js';
import { DEFAULT_STARTING_ELO } from '../core/elo.js';

export async function getUserById(id) {
  const row = await db.select()
    .from(users)
    .where(eq(users.id, Number(id)))
    .get();
  return row || null;
}

export async function getOrCreateUser(tgUser) {
  const existing = await getUserById(tgUser.id);
  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    await db.update(users)
      .set({
        username: tgUser.username || existing.username,
        firstName: tgUser.firstName || tgUser.first_name || existing.firstName,
        lastName: tgUser.lastName || tgUser.last_name || existing.lastName,
        photoUrl: tgUser.photoUrl || tgUser.photo_url || existing.photoUrl,
        updatedAt: now
      })
      .where(eq(users.id, Number(tgUser.id)))
      .run();

    return await getUserById(tgUser.id);
  }

  const newUser = {
    id: Number(tgUser.id),
    username: tgUser.username || null,
    firstName: tgUser.firstName || tgUser.first_name || 'Player',
    lastName: tgUser.lastName || tgUser.last_name || '',
    languageCode: tgUser.languageCode || tgUser.language_code || 'uz',
    photoUrl: tgUser.photoUrl || tgUser.photo_url || null,
    chessElo: DEFAULT_STARTING_ELO,
    checkersElo: DEFAULT_STARTING_ELO,
    checkers8Elo: DEFAULT_STARTING_ELO,
    chessWins: 0,
    chessLosses: 0,
    chessDraws: 0,
    checkersWins: 0,
    checkersLosses: 0,
    checkersDraws: 0,
    checkers8Wins: 0,
    checkers8Losses: 0,
    checkers8Draws: 0,
    isBanned: 0,
    createdAt: now,
    updatedAt: now
  };

  await db.insert(users).values(newUser).run();
  return newUser;
}

export async function updateUserStats(userId, { gameType, result, newRating }) {
  let user = await getUserById(userId);
  if (!user) {
    user = await getOrCreateUser({ id: userId, first_name: 'O‘yinchi' });
  }
  if (!user) return null;

  const now = Math.floor(Date.now() / 1000);
  const updates = { updatedAt: now };

  if (gameType === 'chess') {
    if (newRating !== undefined) updates.chessElo = newRating;
    if (result === 'win') updates.chessWins = (user.chessWins || 0) + 1;
    else if (result === 'loss') updates.chessLosses = (user.chessLosses || 0) + 1;
    else if (result === 'draw') updates.chessDraws = (user.chessDraws || 0) + 1;
  } else if (gameType === 'checkers8') {
    if (newRating !== undefined) updates.checkers8Elo = newRating;
    if (result === 'win') updates.checkers8Wins = (user.checkers8Wins || 0) + 1;
    else if (result === 'loss') updates.checkers8Losses = (user.checkers8Losses || 0) + 1;
    else if (result === 'draw') updates.checkers8Draws = (user.checkers8Draws || 0) + 1;
  } else if (gameType === 'checkers') {
    if (newRating !== undefined) updates.checkersElo = newRating;
    if (result === 'win') updates.checkersWins = (user.checkersWins || 0) + 1;
    else if (result === 'loss') updates.checkersLosses = (user.checkersLosses || 0) + 1;
    else if (result === 'draw') updates.checkersDraws = (user.checkersDraws || 0) + 1;
  }

  await db.update(users)
    .set(updates)
    .where(eq(users.id, Number(userId)))
    .run();

  return await getUserById(userId);
}

export async function getLeaderboard(gameType = 'chess', limit = 100) {
  let orderCol = users.chessElo;
  if (gameType === 'checkers8') orderCol = users.checkers8Elo || users.checkersElo;
  else if (gameType === 'checkers') orderCol = users.checkersElo;

  const rows = await db.select()
    .from(users)
    .orderBy(desc(orderCol))
    .limit(limit)
    .all();

  return rows.map((u, index) => {
    let wins = u.chessWins || 0;
    let losses = u.chessLosses || 0;
    let draws = u.chessDraws || 0;
    let elo = u.chessElo || 1200;

    if (gameType === 'checkers8') {
      wins = u.checkers8Wins || 0;
      losses = u.checkers8Losses || 0;
      draws = u.checkers8Draws || 0;
      elo = u.checkers8Elo || u.checkersElo || 1200;
    } else if (gameType === 'checkers') {
      wins = u.checkersWins || 0;
      losses = u.checkersLosses || 0;
      draws = u.checkersDraws || 0;
      elo = u.checkersElo || 1200;
    }

    const total = wins + losses + draws;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return {
      rank: index + 1,
      id: u.id,
      firstName: u.firstName,
      username: u.username,
      photoUrl: u.photoUrl,
      elo,
      wins,
      losses,
      draws,
      total,
      winRate
    };
  });
}

export async function getAllUsers(limit = 100) {
  return await db.select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .all();
}

export async function setUserBanStatus(userId, isBanned) {
  const val = isBanned ? 1 : 0;
  await db.update(users)
    .set({ isBanned: val, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, Number(userId)))
    .run();
  return await getUserById(userId);
}
