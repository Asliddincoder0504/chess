import { handleTelegramUpdate } from '../../backend/bot/handlers.js';

export default async function (callbackQuery) {
  await handleTelegramUpdate({ callback_query: callbackQuery });
}
