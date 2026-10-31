import { api } from 'sdk';
import { getOrCreateUser, getLeaderboard } from '../lib/storage/users.js';

const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';

function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '♟️ Open WellChess Mini App',
          web_app: { url: MINI_APP_URL }
        }
      ],
      [
        { text: '⚔️ Play Chess', web_app: { url: `${MINI_APP_URL}?game=chess` } },
        { text: '🔴 Play Checkers', web_app: { url: `${MINI_APP_URL}?game=checkers` } }
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

export default async function (message, ctx) {
  const text = message.text || '';
  const chatId = message.chat.id;
  const tgUser = message.from;

  let dbUser = null;
  if (tgUser) {
    try {
      dbUser = await getOrCreateUser(tgUser);
    } catch (e) {
      console.error('Failed to get or create user:', e);
    }
  }

  // /start
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    if (parts.length > 1 && parts[1].startsWith('game_')) {
      const gameId = parts[1];
      await api.sendMessage({
        chat_id: chatId,
        text: `🎮 *You received an invite to join game ${gameId}!*\n\nClick below to enter the match:`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚔️ Join Game Now', web_app: { url: `${MINI_APP_URL}?gameId=${gameId}` } }]
          ]
        }
      });
      return;
    }

    const name = dbUser?.firstName || tgUser?.first_name || 'Player';
    const chessElo = dbUser?.chessElo || 1200;
    const checkersElo = dbUser?.checkersElo || 1200;

    const welcomeText = [
      `*Welcome to WellChess, ${name}!* ♟️🏆\n`,
      `The premier Telegram multiplayer platform for *Chess* and *Checkers*.\n`,
      `✨ *Your Ratings:*`,
      `• Chess ELO: *${chessElo}*`,
      `• Checkers ELO: *${checkersElo}*\n`,
      `🎮 Real-time multiplayer with official FIDE Chess and International 10x10 Checkers rules.`,
      `Tap below to launch the Mini App!`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: welcomeText,
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    });
    return;
  }

  // /play, /chess, /checkers
  if (text.startsWith('/play') || text.startsWith('/chess') || text.startsWith('/checkers')) {
    const defaultGame = text.includes('checkers') ? 'checkers' : 'chess';
    await api.sendMessage({
      chat_id: chatId,
      text: `*Ready for a game?* 🎮\n\nChoose your game mode:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚔️ Play Chess (8x8)', web_app: { url: `${MINI_APP_URL}?game=chess` } },
            { text: '🔴 Play Checkers (10x10)', web_app: { url: `${MINI_APP_URL}?game=checkers` } }
          ],
          [
            { text: '⚡ Quick Match', web_app: { url: `${MINI_APP_URL}?quick=1` } }
          ]
        ]
      }
    });
    return;
  }

  // /profile
  if (text.startsWith('/profile') || text.startsWith('/stats') || text.startsWith('/rating')) {
    if (!dbUser) {
      await api.sendMessage({ chat_id: chatId, text: 'Profile not found. Please send /start first.' });
      return;
    }

    const chessTotal = (dbUser.chessWins || 0) + (dbUser.chessLosses || 0) + (dbUser.chessDraws || 0);
    const checkersTotal = (dbUser.checkersWins || 0) + (dbUser.checkersLosses || 0) + (dbUser.checkersDraws || 0);
    const chessWinRate = chessTotal > 0 ? Math.round((dbUser.chessWins / chessTotal) * 100) : 0;
    const checkersWinRate = checkersTotal > 0 ? Math.round((dbUser.checkersWins / checkersTotal) * 100) : 0;

    const profileText = [
      `👤 *Player Profile: ${dbUser.firstName}* (@${dbUser.username || 'n/a'})\n`,
      `♟️ *Chess:*`,
      `• ELO Rating: *${dbUser.chessElo}*`,
      `• Record: ${chessTotal} matches (${dbUser.chessWins}W / ${dbUser.chessLosses}L / ${dbUser.chessDraws}D)`,
      `• Win Rate: *${chessWinRate}%*\n`,
      `🔴 *Checkers (10x10):*`,
      `• ELO Rating: *${dbUser.checkersElo}*`,
      `• Record: ${checkersTotal} matches (${dbUser.checkersWins}W / ${dbUser.checkersLosses}L / ${dbUser.checkersDraws}D)`,
      `• Win Rate: *${checkersWinRate}%*`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: profileText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '♟️ Open WellChess App', web_app: { url: MINI_APP_URL } }]
        ]
      }
    });
    return;
  }

  // /leaderboard
  if (text.startsWith('/leaderboard') || text.startsWith('/top')) {
    const topChess = await getLeaderboard('chess', 5);
    const topCheckers = await getLeaderboard('checkers', 5);

    let lbText = `🏆 *Top WellChess Players*\n\n♟️ *Chess Top 5:*\n`;
    topChess.forEach((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lbText += `${medal} *${p.firstName}* - ${p.elo} ELO (${p.wins}W / ${p.losses}L)\n`;
    });

    lbText += `\n🔴 *Checkers Top 5:*\n`;
    topCheckers.forEach((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lbText += `${medal} *${p.firstName}* - ${p.elo} ELO (${p.wins}W / ${p.losses}L)\n`;
    });

    await api.sendMessage({
      chat_id: chatId,
      text: lbText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👑 View Full Leaderboard', web_app: { url: `${MINI_APP_URL}#leaderboard` } }]
        ]
      }
    });
    return;
  }

  // /help
  if (text.startsWith('/help')) {
    const helpText = [
      `ℹ️ *About WellChess Platform*\n`,
      `WellChess is a fast, serverless multiplayer game platform inside Telegram.\n`,
      `*Rules & Fair Play:*`,
      `• *Chess:* Official FIDE rules with check, checkmate, stalemate, castling, en passant, and promotion.`,
      `• *Checkers:* International 10x10 rules with 50 dark squares, mandatory capture, maximum capture rule, and flying kings.`,
      `• *Clocks:* Authoritative server-side clocks with increment.`,
      `• *Ratings:* FIDE-standard ELO system with adaptive K-factors.\n`,
      `*Commands:*`,
      `/start - Launch the bot and main menu`,
      `/play - Quick start a game`,
      `/profile - View your stats & ELO`,
      `/leaderboard - View top players`,
      `/help - Rules and info`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: helpText,
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    });
    return;
  }

  // Default fallback
  await api.sendMessage({
    chat_id: chatId,
    text: `*WellChess:* Tap below to play Chess or Checkers in real time!`,
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard()
  });
}
