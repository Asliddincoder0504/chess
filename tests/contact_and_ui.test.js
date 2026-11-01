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
