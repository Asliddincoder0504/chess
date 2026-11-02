import { db } from 'sdk';
import { eq, and, or, desc } from 'sdk/db';
import { games, moves, gameMessages } from '../../schema.js';
import { parseTimeControl } from '../core/validation.js';
import { INITIAL_FEN } from '../core/chess.js';
import { INITIAL_CHECKERS_STATE, INITIAL_CHECKERS_8_STATE } from '../core/checkers.js';

function generateGameId() {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);
  return `game_${Date.now()}_${rand}`;
}

export async function createGame({
  gameType,
  timeControl,
  whiteId,
  blackId = null,
  customId = null,
  status = 'active'
}) {
  const tc = parseTimeControl(timeControl);
  const id = customId || generateGameId();
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

const gameChats = new Map();

export async function getGameChat(gameId) {
  try {
    const rows = await db.select()
      .from(gameMessages)
      .where(eq(gameMessages.gameId, String(gameId)))
      .all();
    if (rows && rows.length > 0) {
      return rows.map(r => ({
        id: `msg_${r.id}`,
        senderId: Number(r.senderId),
        senderName: r.senderName,
        text: r.text,
        timestamp: r.timestamp
      }));
    }
  } catch (err) {
    // Fall back to memory cache
  }
  return gameChats.get(String(gameId)) || [];
}

export async function addGameChatMessage(gameId, { senderId, senderName, text }) {
  const gId = String(gameId);
  const now = Date.now();
  const clean = String(text || '').slice(0, 300);
  const msgObj = {
    id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
    gameId: gId,
    senderId: Number(senderId),
    senderName: senderName || 'O‘yinchi',
    text: clean,
    timestamp: now
  };

  if (!gameChats.has(gId)) {
    gameChats.set(gId, []);
  }
  const chatList = gameChats.get(gId);
  chatList.push(msgObj);
  if (chatList.length > 80) {
    chatList.shift();
  }

  try {
    await db.insert(gameMessages).values({
      gameId: gId,
      senderId: Number(senderId),
      senderName: senderName || 'O‘yinchi',
      text: clean,
      timestamp: now
    }).run();

    // Increment game version so opponent polling detects change immediately!
    const game = await getGameById(gId);
    if (game && game.status === 'active') {
      await updateGame(gId, { version: (game.version || 0) + 1 });
    }
  } catch (err) {
    console.warn('[addGameChatMessage db insert error]:', err.message);
  }

  return msgObj;
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

export async function getPendingInvitesForUser(userId) {
  const numId = Number(userId);
  const rows = await db.select()
    .from(games)
    .where(and(
      eq(games.blackId, numId),
      eq(games.status, 'waiting')
    ))
    .orderBy(desc(games.createdAt))
    .limit(5)
    .all();

  return rows;
}

