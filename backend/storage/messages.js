import { db, desc, eq } from './index.js';
import { adminMessages } from '../../schema.js';

export async function saveAdminMessage({ senderId, senderName, username, topic, message }) {
  const row = {
    senderId: Number(senderId) || 0,
    senderName: String(senderName || 'O‘yinchi').trim(),
    username: String(username || '').replace(/^@/, '').trim(),
    topic: String(topic || 'Umumiy').trim(),
    message: String(message || '').trim(),
    createdAt: Math.floor(Date.now() / 1000),
    isRead: 0
  };

  try {
    await db.insert(adminMessages).values(row).run();
    return row;
  } catch (err) {
    console.error('[Storage saveAdminMessage Error]:', err.message);
    return row;
  }
}

export async function getAdminMessages(limit = 50) {
  try {
    const list = await db.select()
      .from(adminMessages)
      .orderBy(desc(adminMessages.createdAt))
      .limit(limit)
      .all();
    return list || [];
  } catch (err) {
    console.error('[Storage getAdminMessages Error]:', err.message);
    return [];
  }
}

export async function markAdminMessageRead(id) {
  try {
    await db.update(adminMessages)
      .set({ isRead: 1 })
      .where(eq(adminMessages.id, Number(id)))
      .run();
    return true;
  } catch (err) {
    return false;
  }
}
