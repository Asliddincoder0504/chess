import { EndpointError, api } from 'sdk';
import { saveAdminMessage, getUserAdminMessages } from '../lib/storage/messages.js';

const ADMIN_IDS = ['6472114736', '8455692606'];

export default async function (input, ctx) {
  const user = ctx.initData?.user || input?.user || input?.devUser;
  const userId = user?.id || input?.userId || 'Noma‘lum';

  if (input?.action === 'get_messages') {
    const list = await getUserAdminMessages(userId);
    return { success: true, messages: list };
  }

  const message = (input?.message || input?.text || '').trim();
  const topic = input?.topic || 'Umumiy';

  if (!message) {
    throw new EndpointError('Xabar matni bo‘sh bo‘lishi mumkin emas', { code: 'EMPTY_MESSAGE' });
  }

  const senderName = user?.first_name || user?.firstName || 'O‘yinchi';
  const senderLastName = user?.last_name || user?.lastName || '';
  const fullName = `${senderName} ${senderLastName}`.trim();
  const username = user?.username ? `@${user.username}` : 'Mavjud emas';

  // Persist message in tgcloud database
  try {
    await saveAdminMessage({
      senderId: userId,
      senderName: fullName,
      username: user?.username || '',
      topic,
      message
    });
  } catch (saveErr) {
    console.error('[tgcloud saveAdminMessage error]:', saveErr.message);
  }

  const timeStr = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

  const adminNotification = [
    `📩 *Yangi murojaat (WellChess Mini App)*\n`,
    `📌 *Mavzu:* ${topic}`,
    `👤 *Yuboruvchi:* ${fullName}`,
    `🆔 *Telegram ID:* \`${userId}\``,
    `🔗 *Username:* ${username}`,
    `⏰ *Vaqt:* ${timeStr}\n`,
    `💬 *Murojaat matni:*`,
    message
  ].join('\n');

  const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';
  const keyboard = [
    [{ text: '💬 Web Appda chatni ochish (Javob berish)', web_app: { url: `${MINI_APP_URL}?admin=1` } }]
  ];
  if (user?.username) {
    keyboard.push([{ text: '✉️ Foydalanuvchiga Telegramda yozish', url: `https://t.me/${user.username.replace(/^@/, '')}` }]);
  } else if (user?.id) {
    keyboard.push([{ text: '✉️ Foydalanuvchiga Telegramda yozish', url: `tg://user?id=${user.id}` }]);
  }
  const replyMarkup = { inline_keyboard: keyboard };

  let sentCount = 0;
  for (const adminId of ADMIN_IDS) {
    try {
      await api.sendMessage({
        chat_id: adminId,
        text: adminNotification,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      });
      sentCount++;
    } catch (err) {
      console.error(`Admin ${adminId} ga xabar yuborishda xatolik:`, err.message);
    }
  }

  return {
    success: true,
    sentToAdmins: sentCount,
    message: 'Murojaatingiz adminlarga muvaffaqiyatli yetkazildi! Tez orada ko‘rib chiqiladi.'
  };
}
