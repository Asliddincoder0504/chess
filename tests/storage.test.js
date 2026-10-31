import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../backend/storage/index.js';
import { getOrCreateUser, getUserById, updateUserStats, getLeaderboard } from '../backend/storage/users.js';
import { createGame, getGameById, updateGame, recordMove, getGameMoves } from '../backend/storage/games.js';
import { recordRatingHistory, getUserRatingHistory } from '../backend/storage/ratings.js';

test('Storage: User CRUD and stats persistence', async () => {
  db.clear();

  const user = await getOrCreateUser({
    id: 9991,
    first_name: 'StorageUser',
    username: 's_user'
  });

  assert.equal(user.id, 9991);
  assert.equal(user.chessElo, 1000);
  assert.equal(user.checkersElo, 1000);

  // Update stats
  await updateUserStats(9991, {
    gameType: 'chess',
    result: 'win',
    newRating: 1032
  });

  const reloaded = await getUserById(9991);
  assert.equal(reloaded.chessElo, 1032);
  assert.equal(reloaded.chessWins, 1);
  assert.equal(reloaded.chessLosses, 0);
});

test('Storage: Leaderboard sorting by rating', async () => {
  db.clear();

  await getOrCreateUser({ id: 1, first_name: 'Low', username: 'low' });
  await getOrCreateUser({ id: 2, first_name: 'High', username: 'high' });
  await getOrCreateUser({ id: 3, first_name: 'Mid', username: 'mid' });

  await updateUserStats(1, { gameType: 'chess', newRating: 900 });
  await updateUserStats(2, { gameType: 'chess', newRating: 1400 });
  await updateUserStats(3, { gameType: 'chess', newRating: 1150 });

  const lb = await getLeaderboard('chess', 10);
  assert.equal(lb.length, 3);
  assert.equal(lb[0].id, 2); // 1400 ELO is rank 1
  assert.equal(lb[1].id, 3); // 1150 ELO is rank 2
  assert.equal(lb[2].id, 1); // 900 ELO is rank 3
});

test('Storage: Game and Move storage', async () => {
  db.clear();

  const game = await createGame({
    gameType: 'chess',
    timeControl: '3+2',
    whiteId: 10,
    blackId: 20
  });

  assert.ok(game.id);
  const fetched = await getGameById(game.id);
  assert.equal(fetched.id, game.id);

  // Record moves
  await recordMove({
    gameId: game.id,
    moveNumber: 1,
    player: 'white',
    moveNotation: 'e4',
    moveData: { from: 'e2', to: 'e4' }
  });

  await recordMove({
    gameId: game.id,
    moveNumber: 2,
    player: 'black',
    moveNotation: 'e5',
    moveData: { from: 'e7', to: 'e5' }
  });

  const moves = await getGameMoves(game.id);
  assert.equal(moves.length, 2);
  assert.equal(moves[0].moveNotation, 'e4');
  assert.equal(moves[1].moveNotation, 'e5');
});

test('Storage: Rating history tracking', async () => {
  db.clear();

  await recordRatingHistory({
    userId: 777,
    gameType: 'chess',
    gameId: 'game_test_1',
    oldRating: 1000,
    newRating: 1016,
    change: 16,
    result: 'win',
    opponentId: 888
  });

  const history = await getUserRatingHistory(777, 'chess', 10);
  assert.equal(history.length, 1);
  assert.equal(history[0].change, 16);
  assert.equal(history[0].result, 'win');
});
