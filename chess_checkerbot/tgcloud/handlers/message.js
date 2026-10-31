import { api } from 'sdk';
import { getOrCreateUser, getLeaderboard } from '../lib/storage/users.js';

const MINI_APP_URL = 'https://app9223102562.tgcloud.ai/';

function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '♟️ WellChess Mini App ni ochish',
          web_app: { url: MINI_APP_URL }
        }
      ],
      [
        { text: '♟️ Shaxmat (8x8)', web_app: { url: `${MINI_APP_URL}?game=chess` } },
        { text: '🔴 Shashka (8x8, 12 tosh)', web_app: { url: `${MINI_APP_URL}?game=checkers8` } }
      ],
      [
        { text: '⚪ Shashka (10x10, 20 tosh)', web_app: { url: `${MINI_APP_URL}?game=checkers` } },
        { text: '⚡ Tezkor o‘yin', web_app: { url: `${MINI_APP_URL}?quick=1` } }
      ],
      [
        { text: '👑 Reyting jadvali', callback_data: 'btn_leaderboard' },
        { text: '👤 Mening profilim', callback_data: 'btn_profile' }
      ],
      [
        { text: 'ℹ️ O‘yin qoidalari va ma‘lumot', callback_data: 'btn_help' }
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

  // /help
  if (text.startsWith('/help')) {
    const helpText = [
      `ℹ️ *WellChess platformasi qoidalari:*\n`,
      `• *Shaxmat:* Rasmiy 8x8 FIDE qoidalari (mot, pat, rokirovka, o‘tkinchi piyoda urish va so‘nggi chiziqda sipohni almashtirish).`,
      `• *Klassik shashka (8x8):* Har bir o‘yinchida 12 tadan tosh, orqaga tosh urish mumkin, Dama (Uchuvchi Dama) qoidalari.`,
      `• *Xalqaro shashka (10x10):* 50 ta qora katak, 20 tadan tosh, maksimal tosh urish majburiy.`,
      `• *Server soati:* Server tomonidan aniq boshqariladigan shaxmat soatlari va vaqt qo‘shilishi (increment).`,
      `• *ELO reytingi:* Rasmiy FIDE koeffitsientlari asosida avtomatik hisoblanadi.\n`,
      `*Buyruqlar:*`,
      `/start — Botni ishga tushirish va bosh menyu`,
      `/play — O‘yin boshlash`,
      `/profile — Shaxsiy reyting va statistika`,
      `/leaderboard — Yetakchilar jadvali`,
      `/help — Qoidalar va yordam`
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
    text: `*WellChess:* Shaxmat yoki Shashka o‘ynash uchun pastdagi tugmani bosing!`,
    parse_mode: 'Markdown',
    reply_markup: getMainMenuKeyboard()
  });
}
