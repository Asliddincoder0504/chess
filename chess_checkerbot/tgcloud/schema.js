/**
 * Telegram Serverless Database Schema for WellChess
 * Deployed to tgcloud SQLite runtime
 */
import { table, integer, text, index } from 'sdk/db';

export const users = table('users', {
  id: integer('id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  languageCode: text('language_code'),
  photoUrl: text('photo_url'),
  chessElo: integer('chess_elo').default(1200),
  checkersElo: integer('checkers_elo').default(1200),
  checkers8Elo: integer('checkers8_elo').default(1200),
  chessWins: integer('chess_wins').default(0),
  chessLosses: integer('chess_losses').default(0),
  chessDraws: integer('chess_draws').default(0),
  checkersWins: integer('checkers_wins').default(0),
  checkersLosses: integer('checkers_losses').default(0),
  checkersDraws: integer('checkers_draws').default(0),
  checkers8Wins: integer('checkers8_wins').default(0),
  checkers8Losses: integer('checkers8_losses').default(0),
  checkers8Draws: integer('checkers8_draws').default(0),
  isBanned: integer('is_banned').default(0),
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
  version: integer('version').default(1),
  whiteTimeMs: integer('white_time_ms'),
  blackTimeMs: integer('black_time_ms'),
  lastMoveTimestamp: integer('last_move_timestamp'),
  winner: text('winner'), // null, 'white', 'black', 'draw'
  winReason: text('win_reason'), // 'checkmate', 'timeout', 'resignation', 'stalemate', etc.
  whiteRatingChange: integer('white_rating_change').default(0),
  blackRatingChange: integer('black_rating_change').default(0),
  drawOfferedBy: text('draw_offered_by'), // null, 'white', 'black'
  rematchOfferedBy: text('rematch_offered_by'), // null, 'white', 'black'
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at')
}, (t) => ({
  whiteIdx: index('idx_games_white').on(t.whiteId),
  blackIdx: index('idx_games_black').on(t.blackId),
  statusIdx: index('idx_games_status').on(t.status)
}));

export const moves = table('moves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: text('game_id'),
  moveNumber: integer('move_number'),
  player: text('player'), // 'white', 'black'
  moveNotation: text('move_notation'),
  moveData: text('move_data'), // JSON string
  timeSpentMs: integer('time_spent_ms'),
  timestamp: integer('timestamp')
}, (t) => ({
  gameMovesIdx: index('idx_moves_game').on(t.gameId)
}));

export const matchmakingQueue = table('matchmaking_queue', {
  userId: integer('user_id').primaryKey(),
  gameType: text('game_type'),
  timeControl: text('time_control'),
  userElo: integer('user_elo'),
  joinedAt: integer('joined_at'),
  matchedGameId: text('matched_game_id'),
  assignedColor: text('assigned_color')
});

export const ratingHistory = table('rating_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  gameType: text('game_type'),
  gameId: text('game_id'),
  oldRating: integer('old_rating'),
  newRating: integer('new_rating'),
  change: integer('change'),
  result: text('result'), // 'win', 'loss', 'draw'
  opponentId: integer('opponent_id'),
  timestamp: integer('timestamp')
}, (t) => ({
  userRatingIdx: index('idx_rating_user').on(t.userId)
}));

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
}, (t) => ({
  senderIdx: index('idx_admin_msg_sender').on(t.senderId)
}));

export const gameMessages = table('game_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: text('game_id'),
  senderId: integer('sender_id'),
  senderName: text('sender_name'),
  text: text('text'),
  timestamp: integer('timestamp')
}, (t) => ({
  gameIdx: index('idx_game_messages_game').on(t.gameId)
}));

