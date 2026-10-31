import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExpectedScore,
  getKFactor,
  calculateNewRatings,
  DEFAULT_STARTING_ELO,
  K_FACTORS
} from '../backend/core/elo.js';

test('ELO: starting ELO default is 1000', () => {
  assert.equal(DEFAULT_STARTING_ELO, 1000);
});

test('ELO: expected score between equal ratings is exactly 0.5', () => {
  const expected = calculateExpectedScore(1000, 1000);
  assert.equal(expected, 0.5);
});

test('ELO: higher rated player has expected score > 0.5', () => {
  const higherExpected = calculateExpectedScore(1400, 1000);
  assert.ok(higherExpected > 0.5, 'Expected score of 1400 vs 1000 should be > 0.5');
  assert.ok(higherExpected < 1.0);
});

test('ELO: K-factors match player experience and rating tier', () => {
  assert.equal(getKFactor(1000, 10), K_FACTORS.PROVISIONAL); // < 30 matches
  assert.equal(getKFactor(1800, 50), K_FACTORS.STANDARD);    // >= 30 matches, < 2400
  assert.equal(getKFactor(2450, 100), K_FACTORS.MASTER);     // >= 2400
});

test('ELO: winning match increases winner rating and decreases loser rating', () => {
  const result = calculateNewRatings({
    whiteRating: 1000,
    blackRating: 1000,
    winner: 'white',
    whiteGames: 0,
    blackGames: 0
  });

  assert.equal(result.white.change, 16);
  assert.equal(result.black.change, -16);
  assert.equal(result.white.newRating, 1016);
  assert.equal(result.black.newRating, 984);
});

test('ELO: draw between equal players yields 0 rating change', () => {
  const result = calculateNewRatings({
    whiteRating: 1200,
    blackRating: 1200,
    winner: 'draw',
    whiteGames: 50,
    blackGames: 50
  });

  assert.equal(result.white.change, 0);
  assert.equal(result.black.change, 0);
  assert.equal(result.white.newRating, 1200);
  assert.equal(result.black.newRating, 1200);
});

test('ELO: draw for lower rated player against higher rated gives positive points', () => {
  const result = calculateNewRatings({
    whiteRating: 1000,
    blackRating: 1600,
    winner: 'draw',
    whiteGames: 10,
    blackGames: 10
  });

  assert.ok(result.white.change > 0, 'Underdog drawing should gain rating points');
  assert.ok(result.black.change < 0, 'Favorite drawing should lose rating points');
});

test('ELO: rating never drops below minimum threshold floor of 100', () => {
  const result = calculateNewRatings({
    whiteRating: 1000,
    blackRating: 105,
    winner: 'white',
    whiteGames: 0,
    blackGames: 0
  });

  assert.ok(result.black.newRating >= 100, 'Rating floor should be at least 100');
});
