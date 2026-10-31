import crypto from 'node:crypto';
import { db, eq, and, or, desc } from './index.js';
import { games, moves } from '../../schema.js';
import { parseTimeControl } from '../core/validation.js';
import { INITIAL_FEN } from '../core/chess.js';
import { INITIAL_CHECKERS_STATE, INITIAL_CHECKERS_8_STATE } from '../core/checkers.js';

export async function createGame({
  gameType,
  timeControl,
  whiteId,
  blackId = null,
  customId = null,
  status = 'active'
}) {
  const tc = parseTimeControl(timeControl);
  const id = customId || `game_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();

  let initialBoard = INITIAL_FEN;
  if (gameType === 'checkers8') {
    initialBoard = INITIAL_CHECKERS_8_STATE;
  } else if (gameType === 'checkers') {
    initialBoard = INITIAL_CHECKERS_STATE;
  }

  const newGame = {
    id,
    gameType,
    timeControl,
    whiteId: Number(whiteId),
    blackId: blackId !== null ? Number(blackId) : null,
    status: blackId === null ? 'waiting' : status,
    currentTurn: 'white',
    boardState: initialBoard,
    history: JSON.stringify([]),
    version: 1,
    whiteTimeMs: tc.baseMs,
    blackTimeMs: tc.baseMs,
    lastMoveTimestamp: now,
    winner: null,
    winReason: null,
    whiteRatingChange: 0,
    blackRatingChange: 0,
    drawOfferedBy: null,
    rematchOfferedBy: null,
    createdAt: Math.floor(now / 1000),
    updatedAt: Math.floor(now / 1000)
  };

  await db.insert(games).values(newGame).run();
  return newGame;
}

export async function getGameById(id) {
  const row = await db.select()
    .from(games)
    .where(eq(games.id, String(id)))
    .get();
  return row || null;
}

export async function updateGame(id, updates) {
  updates.updatedAt = Math.floor(Date.now() / 1000);
  await db.update(games)
    .set(updates)
    .where(eq(games.id, String(id)))
    .run();
  return await getGameById(id);
}

export async function recordMove({
  gameId,
  moveNumber,
  player,
  moveNotation,
  moveData,
  timeSpentMs = 0
}) {
  const record = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    gameId: String(gameId),
    moveNumber: Number(moveNumber),
    player,
    moveNotation,
    moveData: typeof moveData === 'string' ? moveData : JSON.stringify(moveData),
    timeSpentMs,
    timestamp: Math.floor(Date.now() / 1000)
  };

  await db.insert(moves).values(record).run();
  return record;
}

export async function getGameMoves(gameId) {
  return await db.select()
    .from(moves)
    .where(eq(moves.gameId, String(gameId)))
    .all();
}

export async function getUserActiveGame(userId) {
  const numId = Number(userId);
  const rows = await db.select()
    .from(games)
    .where(and(
      eq(games.status, 'active'),
      or(eq(games.whiteId, numId), eq(games.blackId, numId))
    ))
    .all();

  return rows.length > 0 ? rows[0] : null;
}

export async function getUserGameHistory(userId, limit = 50) {
  const numId = Number(userId);
  const rows = await db.select()
    .from(games)
    .where(or(eq(games.whiteId, numId), eq(games.blackId, numId)))
    .orderBy(desc(games.createdAt))
    .limit(limit)
    .all();

  return rows;
}

export async function getAllActiveGames() {
  return await db.select()
    .from(games)
    .where(eq(games.status, 'active'))
    .orderBy(desc(games.createdAt))
    .all();
}
