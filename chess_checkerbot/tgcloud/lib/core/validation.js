/**
 * Game validation constants and time control parsing for tgcloud
 */

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
