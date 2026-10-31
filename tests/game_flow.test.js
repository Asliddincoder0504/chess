import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../backend/storage/index.js';
import { getOrCreateUser, getUserById } from '../backend/storage/users.js';
import { createGame, getGameById } from '../backend/storage/games.js';
import {
  handleMakeMove,
  handleResign,
  handleDrawAction,
  syncGameClocks
} from '../backend/api/games.js';

test('Game Flow: alternating turns and version increment', async () => {
  db.clear();

  const uWhite = await getOrCreateUser({ id: 501, first_name: 'White GM' });
  const uBlack = await getOrCreateUser({ id: 502, first_name: 'Black GM' });

  const game = await createGame({
    gameType: 'chess',
    timeControl: '3+2',
    whiteId: 501,
    blackId: 502
  });

  assert.equal(game.status, 'active');
  assert.equal(game.currentTurn, 'white');
  assert.equal(game.version, 1);

  // White makes 1. e4
  const move1 = await handleMakeMove(game.id, 501, { move: 'e2e4', clientVersion: 1 });
  assert.ok(move1.success);
  assert.equal(move1.game.currentTurn, 'black');
  assert.equal(move1.game.version, 2);

  // Black makes 1... e5
  const move2 = await handleMakeMove(game.id, 502, { move: 'e7e5', clientVersion: 2 });
  assert.ok(move2.success);
  assert.equal(move2.game.currentTurn, 'white');
  assert.equal(move2.game.version, 3);
});

test('Game Flow: rejects out-of-turn move', async () => {
  db.clear();
  await getOrCreateUser({ id: 601, first_name: 'White P' });
  await getOrCreateUser({ id: 602, first_name: 'Black P' });

  const game = await createGame({
    gameType: 'chess',
    timeControl: '5+0',
    whiteId: 601,
    blackId: 602
  });

  // Black tries to move first
  const res = await handleMakeMove(game.id, 602, { move: 'e7e5' });
  assert.equal(res.status, 400);
  assert.ok(res.error.includes('turn'));
});

test('Game Flow: rejects stale version (concurrency conflict)', async () => {
  db.clear();
  await getOrCreateUser({ id: 701, first_name: 'White C' });
  await getOrCreateUser({ id: 702, first_name: 'Black C' });

  const game = await createGame({
    gameType: 'chess',
    timeControl: '3+0',
    whiteId: 701,
    blackId: 702
  });

  // Client passes stale version 0 when server is on version 1
  const res = await handleMakeMove(game.id, 701, { move: 'd2d4', clientVersion: 0 });
  assert.equal(res.status, 409);
  assert.ok(res.error.includes('mismatch'));
});

test('Game Flow: resignation completes game and updates ELO', async () => {
  db.clear();
  await getOrCreateUser({ id: 801, first_name: 'Resigner' });
  await getOrCreateUser({ id: 802, first_name: 'Victor' });

  const game = await createGame({
    gameType: 'chess',
    timeControl: '3+2',
    whiteId: 801,
    blackId: 802
  });

  // White resigns
  const res = await handleResign(game.id, 801);
  assert.ok(res.success);
  assert.equal(res.game.status, 'completed');
  assert.equal(res.game.winner, 'black');
  assert.equal(res.game.winReason, 'resignation');

  // Verify ratings updated in database
  const updatedWhite = await getUserById(801);
  const updatedBlack = await getUserById(802);

  assert.ok(updatedWhite.chessElo < 1000);
  assert.ok(updatedBlack.chessElo > 1000);
  assert.equal(updatedWhite.chessLosses, 1);
  assert.equal(updatedBlack.chessWins, 1);
});

test('Game Flow: draw offer and agreement', async () => {
  db.clear();
  await getOrCreateUser({ id: 901, first_name: 'DrawP1' });
  await getOrCreateUser({ id: 902, first_name: 'DrawP2' });

  const game = await createGame({
    gameType: 'checkers',
    timeControl: '5+0',
    whiteId: 901,
    blackId: 902
  });

  // White offers draw
  const offerRes = await handleDrawAction(game.id, 901, { action: 'offer' });
  assert.ok(offerRes.success);
  assert.equal(offerRes.game.drawOfferedBy, 'white');

  // Black accepts draw
  const acceptRes = await handleDrawAction(game.id, 902, { action: 'accept' });
  assert.ok(acceptRes.success);
  assert.equal(acceptRes.game.status, 'completed');
  assert.equal(acceptRes.game.winner, 'draw');
  assert.equal(acceptRes.game.winReason, 'draw_agreement');
});

test('Game Flow: clock flag fall (timeout detection)', async () => {
  db.clear();
  await getOrCreateUser({ id: 1101, first_name: 'TimeOut1' });
  await getOrCreateUser({ id: 1102, first_name: 'TimeOut2' });

  const game = await createGame({
    gameType: 'chess',
    timeControl: '1+0', // 60s
    whiteId: 1101,
    blackId: 1102
  });

  // Simulate elapsed time exceeding 60s
  game.lastMoveTimestamp = Date.now() - 75000; // 75 seconds ago
  game.whiteTimeMs = 60000;

  const synced = await syncGameClocks(game);
  assert.equal(synced.status, 'completed');
  assert.equal(synced.winner, 'black');
  assert.equal(synced.winReason, 'timeout');
});
