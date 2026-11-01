import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchApiRequest } from '../backend/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Contact Admin: rejects empty message', async () => {
  const res = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/contact_admin',
    body: { _testUser: { id: 1001, firstName: 'Test Player' }, message: '' }
  });

  assert.equal(res.status, 400);
  assert.match(res.error, /bo‘sh/i);
});

test('Contact Admin: accepts valid message with topic and sender info', async () => {
  const res = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/contact_admin',
    body: {
      _testUser: { id: 6472114736, firstName: 'Asliddin', username: 'asliddincoder0504' },
      topic: 'Taklif',
      message: 'Platformani yanada rivojlantirish bo‘yicha takliflarim bor.'
    }
  });

  assert.equal(res.success, true);
  assert.match(res.message, /adminlarga/i);
});

test('Frontend UI: index.html has flat table structure for Leaderboard', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../frontend/index.html'), 'utf8');

  assert.ok(html.includes('table class="lb-table"'), 'Must contain <table class="lb-table">');
  assert.ok(html.includes('id="leaderboard-tbody"'), 'Must contain <tbody id="leaderboard-tbody">');
  assert.ok(html.includes('th class="th-rank"'), 'Must contain rank column');
  assert.ok(html.includes('th class="th-player"'), 'Must contain player column');
  assert.ok(html.includes('th class="th-elo"'), 'Must contain elo column');
});

test('Frontend UI: index.html has Contact Admin and Game Rules modals', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../frontend/index.html'), 'utf8');

  assert.ok(html.includes('id="contact-admin-modal"'), 'Must contain contact-admin-modal');
  assert.ok(html.includes('id="contact-message-input"'), 'Must contain contact message input');
  assert.ok(html.includes('id="btn-send-contact"'), 'Must contain send contact button');
  assert.ok(html.includes('id="rules-modal"'), 'Must contain rules-modal');
  assert.ok(html.includes('id="btn-open-rules"'), 'Must contain btn-open-rules');
  assert.ok(html.includes('id="btn-open-contact-admin"'), 'Must contain btn-open-contact-admin');
});

test('Telegram Bot: /start menu has only the 3 required options', () => {
  const msgHandler = fs.readFileSync(path.resolve(__dirname, '../chess_checkerbot/tgcloud/handlers/message.js'), 'utf8');

  assert.ok(msgHandler.includes('🎮 O‘yinni boshlash (Mini App)'), 'Must have Mini App button');
  assert.ok(msgHandler.includes('📖 O‘yin qoidalari haqida ma‘lumot'), 'Must have Rules button');
  assert.ok(msgHandler.includes('✍️ Adminga murojaat'), 'Must have Contact Admin button');
  assert.ok(!msgHandler.includes('⚡ Tezkor o‘yin (3 min)'), 'Must NOT have old Tezkor o‘yin button in start menu');
  assert.ok(!msgHandler.includes('btn_profile'), 'Must NOT have old Mening profilim button in start menu');
});

test('Real-Time In-Game Chat: active players can chat, spectators cannot', async () => {
  const { createGame } = await import('../backend/storage/games.js');
  const game = await createGame({
    gameType: 'chess',
    timeControl: '3+2',
    whiteId: 2001,
    blackId: 2002
  });

  // White sends message
  const sendRes = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/game',
    body: {
      action: 'chat_send',
      gameId: game.id,
      text: 'Omad tilayman!',
      _testUser: { id: 2001, firstName: 'Oq O‘yinchi' }
    }
  });

  assert.equal(sendRes.success, true);
  assert.equal(sendRes.message.text, 'Omad tilayman!');
  assert.equal(sendRes.message.senderId, 2001);

  // Black sends reply
  const replyRes = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/game',
    body: {
      action: 'chat_send',
      gameId: game.id,
      text: 'Rahmat, sizga ham omad!',
      _testUser: { id: 2002, firstName: 'Qora O‘yinchi' }
    }
  });
  assert.equal(replyRes.success, true);
  assert.equal(replyRes.chat.length, 2);

  // Outsider / spectator attempts to send chat -> must be blocked (403)
  const outsiderRes = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/game',
    body: {
      action: 'chat_send',
      gameId: game.id,
      text: 'Men tomoshabinman!',
      _testUser: { id: 9999, firstName: 'Tomoshabin' }
    }
  });
  assert.equal(outsiderRes.status, 403);
  assert.match(outsiderRes.error, /Faqat o‘yin ishtirokchilari/i);

  // Getting game state includes real-time chat messages
  const stateRes = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/game',
    body: { action: 'get', gameId: game.id, _testUser: { id: 2001 } }
  });
  assert.equal(stateRes.success, true);
  assert.ok(Array.isArray(stateRes.game.chat));
  assert.equal(stateRes.game.chat.length, 2);
  assert.equal(stateRes.game.chat[0].text, 'Omad tilayman!');
});

