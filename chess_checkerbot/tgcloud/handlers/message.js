import { api } from 'sdk';
import { getOrCreateUser, getLeaderboard } from '../lib/storage/users.js';

const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';

function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '🎮 O‘yinni boshlash (Mini App)',
          web_app: { url: MINI_APP_URL }
        }
      ],
      [
        { text: '📖 O‘yin qoidalari haqida ma‘lumot', callback_data: 'btn_rules' }
      ],
      [
        { text: '✍️ Adminga murojaat', web_app: { url: `${MINI_APP_URL}?contact_admin=1` } }
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
      console.error('Foydalanuvchini yaratishda xatolik:', e);
    }
  }

  // /start
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    if (parts.length > 1 && parts[1].startsWith('game_')) {
      const gameId = parts[1];
      await api.sendMessage({
        chat_id: chatId,
        text: `🎮 *Siz o‘yinga taklif qilindingiz!*\n\nO‘yin ID: \`${gameId}\`\nPastdagi tugmani bosing va o‘yinga qo‘shiling:`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚔️ O‘yinga qo‘shilish va boshlash', web_app: { url: `${MINI_APP_URL}?gameId=${gameId}` } }]
          ]
        }
      });
      return;
    }

    const name = dbUser?.firstName || tgUser?.first_name || 'O‘yinchi';
    const chessElo = dbUser?.chessElo || 1200;
    const checkers8Elo = dbUser?.checkers8Elo || dbUser?.checkersElo || 1200;
    const checkersElo = dbUser?.checkersElo || 1200;

    const welcomeText = [
      `*Xush kelibsiz, ${name}!* ♟️🏆\n`,
      `*WellChess* — Telegramdagi Shaxmat va Shashka bo‘yicha rasmiy onlayn platforma.\n`,
      `✨ *Sizning joriy reytinglaringiz:*`,
      `• ♟️ Shaxmat (8x8): *${chessElo} ELO*`,
      `• 🔴 Klassik shashka (8x8, 12 tosh): *${checkers8Elo} ELO*`,
      `• ⚪ Xalqaro shashka (10x10, 20 tosh): *${checkersElo} ELO*\n`,
      `🎮 Do‘stingiz bilan yoki global onlayn raqiblar bilan real vaqt rejimida bellashing!`,
      `O‘ynash uchun pastdagi tugmani bosing:`
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
    await api.sendMessage({
      chat_id: chatId,
      text: `*O‘yin rejimini tanlang:* 🎮`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '♟️ Shaxmat (8x8 FIDE)', web_app: { url: `${MINI_APP_URL}?game=chess` } },
            { text: '🔴 Shashka 8x8 (12 tosh)', web_app: { url: `${MINI_APP_URL}?game=checkers8` } }
          ],
          [
            { text: '⚪ Shashka 10x10 (20 tosh)', web_app: { url: `${MINI_APP_URL}?game=checkers` } },
            { text: '⚡ Tezkor o‘yin', web_app: { url: `${MINI_APP_URL}?quick=1` } }
          ]
        ]
      }
    });
    return;
  }

  // /profile
  if (text.startsWith('/profile') || text.startsWith('/stats') || text.startsWith('/rating')) {
    if (!dbUser) {
      await api.sendMessage({ chat_id: chatId, text: 'Profil topilmadi. Iltimos, avval /start buyrug‘ini bosing.' });
      return;
    }

    const chessTotal = (dbUser.chessWins || 0) + (dbUser.chessLosses || 0) + (dbUser.chessDraws || 0);
    const checkers8Total = (dbUser.checkers8Wins || 0) + (dbUser.checkers8Losses || 0) + (dbUser.checkers8Draws || 0);
    const checkersTotal = (dbUser.checkersWins || 0) + (dbUser.checkersLosses || 0) + (dbUser.checkersDraws || 0);

    const profileText = [
      `👤 *O‘yinchi profili: ${dbUser.firstName}* (@${dbUser.username || 'n/a'})\n`,
      `♟️ *Shaxmat (8x8 FIDE):*`,
      `• ELO: *${dbUser.chessElo || 1200}*`,
      `• O‘yinlar: ${chessTotal} (${dbUser.chessWins || 0}G' / ${dbUser.chessLosses || 0}M / ${dbUser.chessDraws || 0}D)\n`,
      `🔴 *Klassik shashka (8x8, 12 tosh):*`,
      `• ELO: *${dbUser.checkers8Elo || dbUser.checkersElo || 1200}*`,
      `• O‘yinlar: ${checkers8Total} (${dbUser.checkers8Wins || 0}G' / ${dbUser.checkers8Losses || 0}M / ${dbUser.checkers8Draws || 0}D)\n`,
      `⚪ *Xalqaro shashka (10x10, 20 tosh):*`,
      `• ELO: *${dbUser.checkersElo || 1200}*`,
      `• O‘yinlar: ${checkersTotal} (${dbUser.checkersWins || 0}G' / ${dbUser.checkersLosses || 0}M / ${dbUser.checkersDraws || 0}D)`
    ].join('\n');

    await api.sendMessage({
      chat_id: chatId,
      text: profileText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '♟️ Mini App ni ochish', web_app: { url: MINI_APP_URL } }]
        ]
      }
    });
    return;
  }

  // /leaderboard
  if (text.startsWith('/leaderboard') || text.startsWith('/top')) {
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
          [{ text: '👑 To‘liq reytingni ko‘rish', web_app: { url: `${MINI_APP_URL}#leaderboard` } }]
        ]
      }
    });
    return;
  }

  // /rules or /help
  if (text.startsWith('/rules') || text.startsWith('/help') || text.startsWith('/qoida')) {
    const rulesText = [
      `📖 *WellChess O‘yin Qoidalari va Qo‘llanma*\n`,
      `♟️ *1. Shaxmat (8x8 FIDE):*`,
      `• Rasmiy xalqaro FIDE standartlariga 100% mos.`,
      `• Rokirovka (0-0, 0-0-0), yo‘l-yo‘lakay urish (en passant) va so‘nggi katakda sipohga aylanish (promotion) to‘liq ishlaydi.`,
      `• G‘alaba: Mot qo‘yish, raqib vaqti tugashi yoki raqib taslim bo‘lishi orqali.`,
      `• Durang: Pat, 3 marta takrorlanish, 50 yurish qoidasi yoki kelishuv.\n`,
      `🔴 *2. Klassik Shashka (8x8, 12 tosh):*`,
      `• Har bir tomonda 12 tadan tosh faqat qora kataklarda joylashadi.`,
      `• Oddiy tosh oldinga 1 katak yuradi.`,
      `• *Tosh urish:* Oldinga ham, orqaga ham urish mumkin! Tosh urish imkoni bo‘lsa — URISH MAJBURIY!`,
      `• Ketma-ket urish: Tosh barcha mumkin bo‘lgan toshlarni urib o‘tadi.`,
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
      reply_markup: getMainMenuKeyboard()
    });
    return;
  }

  // /contact or /admin
  if (text.startsWith('/contact') || text.startsWith('/admin') || text.startsWith('/murojaat')) {
    await api.sendMessage({
      chat_id: chatId,
      text: `✍️ *Adminga murojaat qilish:*\n\nPlatforma bo‘yicha taklif, shikoyat yoki xatolik haqida xabar berish uchun pastdagi tugmani bosing va formani to‘ldiring:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✍️ Adminga murojaat yuborish', web_app: { url: `${MINI_APP_URL}?contact_admin=1` } }]
        ]
      }
    });
    return;
  }

  // Default fallback
  await api.sendMessage({
    chat_id: chatId,
    text: `*WellChess:* Shaxmat yoki Shashka o‘ynash uchun pastdagi tugmani bosing!`,
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard()
  });
}
