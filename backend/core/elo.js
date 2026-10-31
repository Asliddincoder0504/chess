/**
 * WellChess ELO Rating System
 * Standard FIDE-compliant ELO formula with dynamic K-factors
 */

export const DEFAULT_STARTING_ELO = 1000;

export const K_FACTORS = {
  PROVISIONAL: 32, // Fewer than 30 games played
  STANDARD: 24,    // Standard players under 2400
  MASTER: 16       // Players rated 2400 and above
};

/**
 * Determine appropriate K-factor based on player rating and game count
 * @param {number} rating Current ELO rating
 * @param {number} gamesCount Total matches completed by player
 * @returns {number} K-factor
 */
export function getKFactor(rating, gamesCount = 0) {
  if (gamesCount < 30) {
    return K_FACTORS.PROVISIONAL;
  }
  if (rating >= 2400) {
    return K_FACTORS.MASTER;
  }
  return K_FACTORS.STANDARD;
}

/**
 * Calculate expected score between two players
 * E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
 * @param {number} ratingA Rating of player A
 * @param {number} ratingB Rating of player B
 * @returns {number} Expected score between 0.0 and 1.0
 */
export function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ratings after a match
 * @param {Object} params
 * @param {number} params.whiteRating Current rating of white player
 * @param {number} params.blackRating Current rating of black player
 * @param {string} params.winner 'white' | 'black' | 'draw'
 * @param {number} [params.whiteGames=0] White's total games played before this match
 * @param {number} [params.blackGames=0] Black's total games played before this match
 * @returns {Object} Updated ratings and rating deltas
 */
export function calculateNewRatings({
  whiteRating,
  blackRating,
  winner,
  whiteGames = 0,
  blackGames = 0
}) {
  const whiteExpected = calculateExpectedScore(whiteRating, blackRating);
  const blackExpected = calculateExpectedScore(blackRating, whiteRating);

  let whiteScore, blackScore;
  if (winner === 'white') {
    whiteScore = 1;
    blackScore = 0;
  } else if (winner === 'black') {
    whiteScore = 0;
    blackScore = 1;
  } else if (winner === 'draw') {
    whiteScore = 0.5;
    blackScore = 0.5;
  } else {
    throw new Error(`Invalid winner value: ${winner}. Must be 'white', 'black', or 'draw'`);
  }

  const whiteK = getKFactor(whiteRating, whiteGames);
  const blackK = getKFactor(blackRating, blackGames);

  const whiteChange = Math.round(whiteK * (whiteScore - whiteExpected));
  const blackChange = Math.round(blackK * (blackScore - blackExpected));

  const newWhiteRating = Math.max(100, whiteRating + whiteChange);
  const newBlackRating = Math.max(100, blackRating + blackChange);

  return {
    white: {
      oldRating: whiteRating,
      newRating: newWhiteRating,
      change: whiteChange,
      score: whiteScore,
      expected: Number(whiteExpected.toFixed(4)),
      kFactor: whiteK
    },
    black: {
      oldRating: blackRating,
      newRating: newBlackRating,
      change: blackChange,
      score: blackScore,
      expected: Number(blackExpected.toFixed(4)),
      kFactor: blackK
    }
  };
}
