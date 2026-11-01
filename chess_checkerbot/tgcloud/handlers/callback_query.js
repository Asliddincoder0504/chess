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

    let lbText = `🏆 *Top WellChess o‘yinchilari*\n\n♟️ *Shaxmat Top 5:*\n`;
    topChess.forEach((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lbText += `${medal} *${p.firstName}* — ${p.elo} ELO (${p.wins}G' / ${p.losses}M)\n`;
    });

    lbText += `\n🔴 *Shashka Top 5:*\n`;
    topCheckers.forEach((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lbText += `${medal} *${p.firstName}* — ${p.elo} ELO (${p.wins}G' / ${p.losses}M)\n`;
    });

    await api.sendMessage({
      chat_id: chatId,
      text: lbText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👑 To‘liq reytingni ochish', web_app: { url: `${MINI_APP_URL}#leaderboard` } }]
        ]
      }
    });
    return;
  }

  if (data === 'btn_profile') {
    const dbUser = await getOrCreateUser(user);
    const chessTotal = (dbUser.chessWins || 0) + (dbUser.chessLosses || 0) + (dbUser.chessDraws || 0);
    const checkers8Total = (dbUser.checkers8Wins || 0) + (dbUser.checkers8Losses || 0) + (dbUser.checkers8Draws || 0);
    const checkersTotal = (dbUser.checkersWins || 0) + (dbUser.checkersLosses || 0) + (dbUser.checkersDraws || 0);

    const profileText = [
      `👤 *O‘yinchi profili: ${dbUser.firstName}* (@${dbUser.username || 'n/a'})\n`,
      `♟️ *Shaxmat (8x8 FIDE):*`,
      `• ELO: *${dbUser.chessElo || 1200}*`,
      `• Natija: ${chessTotal} o‘yin (${dbUser.chessWins || 0}G' / ${dbUser.chessLosses || 0}M / ${dbUser.chessDraws || 0}D)\n`,
      `🔴 *Klassik shashka (8x8, 12 tosh):*`,
      `• ELO: *${dbUser.checkers8Elo || dbUser.checkersElo || 1200}*`,
      `• Natija: ${checkers8Total} o‘yin (${dbUser.checkers8Wins || 0}G' / ${dbUser.checkers8Losses || 0}M / ${dbUser.checkers8Draws || 0}D)\n`,
      `⚪ *Xalqaro shashka (10x10, 20 tosh):*`,
      `• ELO: *${dbUser.checkersElo || 1200}*`,
      `• Natija: ${checkersTotal} o‘yin (${dbUser.checkersWins || 0}G' / ${dbUser.checkersLosses || 0}M / ${dbUser.checkersDraws || 0}D)`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: profileText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '♟️ WellChess ilovasini ochish', web_app: { url: MINI_APP_URL } }]
        ]
      }
    });
    return;
  }

  if (data === 'btn_rules' || data === 'btn_help') {
    const rulesText = [
      `📖 *WellChess O‘yin Qoidalari va Qo‘llanma*\n`,
      `♟️ *1. Shaxmat (8x8 FIDE):*`,
      `• Rasmiy xalqaro FIDE standartlariga 100% mos.`,
      `• Rokirovka (0-0, 0-0-0), yo‘l-yo‘lakay urish (en passant) va oxirgi katakda sipohga aylanish (promotion) to‘liq ishlaydi.`,
      `• G‘alaba: Mot qo‘yish, raqib vaqti tugashi yoki raqib taslim bo‘lishi orqali.`,
      `• Durang: Pat, 3 marta bir xil pozitsiya takrorlanishi, 50 yurish qoidasi yoki kelishuv.\n`,
      `🔴 *2. Klassik Shashka (8x8, 12 tosh):*`,
      `• Har bir tomonda 12 tadan tosh faqat qora kataklarda joylashadi.`,
      `• Oddiy tosh oldinga 1 katak yuradi.`,
      `• *Tosh urish:* Oldinga ham, orqaga ham urish mumkin! Tosh urish imkoni bo‘lsa — URISH MAJBURIY!`,
      `• Ketma-ket urish: Tosh barcha mumkin bo‘lgan toshlarni urib o‘tadi (seriyali urish).`,
      `• *Dama (Uchuvchi Dama):* Oxirgi qatorga yetgan tosh Damaga aylanadi va butun diagonal bo‘ylab istalgan masofadagi toshlarni uradi.\n`,
      `⚪ *3. Xalqaro Shashka (10x10, 20 tosh):*`,
      `• 100 katak (10x10), 50 ta qora katak, har bir tomonda 20 tadan tosh.`,
      `• *Ko‘pchilik qoidasi:* Bir nechta urish yo‘li bo‘lsa, eng ko‘p tosh uriladigan yo‘nalish tanlanishi SHART!`,
      `• Dama har qanday diagonal bo‘ylab erkin harakatlanadi.\n`,
      `⏱️ *Server soati va ELO:*`,
      `• O‘yinlar server soati nazorati ostida adolatli o‘tadi va ELO darajasi avtomatik yangilanadi.`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: rulesText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 O‘yinni boshlash (Mini App)', web_app: { url: MINI_APP_URL } }],
          [{ text: '✍️ Adminga murojaat', web_app: { url: `${MINI_APP_URL}?contact_admin=1` } }]
        ]
      }
    });
    return;
  }
}
