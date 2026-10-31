import {
  createGame,
  getGameById,
  updateGame,
  recordMove,
  getGameMoves,
  getUserActiveGame,
  getUserGameHistory
} from './storage/games.js';
import { getUserById, updateUserStats } from './storage/users.js';
import { recordRatingHistory } from './storage/ratings.js';
import { ChessGame } from './core/chess.js';
import { CheckersGame } from './core/checkers.js';
import { calculateNewRatings } from './core/elo.js';
import { parseTimeControl } from './core/validation.js';

export async function syncGameClocks(game) {
  if (game.status !== 'active') return game;

  const now = Date.now();
  const elapsed = Math.max(0, now - game.lastMoveTimestamp);

  let whiteTime = game.whiteTimeMs;
  let blackTime = game.blackTimeMs;

  if (game.currentTurn === 'white') {
    whiteTime -= elapsed;
    if (whiteTime <= 0) {
      whiteTime = 0;
      return await finishGame({
        game,
        winner: 'black',
        winReason: 'timeout',
        finalWhiteTime: whiteTime,
        finalBlackTime: blackTime
      });
    }
  } else {
    blackTime -= elapsed;
    if (blackTime <= 0) {
      blackTime = 0;
      return await finishGame({
        game,
        winner: 'white',
        winReason: 'timeout',
        finalWhiteTime: whiteTime,
        finalBlackTime: blackTime
      });
    }
  }

  return {
    ...game,
    whiteTimeMs: Math.max(0, whiteTime),
    blackTimeMs: Math.max(0, blackTime)
  };
}

export async function finishGame({
  game,
  winner,
  winReason,
  finalWhiteTime = game.whiteTimeMs,
  finalBlackTime = game.blackTimeMs
}) {
  if (game.status === 'completed') {
    return game;
  }

  const whiteUser = await getUserById(game.whiteId);
  const blackUser = await getUserById(game.blackId);

  const whiteRating = game.gameType === 'chess' ? (whiteUser?.chessElo || 1200) : (whiteUser?.checkersElo || 1200);
  const blackRating = game.gameType === 'chess' ? (blackUser?.chessElo || 1200) : (blackUser?.checkersElo || 1200);

  const whiteGames = game.gameType === 'chess'
    ? ((whiteUser?.chessWins || 0) + (whiteUser?.chessLosses || 0) + (whiteUser?.chessDraws || 0))
    : ((whiteUser?.checkersWins || 0) + (whiteUser?.checkersLosses || 0) + (whiteUser?.checkersDraws || 0));

  const blackGames = game.gameType === 'chess'
    ? ((blackUser?.chessWins || 0) + (blackUser?.chessLosses || 0) + (blackUser?.chessDraws || 0))
    : ((blackUser?.checkersWins || 0) + (blackUser?.checkersLosses || 0) + (blackUser?.checkersDraws || 0));

  const eloResult = calculateNewRatings({
    whiteRating,
    blackRating,
    winner,
    whiteGames,
    blackGames
  });

  await updateUserStats(game.whiteId, {
    gameType: game.gameType,
    result: winner === 'white' ? 'win' : (winner === 'black' ? 'loss' : 'draw'),
    newRating: eloResult.white.newRating
  });

  await updateUserStats(game.blackId, {
    gameType: game.gameType,
    result: winner === 'black' ? 'win' : (winner === 'white' ? 'loss' : 'draw'),
    newRating: eloResult.black.newRating
  });

  await recordRatingHistory({
    userId: game.whiteId,
    gameType: game.gameType,
    gameId: game.id,
    oldRating: eloResult.white.oldRating,
    newRating: eloResult.white.newRating,
    change: eloResult.white.change,
    result: winner === 'white' ? 'win' : (winner === 'black' ? 'loss' : 'draw'),
    opponentId: game.blackId
  });

  await recordRatingHistory({
    userId: game.blackId,
    gameType: game.gameType,
    gameId: game.id,
    oldRating: eloResult.black.oldRating,
    newRating: eloResult.black.newRating,
    change: eloResult.black.change,
    result: winner === 'black' ? 'win' : (winner === 'white' ? 'loss' : 'draw'),
    opponentId: game.whiteId
  });

  const updated = await updateGame(game.id, {
    status: 'completed',
    winner,
    winReason,
    whiteTimeMs: finalWhiteTime,
    blackTimeMs: finalBlackTime,
    whiteRatingChange: eloResult.white.change,
    blackRatingChange: eloResult.black.change
  });

  return {
    ...updated,
    eloSummary: eloResult
  };
}

