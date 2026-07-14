import db from './database';

export interface QueueEntry {
  id: number;
  user_id: string;
  details: string;
  status: 'waiting' | 'in_progress';
  position: number;
  added_at: string;
}

/** Returns false if the user is already in the queue (any status). */
export function addToQueue(user_id: string, details: string): boolean {
  const existing = db
    .prepare('SELECT id FROM queue WHERE user_id = ?')
    .get(user_id);
  if (existing) return false;

  const row = db
    .prepare('SELECT MAX(position) as max_pos FROM queue')
    .get() as { max_pos: number | null };
  const nextPos = (row?.max_pos ?? 0) + 1;
  db.prepare(
    'INSERT INTO queue (user_id, details, status, position) VALUES (?, ?, ?, ?)',
  ).run(user_id, details, 'waiting', nextPos);
  return true;
}

export function startQueue(user_id: string): boolean {
  const result = db
    .prepare(
      "UPDATE queue SET status = 'in_progress' WHERE user_id = ? AND status = 'waiting'",
    )
    .run(user_id);
  return result.changes > 0;
}

export function completeQueue(user_id: string): boolean {
  const result = db.prepare('DELETE FROM queue WHERE user_id = ?').run(user_id);
  return result.changes > 0;
}

export function getQueue(): QueueEntry[] {
  return db
    .prepare(
      "SELECT * FROM queue ORDER BY CASE status WHEN 'waiting' THEN 0 ELSE 1 END ASC, position ASC",
    )
    .all() as QueueEntry[];
}

export function getQueueMessage(
  guild_id: string,
): { channel_id: string; message_id: string } | null {
  return (
    (db
      .prepare('SELECT channel_id, message_id FROM queue_message WHERE guild_id = ?')
      .get(guild_id) as { channel_id: string; message_id: string } | undefined) ?? null
  );
}

export function setQueueMessage(
  guild_id: string,
  channel_id: string,
  message_id: string,
): void {
  db.prepare(
    'INSERT OR REPLACE INTO queue_message (guild_id, channel_id, message_id) VALUES (?, ?, ?)',
  ).run(guild_id, channel_id, message_id);
}
