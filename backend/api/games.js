import {
  createGame,
  getGameById,
  updateGame,
  recordMove,
  getGameMoves,
  getUserActiveGame,
  getUserGameHistory,
  getAllActiveGames
} from '../storage/games.js';
import { getUserById, updateUserStats, getAllUsers } from '../storage/users.js';
import { recordRatingHistory } from '../storage/ratings.js';
import { ChessGame } from '../core/chess.js';
import { CheckersGame } from '../core/checkers.js';
import { calculateNewRatings } from '../core/elo.js';
import { parseTimeControl } from '../core/validation.js';

function getPlayerElo(user, gameType) {
  if (!user) return 1200;
  if (gameType === 'checkers8') return user.checkers8Elo || user.checkersElo || 1200;
  if (gameType === 'checkers') return user.checkersElo || 1200;
  return user.chessElo || 1200;
}

function getPlayerTotalGames(user, gameType) {
  if (!user) return 0;
  if (gameType === 'checkers8') {
    return (user.checkers8Wins || 0) + (user.checkers8Losses || 0) + (user.checkers8Draws || 0);
  }
  if (gameType === 'checkers') {
    return (user.checkersWins || 0) + (user.checkersLosses || 0) + (user.checkersDraws || 0);
  }
  return (user.chessWins || 0) + (user.chessLosses || 0) + (user.chessDraws || 0);
}

