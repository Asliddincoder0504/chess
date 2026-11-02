/**
 * Telegram Bot Notification Dispatcher
 * Sends authoritative notifications using Telegram Bot API
 */

export async function sendTelegramMessage(chatId, text, replyMarkup = null, botToken = process.env.BOT_TOKEN, parseMode = null) {
  const isHtml = parseMode === 'HTML' || /<\/?[a-z][\s\S]*>/i.test(text);
  const mode = parseMode || (isHtml ? 'HTML' : 'Markdown');

  // Try using tgcloud built-in sdk.api if in Telegram Serverless runtime
  try {
    const sdk = await import('sdk');
    if (sdk.api && sdk.api.sendMessage) {
      return await sdk.api.sendMessage({
        chat_id: chatId,
        text,
        parse_mode: mode,
        reply_markup: replyMarkup || undefined
      });
    }
  } catch {
    // Fall back to native fetch
  }

  if (!botToken) {
    console.log(`[Notification (Simulated)] to ${chatId}: ${text}`);
    return { ok: true, simulated: true };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: mode,
        reply_markup: replyMarkup || undefined
      })
    });
    return await response.json();
  } catch (err) {
    console.error(`[Notification Error] Failed to send to ${chatId}:`, err.message);
    return { ok: false, error: err.message };
  }
}

export async function notifyMatchFound({ whiteId, blackId, gameId, gameType, timeControl, miniAppUrl }) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🎮 Enter Game', web_app: { url: `${miniAppUrl}?gameId=${gameId}` } }
      ]
    ]
  };

  const textWhite = `⚔️ *Match Found!*\n\nYou are playing *WHITE* in ${gameType.toUpperCase()} (${timeControl}). Click below to start!`;
  const textBlack = `⚔️ *Match Found!*\n\nYou are playing *BLACK* in ${gameType.toUpperCase()} (${timeControl}). Click below to start!`;

  await Promise.allSettled([
    sendTelegramMessage(whiteId, textWhite, keyboard),
    sendTelegramMessage(blackId, textBlack, keyboard)
  ]);
}

export async function notifyGameResult({ whiteId, blackId, winner, winReason, whiteChange, blackChange, gameType }) {
  const whiteStr = whiteChange > 0 ? `+${whiteChange}` : `${whiteChange}`;
  const blackStr = blackChange > 0 ? `+${blackChange}` : `${blackChange}`;

  let whiteText, blackText;

  if (winner === 'white') {
    whiteText = `🏆 *Victory!* You won the ${gameType} match by ${winReason}!\nRating: *${whiteStr} ELO*`;
    blackText = `💔 *Defeat.* You lost the ${gameType} match by ${winReason}.\nRating: *${blackStr} ELO*`;
  } else if (winner === 'black') {
    whiteText = `💔 *Defeat.* You lost the ${gameType} match by ${winReason}.\nRating: *${whiteStr} ELO*`;
    blackText = `🏆 *Victory!* You won the ${gameType} match by ${winReason}!\nRating: *${blackStr} ELO*`;
  } else {
    whiteText = `🤝 *Draw!* The match ended in a draw (${winReason}).\nRating: *${whiteStr} ELO*`;
    blackText = `🤝 *Draw!* The match ended in a draw (${winReason}).\nRating: *${blackStr} ELO*`;
  }

  await Promise.allSettled([
    sendTelegramMessage(whiteId, whiteText),
    sendTelegramMessage(blackId, blackText)
  ]);
}
