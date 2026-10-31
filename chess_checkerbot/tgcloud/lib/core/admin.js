/**
 * WellChess Admin Authorization for tgcloud
 * Authorized Telegram Admin IDs: 6472114736 and 8455692606
 */

export const AUTHORIZED_ADMIN_IDS = [6472114736, 8455692606];

export function isAdminUser(userId) {
  if (!userId) return false;
  const numId = Number(userId);
  return AUTHORIZED_ADMIN_IDS.includes(numId);
}