export async function handleGetGame(gameId) {
  let game = await getGameById(gameId);
  if (!game) {
    return { error: 'Game not found', status: 404 };
  }

  game = await syncGameClocks(game);

  const whiteUser = await getUserById(game.whiteId);
  const blackUser = await getUserById(game.blackId);
  const moves = await getGameMoves(game.id);

  return {
    success: true,
    game: {
      ...game,
      whitePlayer: {
        id: whiteUser?.id,
        username: whiteUser?.username,
        firstName: whiteUser?.firstName,
        photoUrl: whiteUser?.photoUrl,
        elo: game.gameType === 'chess' ? whiteUser?.chessElo : whiteUser?.checkersElo
      },
      blackPlayer: {
        id: blackUser?.id,
        username: blackUser?.username,
        firstName: blackUser?.firstName,
        photoUrl: blackUser?.photoUrl,
        elo: game.gameType === 'chess' ? blackUser?.chessElo : blackUser?.checkersElo
      },
      moves
    }
  };
}

export async function handleMakeMove(gameId, userId, { move, clientVersion }) {
  let game = await getGameById(gameId);
  if (!game) {
    return { error: 'Game not found', status: 404 };
  }

  if (game.status !== 'active') {
    return { error: 'Game is already completed', status: 400 };
  }

  if (clientVersion !== undefined && clientVersion !== null && clientVersion !== game.version) {
    return { error: 'Game state version mismatch. Please reload.', status: 409 };
  }

  const isWhite = Number(userId) === game.whiteId;
  const isBlack = Number(userId) === game.blackId;

  if (!isWhite && !isBlack) {
    return { error: 'You are not a participant in this game', status: 403 };
  }

  const expectedTurn = isWhite ? 'white' : 'black';
  if (game.currentTurn !== expectedTurn) {
    return { error: 'It is not your turn', status: 400 };
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - game.lastMoveTimestamp);
  const tc = parseTimeControl(game.timeControl);

  let newWhiteTime = game.whiteTimeMs;
  let newBlackTime = game.blackTimeMs;

  if (isWhite) {
    newWhiteTime = game.whiteTimeMs - elapsed;
    if (newWhiteTime <= 0) {
      return await finishGame({ game, winner: 'black', winReason: 'timeout' });
    }
    newWhiteTime += tc.incrementMs;
  } else {
    newBlackTime = game.blackTimeMs - elapsed;
    if (newBlackTime <= 0) {
      return await finishGame({ game, winner: 'white', winReason: 'timeout' });
    }
    newBlackTime += tc.incrementMs;
  }

  let engineResult;
  try {
    if (game.gameType === 'chess') {
      const chess = new ChessGame(game.boardState);
      engineResult = chess.makeMove(move);
    } else if (game.gameType === 'checkers') {
      const checkers = new CheckersGame(game.boardState, isWhite ? 'w' : 'b');
      engineResult = checkers.makeMove(move);
    } else {
      return { error: 'Unsupported game type', status: 400 };
    }
  } catch (err) {
    return { error: err.message, status: 400 };
  }

  const parsedHistory = JSON.parse(game.history || '[]');
  parsedHistory.push({
    player: game.currentTurn,
    move: engineResult.notation || engineResult.san || move,
    timestamp: now
  });

  const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
  const nextVersion = (game.version || 0) + 1;
  const nextBoardState = engineResult.fen || engineResult.state;

  await recordMove({
    gameId: game.id,
    moveNumber: parsedHistory.length,
    player: game.currentTurn,
    moveNotation: engineResult.notation || engineResult.san || JSON.stringify(move),
    moveData: move,
    timeSpentMs: elapsed
  });

  if (engineResult.gameOver) {
    const updated = await updateGame(game.id, {
      boardState: nextBoardState,
      currentTurn: nextTurn,
      history: JSON.stringify(parsedHistory),
      version: nextVersion,
      whiteTimeMs: newWhiteTime,
      blackTimeMs: newBlackTime,
      lastMoveTimestamp: now
    });

    return await finishGame({
      game: updated,
      winner: engineResult.winner,
      winReason: engineResult.winReason,
      finalWhiteTime: newWhiteTime,
      finalBlackTime: newBlackTime
    });
  }

  const updated = await updateGame(game.id, {
    boardState: nextBoardState,
    currentTurn: nextTurn,
    history: JSON.stringify(parsedHistory),
    version: nextVersion,
    whiteTimeMs: newWhiteTime,
    blackTimeMs: newBlackTime,
    lastMoveTimestamp: now,
    drawOfferedBy: null
  });

  return {
    success: true,
    game: updated,
    moveResult: engineResult
  };
}