test('Frontend UI: Theme Switcher and In-Game Chat drawer in HTML and CSS', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../frontend/index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../frontend/css/style.css'), 'utf8');

  // Header Theme Switcher
  assert.ok(html.includes('id="header-theme-toggle"'), 'Must have header theme toggle button');
  assert.ok(html.includes('id="theme-mode-selector"'), 'Must have theme mode selector in settings');

  // In-Game Chat Drawer & Toggle
  assert.ok(html.includes('id="game-chat-toggle-btn"'), 'Must have game-chat-toggle-btn');
  assert.ok(html.includes('id="game-chat-drawer"'), 'Must have game-chat-drawer');
  assert.ok(html.includes('id="game-chat-messages"'), 'Must have game-chat-messages container');
  assert.ok(html.includes('id="game-chat-input"'), 'Must have game-chat-input field');
  assert.ok(html.includes('class="chat-chip"'), 'Must have quick chat chips');

  // CSS supports both Dark and Light mode
  assert.ok(css.includes('[data-theme="light"]'), 'CSS must define [data-theme="light"] rules');
  assert.ok(css.includes('.game-chat-drawer'), 'CSS must define .game-chat-drawer styles');
  assert.ok(css.includes('.chat-bubble.mine'), 'CSS must define .chat-bubble.mine styles');
  assert.ok(css.includes('.chat-bubble.opponent'), 'CSS must define .chat-bubble.opponent styles');
});

test('Admin Messages Inbox: messages are stored and viewable via /api/admin messages action', async () => {
  const { saveAdminMessage, getAdminMessages } = await import('../backend/storage/messages.js');

  // Submit test message
  const saved = await saveAdminMessage({
    senderId: 998877,
    senderName: 'Umid Alimov',
    username: 'umid_dev',
    topic: 'Taklif',
    message: 'Yangi turnir rejimi juda kerak!'
  });

  assert.equal(saved.senderId, 998877);
  assert.equal(saved.topic, 'Taklif');

  // Check storage retrieval
  const list = await getAdminMessages(10);
  assert.ok(Array.isArray(list));
  const found = list.find(m => m.senderId === 998877);
  assert.ok(found, 'Message must be present in getAdminMessages()');
  assert.equal(found.message, 'Yangi turnir rejimi juda kerak!');

  // Check admin endpoint dispatch
  const adminRes = await dispatchApiRequest({
    method: 'POST',
    pathname: '/api/admin',
    body: {
      action: 'messages',
      _testUser: { id: 6472114736 } // Admin ID
    }
  });

  assert.equal(adminRes.success, true);
  assert.ok(Array.isArray(adminRes.messages));
  assert.ok(adminRes.messages.length > 0);
});

test('Frontend UI: Home showcase graphic & game overview info cards', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../frontend/index.html'), 'utf8');

  assert.ok(html.includes('class="home-showcase-card"'), 'Must have home-showcase-card');
  assert.ok(html.includes('class="showcase-svg"'), 'Must have showcase vector illustration');
  assert.ok(html.includes('Xalqaro Shaxmat'), 'Must have Chess overview info card');
  assert.ok(html.includes('Klassik Shashka'), 'Must have Checkers 8x8 overview info card');
  assert.ok(html.includes('Xalqaro Shashka'), 'Must have International Checkers overview info card');
  assert.ok(html.includes('id="admin-messages-list"'), 'Must have admin-messages-list in Admin panel');
});

