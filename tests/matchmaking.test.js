import test from 'node:test';
import assert from 'node:assert/strict';
import {
  joinMatchmaking,
  cancelMatchmaking,
  getMatchmakingStatus,
  calculateAllowedEloRange
} from '../backend/core/matchmaking.js';
import { getOrCreateUser } from '../backend/storage/users.js';
import { db } from '../backend/storage/index.js';

test('Matchmaking: dynamic ELO tolerance window expands over time', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(calculateAllowedEloRange(now), 100); // 0s elapsed -> ±100
  assert.equal(calculateAllowedEloRange(now - 10), 150); // 10s elapsed -> ±150
  assert.equal(calculateAllowedEloRange(now - 30), 250); // 30s elapsed -> ±250
});

test('Matchmaking: two players enqueue and get paired atomically', async () => {
  db.clear();

  // Create two distinct players
  await getOrCreateUser({ id: 101, first_name: 'Player 1', username: 'p1' });
  await getOrCreateUser({ id: 102, first_name: 'Player 2', username: 'p2' });

  // Player 1 joins queue
  const res1 = await joinMatchmaking({
    userId: 101,
    gameType: 'chess',
    timeControl: '3+2'
  });

  assert.equal(res1.status, 'searching');

  // Player 2 joins queue with same params
  const res2 = await joinMatchmaking({
    userId: 102,
    gameType: 'chess',
    timeControl: '3+2'
  });

  assert.equal(res2.status, 'matched');
  assert.ok(res2.gameId);
  assert.ok(res2.assignedColor === 'white' || res2.assignedColor === 'black');

  // Player 1 polls and should receive the matched game
  const status1 = await getMatchmakingStatus(101);
  assert.equal(status1.status, 'matched');
  assert.equal(status1.gameId, res2.gameId);
  // Colors must be complementary
  assert.notEqual(status1.assignedColor, res2.assignedColor);
});

test('Matchmaking: cancel removes player from queue', async () => {
  db.clear();
  await getOrCreateUser({ id: 201, first_name: 'Player Cancel', username: 'pc' });

  await joinMatchmaking({ userId: 201, gameType: 'checkers', timeControl: '5+0' });
  const statusBefore = await getMatchmakingStatus(201);
  assert.equal(statusBefore.status, 'searching');

  await cancelMatchmaking(201);
  const statusAfter = await getMatchmakingStatus(201);
  assert.equal(statusAfter.status, 'idle');
});

test('Matchmaking: does not match player against themselves', async () => {
  db.clear();
  await getOrCreateUser({ id: 301, first_name: 'Solo Player', username: 'solo' });

  const res1 = await joinMatchmaking({ userId: 301, gameType: 'chess', timeControl: '10+0' });
  assert.equal(res1.status, 'searching');

  // Second join from same user refreshes entry, does not pair with self
  const res2 = await joinMatchmaking({ userId: 301, gameType: 'chess', timeControl: '10+0' });
  assert.equal(res2.status, 'searching');
});

test('Matchmaking: pairs players with ELO difference > 100 when tolerance expands', async () => {
  db.clear();
  const u1 = await getOrCreateUser({ id: 401, first_name: 'Player Low', username: 'p_low' });
  const u2 = await getOrCreateUser({ id: 402, first_name: 'Player High', username: 'p_high' });

  // Update ratings: u1 = 1000, u2 = 1140 (difference = 140)
  const { updateUserStats } = await import('../backend/storage/users.js');
  await updateUserStats(402, { chessElo: 1140 });

  // Player 1 joins queue
  await joinMatchmaking({ userId: 401, gameType: 'chess', timeControl: '3+2' });

  // Simulate 12 seconds elapsed for Player 1 (tolerance becomes 150)
  const { addToQueue } = await import('../backend/storage/matchmaking.js');
  const now = Math.floor(Date.now() / 1000);
  await addToQueue({
    userId: 401,
    gameType: 'chess',
    timeControl: '3+2',
    userElo: 1000,
    joinedAt: now - 12
  });

  // Player 2 joins queue (diff 140 <= tolerance 150)
  const res2 = await joinMatchmaking({ userId: 402, gameType: 'chess', timeControl: '3+2' });
  assert.equal(res2.status, 'matched');
  assert.ok(res2.gameId);

  // Player 1 polling receives matched game
  const status1 = await getMatchmakingStatus(401);
  assert.equal(status1.status, 'matched');
  assert.equal(status1.gameId, res2.gameId);
});
