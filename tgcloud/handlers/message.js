import { handleTelegramUpdate } from '../../backend/bot/handlers.js';

export default async function (message) {
  await handleTelegramUpdate({ message });
}
