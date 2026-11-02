/**
 * Official Telegram Serverless Database Schema
 * Uses Drizzle-like schema definition for the built-in SQLite database
 */

// Helper to provide schema primitives whether in tgcloud SDK or local
let table, integer, text, sql;

try {
  const dbSdk = await import('sdk/db');
  table = dbSdk.table;
  integer = dbSdk.integer;
  text = dbSdk.text;
  sql = dbSdk.sql;
} catch {
  // Local definition fallback for offline development & tests
  const makeCol = (type, colName, opts = {}) => {
    const col = {
      _type: type,
      _name: colName,
      ...opts,
      primaryKey: () => makeCol(type, colName, { ...opts, primaryKey: true }),
      default: (val) => makeCol(type, colName, { ...opts, default: val })
    };
    return col;
  };
  table = (tableName, columns) => ({ _tableName: tableName, _columns: columns, ...columns });
  integer = (colName, opts = {}) => makeCol('integer', colName, opts);
  text = (colName, opts = {}) => makeCol('text', colName, opts);
  sql = (strings, ...values) => ({ _sql: strings, _values: values });
}

export const users = table('users', {
  id: integer('id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  languageCode: text('language_code'),
  photoUrl: text('photo_url'),
  chessElo: integer('chess_elo'),
  checkersElo: integer('checkers_elo'),
  checkers8Elo: integer('checkers8_elo'),
  chessWins: integer('chess_wins'),
  chessLosses: integer('chess_losses'),
  chessDraws: integer('chess_draws'),
  checkersWins: integer('checkers_wins'),
  checkersLosses: integer('checkers_losses'),
  checkersDraws: integer('checkers_draws'),
  checkers8Wins: integer('checkers8_wins'),
  checkers8Losses: integer('checkers8_losses'),
  checkers8Draws: integer('checkers8_draws'),
  isBanned: integer('is_banned'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at')
});

export const games = table('games', {
  id: text('id').primaryKey(),
  gameType: text('game_type'),
  timeControl: text('time_control'),
  whiteId: integer('white_id'),
  blackId: integer('black_id'),
  status: text('status'), // 'active', 'completed', 'aborted'
  currentTurn: text('current_turn'), // 'white', 'black'
  boardState: text('board_state'), // FEN or Checkers string
  history: text('history'), // JSON array of moves
  version: integer('version'), // Concurrency lock / monotonic counter
  whiteTimeMs: integer('white_time_ms'),
  blackTimeMs: integer('black_time_ms'),
  lastMoveTimestamp: integer('last_move_timestamp'),
  winner: text('winner'), // null, 'white', 'black', 'draw'
  winReason: text('win_reason'), // 'checkmate', 'timeout', 'resignation', 'stalemate', etc.
  whiteRatingChange: integer('white_rating_change'),
  blackRatingChange: integer('black_rating_change'),
  drawOfferedBy: text('draw_offered_by'), // null, 'white', 'black'
  rematchOfferedBy: text('rematch_offered_by'), // null, 'white', 'black'
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at')
});

export const moves = table('moves', {
  id: integer('id').primaryKey(),
  gameId: text('game_id'),
  moveNumber: integer('move_number'),
  player: text('player'), // 'white', 'black'
  moveNotation: text('move_notation'),
  moveData: text('move_data'), // JSON string
  timeSpentMs: integer('time_spent_ms'),
  timestamp: integer('timestamp')
});

export const matchmakingQueue = table('matchmaking_queue', {
  userId: integer('user_id').primaryKey(),
  gameType: text('game_type'), // 'chess', 'checkers'
  timeControl: text('time_control'),
  userElo: integer('user_elo'),
  joinedAt: integer('joined_at'),
  matchedGameId: text('matched_game_id'),
  assignedColor: text('assigned_color')
});

export const ratingHistory = table('rating_history', {
  id: integer('id').primaryKey(),
  userId: integer('user_id'),
  gameType: text('game_type'),
  gameId: text('game_id'),
  oldRating: integer('old_rating'),
  newRating: integer('new_rating'),
  change: integer('change'),
  result: text('result'), // 'win', 'loss', 'draw'
  opponentId: integer('opponent_id'),
  timestamp: integer('timestamp')
});

export const adminMessages = table('admin_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  senderId: integer('sender_id'),
  senderName: text('sender_name'),
  username: text('username'),
  topic: text('topic'),
  message: text('message'),
  replyText: text('reply_text'),
  repliedAt: integer('replied_at'),
  repliedBy: text('replied_by'),
  createdAt: integer('created_at'),
  isRead: integer('is_read').default(0)
});

export const gameMessages = table('game_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: text('game_id'),
  senderId: integer('sender_id'),
  senderName: text('sender_name'),
  text: text('text'),
  timestamp: integer('timestamp')
});

