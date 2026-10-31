import crypto from 'node:crypto';

export const SUPPORTED_GAME_TYPES = ['chess', 'checkers'];

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

/**
 * Validate and parse Telegram WebApp initData string
 * @param {string} initData Raw initData query string from Telegram.WebApp.initData
 * @param {string} botToken Telegram Bot API token
 * @param {number} [maxAgeSeconds=86400] Maximum age in seconds (default 24h)
 * @returns {{ valid: boolean, user?: Object, error?: string }}
 */
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

    // Sort parameters alphabetically by key
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys
      .map(key => `${key}=${params.get(key)}`)
      .join('\n');

    // Telegram HMAC key generation: HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate HMAC of dataCheckString using secretKey
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

    // Check expiration timestamp
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'Missing auth_date parameter' };
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(authDate) || (now - authDate) > maxAgeSeconds) {
      return { valid: false, error: 'Authentication data has expired' };
    }

    // Parse verified user object
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
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        languageCode: user.language_code || 'en',
        isPremium: Boolean(user.is_premium),
        photoUrl: user.photo_url || null
      },
      authDate,
      queryId: params.get('query_id') || null
    };
  } catch (err) {
    return { valid: false, error: `Validation exception: ${err.message}` };
  }
}

/**
 * Validate game type
 * @param {string} gameType
 * @returns {boolean}
 */
export function isValidGameType(gameType) {
  return SUPPORTED_GAME_TYPES.includes(gameType);
}

/**
 * Validate time control
 * @param {string} timeControl
 * @returns {boolean}
 */
export function isValidTimeControl(timeControl) {
  return Boolean(SUPPORTED_TIME_CONTROLS[timeControl]);
}

/**
 * Helper to parse time control string into milliseconds
 * @param {string} timeControl e.g. "3+2"
 * @returns {{ baseMs: number, incrementMs: number }}
 */
export function parseTimeControl(timeControl) {
  const config = SUPPORTED_TIME_CONTROLS[timeControl];
  if (!config) {
    throw new Error(`Unsupported time control: ${timeControl}`);
  }
  return {
    baseMs: config.baseSeconds * 1000,
    incrementMs: config.incrementSeconds * 1000
  };
}
