import crypto from 'node:crypto';

export const SUPPORTED_GAME_TYPES = ['chess', 'checkers', 'checkers8'];

export const SUPPORTED_TIME_CONTROLS = {
  '1+0': { baseSeconds: 60, incrementSeconds: 0, category: 'bullet' },
  '2+1': { baseSeconds: 120, incrementSeconds: 1, category: 'bullet' },
  '3+0': { baseSeconds: 180, incrementSeconds: 0, category: 'blitz' },
  '3+2': { baseSeconds: 180, incrementSeconds: 2, category: 'blitz' },
  '5+0': { baseSeconds: 300, incrementSeconds: 0, category: 'blitz' },
  '10+0': { baseSeconds: 600, incrementSeconds: 0, category: 'rapid' },
  '10+5': { baseSeconds: 600, incrementSeconds: 5, category: 'rapid' },
  '15+10': { baseSeconds: 900, incrementSeconds: 10, category: 'rapid' }
};

export function isValidGameType(type) {
  return SUPPORTED_GAME_TYPES.includes(type);
}

export function isValidTimeControl(tc) {
  return Boolean(SUPPORTED_TIME_CONTROLS[tc]);
}

export function parseTimeControl(tc) {
  const config = SUPPORTED_TIME_CONTROLS[tc] || SUPPORTED_TIME_CONTROLS['5+0'];
  return {
    ...config,
    baseMs: config.baseSeconds * 1000,
    incrementMs: config.incrementSeconds * 1000
  };
}

export function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'Missing or empty initData' };
  }

  if (!botToken || typeof botToken !== 'string') {
    return { valid: false, error: 'Server misconfiguration: bot token missing' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, error: 'Missing hash parameter in initData' };
    }

    params.delete('hash');

    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys
      .map(key => `${key}=${params.get(key)}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const calculatedHashBuf = Buffer.from(calculatedHash, 'hex');
    const providedHashBuf = Buffer.from(hash, 'hex');

    if (calculatedHashBuf.length !== providedHashBuf.length ||
        !crypto.timingSafeEqual(calculatedHashBuf, providedHashBuf)) {
      return { valid: false, error: 'Invalid signature: data check failed' };
    }

    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'Missing auth_date parameter' };
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(authDate) || (now - authDate) > maxAgeSeconds) {
      return { valid: false, error: 'Authentication data has expired' };
    }

    const userJson = params.get('user');
    let user = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson);
      } catch {
        return { valid: false, error: 'Invalid user JSON format' };
      }
    }

    if (!user || !user.id) {
      return { valid: false, error: 'User payload missing user.id' };
    }

    return {
      valid: true,
      user: {
        id: Number(user.id),
        username: user.username || null,
        firstName: user.first_name || 'Player',
        lastName: user.last_name || '',
        languageCode: user.language_code || 'uz',
        photoUrl: user.photo_url || null
      }
    };
  } catch (err) {
    return { valid: false, error: `Validation exception: ${err.message}` };
  }
}