export async function syncGameClocks(game) {
  if (game.status !== 'active') return game;

  const now = Date.now();
  const elapsed = Math.max(0, now - (game.lastMoveTimestamp || now));

  let whiteTime = game.whiteTimeMs;
  let blackTime = game.blackTimeMs;
  const GRACE_BUFFER_MS = 3000;

  if (game.currentTurn === 'white') {
    whiteTime -= elapsed;
    if (whiteTime <= -GRACE_BUFFER_MS) {
      whiteTime = 0;
      return await finishGame({
        game,
        winner: 'black',
        winReason: 'timeout',
        finalWhiteTime: 0,
        finalBlackTime: Math.max(0, blackTime)
      });
    }
  } else {
    blackTime -= elapsed;
    if (blackTime <= -GRACE_BUFFER_MS) {
      blackTime = 0;
      return await finishGame({
        game,
        winner: 'white',
        winReason: 'timeout',
        finalWhiteTime: Math.max(0, whiteTime),
        finalBlackTime: 0
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

  const whiteRating = getPlayerElo(whiteUser, game.gameType);
  const blackRating = getPlayerElo(blackUser, game.gameType);

  const whiteGames = getPlayerTotalGames(whiteUser, game.gameType);
  const blackGames = getPlayerTotalGames(blackUser, game.gameType);

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

  if (game.blackId) {
    await updateUserStats(game.blackId, {
      gameType: game.gameType,
      result: winner === 'black' ? 'win' : (winner === 'white' ? 'loss' : 'draw'),
      newRating: eloResult.black.newRating
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
  }

  await recordRatingHistory({
    userId: game.whiteId,
    gameType: game.gameType,
    gameId: game.id,
    oldRating: eloResult.white.oldRating,
    newRating: eloResult.white.newRating,
    change: eloResult.white.change,
    result: winner === 'white' ? 'win' : (winner === 'black' ? 'loss' : 'draw'),
    opponentId: game.blackId || 0
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

  if (game.status === 'active') {
    game = await syncGameClocks(game);
  }

  const whiteUser = await getUserById(game.whiteId);
  const blackUser = game.blackId ? await getUserById(game.blackId) : null;
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
        elo: getPlayerElo(whiteUser, game.gameType)
      },
      blackPlayer: blackUser ? {
        id: blackUser?.id,
        username: blackUser?.username,
        firstName: blackUser?.firstName,
        photoUrl: blackUser?.photoUrl,
        elo: getPlayerElo(blackUser, game.gameType)
      } : null,
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

  const isWhite = Number(userId) === Number(game.whiteId);
  const isBlack = Number(userId) === Number(game.blackId);

  if (!isWhite && !isBlack) {
    return { error: 'You are not a participant in this game', status: 403 };
  }

  const isCurrentTurnPlayer = (game.currentTurn === 'white' && isWhite) || (game.currentTurn === 'black' && isBlack);
  if (!isCurrentTurnPlayer) {
    return { error: 'It is not your turn', status: 400 };
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - (game.lastMoveTimestamp || now));
  const tc = parseTimeControl(game.timeControl);

  let newWhiteTime = game.whiteTimeMs;
  let newBlackTime = game.blackTimeMs;
  const isMovingWhite = game.currentTurn === 'white';
  const GRACE_BUFFER_MS = 3000;

  if (isMovingWhite) {
    newWhiteTime = game.whiteTimeMs - elapsed;
    if (newWhiteTime <= -GRACE_BUFFER_MS) {
      return await finishGame({ game, winner: 'black', winReason: 'timeout', finalWhiteTime: 0, finalBlackTime: Math.max(0, newBlackTime) });
    }
    newWhiteTime = Math.max(0, newWhiteTime) + tc.incrementMs;
  } else {
    newBlackTime = game.blackTimeMs - elapsed;
    if (newBlackTime <= -GRACE_BUFFER_MS) {
      return await finishGame({ game, winner: 'white', winReason: 'timeout', finalWhiteTime: Math.max(0, newWhiteTime), finalBlackTime: 0 });
    }
    newBlackTime = Math.max(0, newBlackTime) + tc.incrementMs;
  }

  let engineResult;
  try {
    if (game.gameType === 'chess') {
      const chess = new ChessGame(game.boardState);
      engineResult = chess.makeMove(move);
    } else if (game.gameType === 'checkers' || game.gameType === 'checkers8') {
      const checkers = new CheckersGame(game.boardState, isMovingWhite ? 'w' : 'b', game.gameType === 'checkers8' ? 8 : 10);
      engineResult = checkers.makeMove(move);
    } else {
      return { error: 'Unsupported game type', status: 400 };
    }
  } catch (err) {
    return { error: err.message, status: 400 };
  }

  const nextBoardState = engineResult.fen || engineResult.state;
  const parsedHistory = JSON.parse(game.history || '[]');
  parsedHistory.push({
    player: game.currentTurn,
    move: engineResult.notation || engineResult.san || move,
    moveData: move,
    boardState: nextBoardState,
    timestamp: now
  });

  const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
  const nextVersion = (game.version || 0) + 1;

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

export async function handleCreateInvite(userId, { gameType = 'chess', timeControl = '5+0' }) {
  const game = await createGame({
    gameType,
    timeControl,
    whiteId: Number(userId),
    blackId: null,
    status: 'waiting'
  });

  return {
    success: true,
    gameId: game.id,
    game
  };
}

export async function handleAcceptInvite(gameId, userId) {
  const game = await getGameById(gameId);
  if (!game) {
    return { error: 'O‘yin topilmadi', status: 404 };
  }
  if (game.status !== 'waiting') {
    return { error: 'O‘yin allaqachon boshlangan yoki yakunlangan', status: 400 };
  }

  const isSoloTest = Number(game.whiteId) === Number(userId);

  const updated = await updateGame(game.id, {
    blackId: Number(userId),
    status: 'active',
    lastMoveTimestamp: Date.now()
  });

  return {
    success: true,
    message: isSoloTest ? 'Test o‘yini boshlandi (ikkala tomon siz)' : 'Taklif qabul qilindi, o‘yin boshlandi!',
    game: updated
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
    if (game.whiteId === game.blackId) {
      const newGame = await createGame({
        gameType: game.gameType,
        timeControl: game.timeControl,
        whiteId: game.whiteId,
        blackId: game.blackId
      });
      return { success: true, message: 'Yangi o‘yin boshlandi!', newGameId: newGame.id };
    }

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

export async function handleGetLiveGames() {
  const activeGames = await getAllActiveGames();
  const list = [];
  for (const g of activeGames) {
    if (!g.blackId) continue; // Waiting for opponent
    const whiteUser = await getUserById(g.whiteId);
    const blackUser = await getUserById(g.blackId);
    const moves = await getGameMoves(g.id);
    list.push({
      id: g.id,
      gameType: g.gameType,
      timeControl: g.timeControl,
      currentTurn: g.currentTurn,
      moveCount: moves.length,
      createdAt: g.createdAt,
      whitePlayer: {
        id: whiteUser?.id,
        firstName: whiteUser?.firstName || 'Oqlar',
        username: whiteUser?.username,
        photoUrl: whiteUser?.photoUrl,
        elo: getPlayerElo(whiteUser, g.gameType)
      },
      blackPlayer: {
        id: blackUser?.id,
        firstName: blackUser?.firstName || 'Qoralar',
        username: blackUser?.username,
        photoUrl: blackUser?.photoUrl,
        elo: getPlayerElo(blackUser, g.gameType)
      }
    });
  }
  return { success: true, games: list };
}

export async function handleGetOnlinePlayers(currentUserId) {
  const allUsers = await getAllUsers(50);
  const activeGames = await getAllActiveGames();
  const playingMap = new Map();
  for (const g of activeGames) {
    if (g.whiteId) playingMap.set(Number(g.whiteId), g.id);
    if (g.blackId) playingMap.set(Number(g.blackId), g.id);
  }

  const players = allUsers
    .filter(u => Number(u.id) !== Number(currentUserId))
    .map(u => ({
      id: u.id,
      firstName: u.firstName || 'O‘yinchi',
      username: u.username || '',
      photoUrl: u.photoUrl || '',
      chessElo: u.chessElo || 1200,
      checkers8Elo: u.checkers8Elo || u.checkersElo || 1200,
      checkersElo: u.checkersElo || 1200,
      isPlaying: playingMap.has(Number(u.id)),
      activeGameId: playingMap.get(Number(u.id)) || null
    }));

  return { success: true, players };
}
