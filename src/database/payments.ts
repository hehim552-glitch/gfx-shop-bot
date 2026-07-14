import db from './database';

export interface PaymentRecord {
  id: number;
  guild_id: string;
  user_id: string;
  amount: number;
  method: string;
  paid_at: string;
}

export function recordPayment(guild_id: string, user_id: string, amount: number, method: string): void {
  db.prepare(
    'INSERT INTO payments (guild_id, user_id, amount, method) VALUES (?, ?, ?, ?)',
  ).run(guild_id, user_id, amount, method);
}

export function getEarningsByMethod(guild_id: string): { method: string; total: number; count: number }[] {
  return db
    .prepare(
      `SELECT method, SUM(amount) as total, COUNT(*) as count
       FROM payments WHERE guild_id = ? GROUP BY method ORDER BY total DESC`,
    )
    .all(guild_id) as { method: string; total: number; count: number }[];
}

export function getTotalEarnings(guild_id: string): number {
  const row = db
    .prepare('SELECT SUM(amount) as total FROM payments WHERE guild_id = ?')
    .get(guild_id) as { total: number | null };
  return row?.total ?? 0;
}

export function getTotalTransactionCount(guild_id: string): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM payments WHERE guild_id = ?')
    .get(guild_id) as { count: number };
  return row?.count ?? 0;
}