export async function handleResign(gameId, userId) {
  const game = await getGameById(gameId);
  if (!game) return { error: 'Game not found', status: 404 };
  if (game.status !== 'active') return { error: 'Game is already ended', status: 400 };

  const isWhite = Number(userId) === game.whiteId;
  const isBlack = Number(userId) === game.blackId;
  if (!isWhite && !isBlack) return { error: 'Unauthorized', status: 403 };

  const winner = isWhite ? 'black' : 'white';
  const completedGame = await finishGame({
    game,
    winner,
    winReason: 'resignation'
  });

  return { success: true, game: completedGame };
}

export async function handleDrawAction(gameId, userId, { action }) {
  const game = await getGameById(gameId);
  if (!game) return { error: 'Game not found', status: 404 };
  if (game.status !== 'active') return { error: 'Game is already ended', status: 400 };

  const isWhite = Number(userId) === game.whiteId;
  const isBlack = Number(userId) === game.blackId;
  if (!isWhite && !isBlack) return { error: 'Unauthorized', status: 403 };

  const playerColor = isWhite ? 'white' : 'black';
  const opponentColor = isWhite ? 'black' : 'white';

  if (action === 'offer') {
    const updated = await updateGame(game.id, { drawOfferedBy: playerColor });
    return { success: true, message: 'Draw offer sent', game: updated };
  }

  if (action === 'accept') {
    if (game.drawOfferedBy !== opponentColor) {
      return { error: 'No draw offer to accept', status: 400 };
    }
    const completed = await finishGame({
      game,
      winner: 'draw',
      winReason: 'draw_agreement'
    });
    return { success: true, message: 'Draw agreed', game: completed };
  }

  if (action === 'decline') {
    const updated = await updateGame(game.id, { drawOfferedBy: null });
    return { success: true, message: 'Draw offer declined', game: updated };
  }

  return { error: 'Invalid draw action', status: 400 };
}

export async function handleRematchAction(gameId, userId, { action }) {
  const game = await getGameById(gameId);
  if (!game) return { error: 'Game not found', status: 404 };
  if (game.status !== 'completed') return { error: 'Game is not completed', status: 400 };

  const isWhite = Number(userId) === game.whiteId;
  const isBlack = Number(userId) === game.blackId;
  if (!isWhite && !isBlack) return { error: 'Unauthorized', status: 403 };

  const playerColor = isWhite ? 'white' : 'black';
  const opponentColor = isWhite ? 'black' : 'white';

  if (action === 'offer') {
    const updated = await updateGame(game.id, { rematchOfferedBy: playerColor });
    return { success: true, message: 'Rematch offer sent', game: updated };
  }

  if (action === 'accept') {
    if (game.rematchOfferedBy !== opponentColor) {
      return { error: 'No rematch offer to accept', status: 400 };
    }

    const newGame = await createGame({
      gameType: game.gameType,
      timeControl: game.timeControl,
      whiteId: game.blackId,
      blackId: game.whiteId
    });

    return {
      success: true,
      message: 'Rematch accepted',
      newGameId: newGame.id
    };
  }

  return { error: 'Invalid rematch action', status: 400 };
}
