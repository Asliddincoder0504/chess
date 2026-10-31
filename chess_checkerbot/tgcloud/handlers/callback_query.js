import { api } from 'sdk';
import { getOrCreateUser, getLeaderboard } from '../lib/storage/users.js';

const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';

export default async function (callbackQuery, ctx) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id || callbackQuery.from.id;
  const user = callbackQuery.from;

  await api.answerCallbackQuery({ callback_query_id: callbackQuery.id });

  if (data === 'btn_leaderboard') {
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

  if (data === 'btn_profile') {
    const dbUser = await getOrCreateUser(user);
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

  if (data === 'btn_help') {
    const helpText = [
      `ℹ️ *About WellChess Platform*\n`,
      `WellChess is a fast, serverless multiplayer game platform inside Telegram.\n`,
      `*Rules & Fair Play:*`,
      `• *Chess:* Official FIDE rules with check, checkmate, stalemate, castling, en passant, and promotion.`,
      `• *Checkers:* International 10x10 rules with 50 dark squares, mandatory capture, maximum capture rule, and flying kings.`,
      `• *Clocks:* Authoritative server-side clocks with increment.`,
      `• *Ratings:* FIDE-standard ELO system with adaptive K-factors.`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: helpText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '♟️ Open WellChess App', web_app: { url: MINI_APP_URL } }]
        ]
      }
    });
    return;
  }
}
