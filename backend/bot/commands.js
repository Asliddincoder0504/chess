import { getUserById, getOrCreateUser } from '../storage/users.js';
import { getLeaderboard } from '../storage/users.js';
import { getUserGameHistory } from '../storage/games.js';

export function getMiniAppKeyboard(miniAppUrl) {
  return {
    inline_keyboard: [
      [
        {
          text: '♟️ Open WellChess Mini App',
          web_app: { url: miniAppUrl }
        }
      ],
      [
        { text: '👑 Leaderboard', callback_data: 'btn_leaderboard' },
        { text: '👤 My Profile', callback_data: 'btn_profile' }
      ],
      [
        { text: 'ℹ️ How to Play', callback_data: 'btn_help' }
      ]
    ]
  };
}

export async function handleStartCommand(message, miniAppUrl) {
  const tgUser = message.from;
  const user = await getOrCreateUser(tgUser);

  const text = [
    `*Welcome to WellChess, ${user.firstName || 'Player'}!* ♟️🏆\n`,
    `The premier Telegram multiplayer platform for *Chess* and *Checkers*.\n`,
    `✨ *Your Ratings:*`,
    `• Chess ELO: *${user.chessElo || 1000}*`,
    `• Checkers ELO: *${user.checkersElo || 1000}*\n`,
    `🎮 Real-time multiplayer with official FIDE Chess and International 10x10 Checkers rules.`,
    `Click below to launch the Mini App and start playing!`
  ].join('\n');

  return {
    text,
    reply_markup: getMiniAppKeyboard(miniAppUrl)
  };
}

export async function handlePlayCommand(message, miniAppUrl) {
  return {
    text: `*Ready to play?* 🎮\n\nChoose your game in the Mini App:`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '⚔️ Play Chess', web_app: { url: `${miniAppUrl}?game=chess` } },
          { text: '🔴 Play Checkers', web_app: { url: `${miniAppUrl}?game=checkers` } }
        ],
        [
          { text: '⚡ Quick Match', web_app: { url: `${miniAppUrl}?quick=1` } }
        ]
      ]
    }
  };
}

export async function handleProfileCommand(message) {
  const user = await getOrCreateUser(message.from);

  const chessTotal = (user.chessWins || 0) + (user.chessLosses || 0) + (user.chessDraws || 0);
  const checkersTotal = (user.checkersWins || 0) + (user.checkersLosses || 0) + (user.checkersDraws || 0);

  const chessWinRate = chessTotal > 0 ? Math.round((user.chessWins / chessTotal) * 100) : 0;
  const checkersWinRate = checkersTotal > 0 ? Math.round((user.checkersWins / checkersTotal) * 100) : 0;

  const text = [
    `👤 *Player Profile: ${user.firstName}* (@${user.username || 'n/a'})\n`,
    `♟️ *Chess:*`,
    `• ELO Rating: *${user.chessElo}*`,
    `• Matches: ${chessTotal} (W: ${user.chessWins} | L: ${user.chessLosses} | D: ${user.chessDraws})`,
    `• Win Rate: *${chessWinRate}%*\n`,
    `🔴 *Checkers (10x10):*`,
    `• ELO Rating: *${user.checkersElo}*`,
    `• Matches: ${checkersTotal} (W: ${user.checkersWins} | L: ${user.checkersLosses} | D: ${user.checkersDraws})`,
    `• Win Rate: *${checkersWinRate}%*`
  ].join('\n');

  return { text };
}

export async function handleRatingCommand(message) {
  const user = await getOrCreateUser(message.from);
  return {
    text: `📊 *Your Ratings:*\n\n♟️ Chess ELO: *${user.chessElo}*\n🔴 Checkers ELO: *${user.checkersElo}*\n\nStarting ELO is 1000. Win matches to climb the global leaderboard!`
  };
}

export async function handleLeaderboardCommand() {
  const topChess = await getLeaderboard('chess', 5);
  const topCheckers = await getLeaderboard('checkers', 5);

  let text = `🏆 *Top WellChess Players*\n\n♟️ *Chess Top 5:*\n`;
  topChess.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    text += `${medal} *${p.firstName}* - ${p.elo} ELO (${p.wins}W / ${p.losses}L)\n`;
  });

  text += `\n🔴 *Checkers Top 5:*\n`;
  topCheckers.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    text += `${medal} *${p.firstName}* - ${p.elo} ELO (${p.wins}W / ${p.losses}L)\n`;
  });

  return { text };
}

export async function handleHistoryCommand(message) {
  const history = await getUserGameHistory(message.from.id, 5);
  if (history.length === 0) {
    return { text: `📜 *Match History*\n\nYou haven't played any matches yet. Click /play to start!` };
  }

  let text = `📜 *Your Recent Matches:*\n\n`;
  for (const g of history) {
    const isWhite = g.whiteId === message.from.id;
    const isWinner = (g.winner === 'white' && isWhite) || (g.winner === 'black' && !isWhite);
    const isDraw = g.winner === 'draw';
    const badge = isWinner ? '🟢 Victory' : isDraw ? '⚪ Draw' : '🔴 Defeat';
    const gameEmoji = g.gameType === 'chess' ? '♟️' : '🔴';
    const change = isWhite ? g.whiteRatingChange : g.blackRatingChange;
    const changeStr = change > 0 ? `+${change}` : `${change}`;

    text += `${gameEmoji} *${g.gameType.toUpperCase()}* (${g.timeControl}) - ${badge}\n`;
    text += `Rating: ${changeStr} ELO | Reason: ${g.winReason}\n\n`;
  }

  return { text };
}

export async function handleHelpCommand() {
  const text = [
    `ℹ️ *WellChess Help & Commands*\n`,
    `• /start - Launch the bot and main menu`,
    `• /play - Quick match / start playing`,
    `• /profile - View your profile, stats and win rates`,
    `• /rating - View your current ELO ratings`,
    `• /leaderboard - View the top players worldwide`,
    `• /history - Review your recent match results`,
    `• /help - Display this help guide\n`,
    `*Rules Overview:*`,
    `• *Chess:* Standard FIDE rules, en passant, castling, promotion, checkmate.`,
    `• *Checkers:* International 10x10, 20 pieces, backwards capture allowed, mandatory capture, flying kings.`
  ].join('\n');

  return { text };
}
