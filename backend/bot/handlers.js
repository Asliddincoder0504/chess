import {
  handleStartCommand,
  handlePlayCommand,
  handleProfileCommand,
  handleRatingCommand,
  handleLeaderboardCommand,
  handleHistoryCommand,
  handleHelpCommand
} from './commands.js';
import { sendTelegramMessage } from './notifications.js';

export async function handleTelegramUpdate(update, miniAppUrl = process.env.MINI_APP_URL || 'https://user.github.io/wellchess') {
  if (update.message) {
    const msg = update.message;
    const text = msg.text || '';
    const chatId = msg.chat.id;

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1 && parts[1].startsWith('game_')) {
        const gameId = parts[1];
        const res = {
          text: `🎮 *You received an invite to join game ${gameId}!*\nClick below to open:`,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⚔️ Join Game', web_app: { url: `${miniAppUrl}?gameId=${gameId}` } }]
            ]
          }
        };
        await sendTelegramMessage(chatId, res.text, res.reply_markup);
        return;
      }

      const res = await handleStartCommand(msg, miniAppUrl);
      await sendTelegramMessage(chatId, res.text, res.reply_markup);
      return;
    }

    if (text.startsWith('/play')) {
      const res = await handlePlayCommand(msg, miniAppUrl);
      await sendTelegramMessage(chatId, res.text, res.reply_markup);
      return;
    }

    if (text.startsWith('/profile')) {
      const res = await handleProfileCommand(msg);
      await sendTelegramMessage(chatId, res.text);
      return;
    }

    if (text.startsWith('/rating')) {
      const res = await handleRatingCommand(msg);
      await sendTelegramMessage(chatId, res.text);
      return;
    }

    if (text.startsWith('/leaderboard')) {
      const res = await handleLeaderboardCommand();
      await sendTelegramMessage(chatId, res.text);
      return;
    }

    if (text.startsWith('/history')) {
      const res = await handleHistoryCommand(msg);
      await sendTelegramMessage(chatId, res.text);
      return;
    }

    if (text.startsWith('/help')) {
      const res = await handleHelpCommand();
      await sendTelegramMessage(chatId, res.text);
      return;
    }
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data;
    const chatId = cb.message?.chat?.id || cb.from.id;

    if (data === 'btn_leaderboard') {
      const res = await handleLeaderboardCommand();
      await sendTelegramMessage(chatId, res.text);
    } else if (data === 'btn_profile') {
      const res = await handleProfileCommand({ from: cb.from });
      await sendTelegramMessage(chatId, res.text);
    } else if (data === 'btn_help') {
      const res = await handleHelpCommand();
      await sendTelegramMessage(chatId, res.text);
    }
  }
}
