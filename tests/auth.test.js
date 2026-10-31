import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTelegramInitData } from '../backend/core/validation.js';

const TEST_BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';

function createMockInitData(userData, authDate = Math.floor(Date.now() / 1000), token = TEST_BOT_TOKEN) {
  const userJson = JSON.stringify(userData);
  const params = {
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0XohD12345',
    user: userJson
  };

  const sortedKeys = Object.keys(params).sort();
  const dataCheckString = sortedKeys.map(k => `${k}=${params[k]}`).join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const urlParams = new URLSearchParams(params);
  urlParams.set('hash', hash);
  return urlParams.toString();
}

test('Auth: valid Telegram initData cryptographically verified successfully', () => {
  const initData = createMockInitData({
    id: 987654321,
    first_name: 'Magnus',
    last_name: 'Carlsen',
    username: 'magnus_c',
    language_code: 'en'
  });

  const res = validateTelegramInitData(initData, TEST_BOT_TOKEN);
  assert.equal(res.valid, true);
  assert.equal(res.user.id, 987654321);
  assert.equal(res.user.firstName, 'Magnus');
  assert.equal(res.user.username, 'magnus_c');
});

test('Auth: tampered initData payload is rejected', () => {
  const initData = createMockInitData({ id: 111111, first_name: 'Alice' });

  // Tamper: replace 111111 with 999999 without recalculating hash
  const tampered = initData.replace('111111', '999999');

  const res = validateTelegramInitData(tampered, TEST_BOT_TOKEN);
  assert.equal(res.valid, false);
  assert.ok(res.error.includes('signature') || res.error.includes('failed'));
});

test('Auth: expired initData (>24h) is rejected', () => {
  const twoDaysAgo = Math.floor(Date.now() / 1000) - 172800;
  const expiredInitData = createMockInitData({ id: 222222, first_name: 'Bob' }, twoDaysAgo);

  const res = validateTelegramInitData(expiredInitData, TEST_BOT_TOKEN);
  assert.equal(res.valid, false);
  assert.ok(res.error.includes('expired'));
});

test('Auth: incorrect bot token fails validation', () => {
  const initData = createMockInitData({ id: 333333, first_name: 'Charlie' });
  const wrongToken = '999999999:WRONG_TOKEN_VALUE';

  const res = validateTelegramInitData(initData, wrongToken);
  assert.equal(res.valid, false);
});
