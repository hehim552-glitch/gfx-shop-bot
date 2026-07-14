import db from './database';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReferralRow {
  client_id: string;
  referrer_id: string;
  credited: number; // 0 = not yet credited, 1 = point awarded
}

export interface ReferralProfile {
  user_id: string;
  points: number;
  claimed_reward: string | null;
  reward_claimed_at: string | null;
}

export const REWARD_LABELS: Record<string, string> = {
  free_icon: '🎁 REWARD CLAIMED: Free Icon with Next Thumbnail',
  discount_25: '🎁 REWARD CLAIMED: 25% Off Total Order',
};

// ── Referral helpers ───────────────────────────────────────────────────────────

/**
 * Log that `client_id` was referred by `referrer_id`.
 * Returns 'ok' on success, 'self' if they tried to refer themselves,
 * or 'duplicate' if this client already has a referral logged.
 */
export function logReferral(
  client_id: string,
  referrer_id: string,
): 'ok' | 'self' | 'duplicate' {
  if (client_id === referrer_id) return 'self';
  const existing = db
    .prepare('SELECT client_id FROM referrals WHERE client_id = ?')
    .get(client_id);
  if (existing) return 'duplicate';
  db.prepare(
    'INSERT INTO referrals (client_id, referrer_id, credited) VALUES (?, ?, 0)',
  ).run(client_id, referrer_id);
  return 'ok';
}

/** Get the referral record for a client, or null if none exists. */
export function getReferral(client_id: string): ReferralRow | null {
  return (
    (db
      .prepare('SELECT client_id, referrer_id, credited FROM referrals WHERE client_id = ?')
      .get(client_id) as ReferralRow | undefined) ?? null
  );
}

/** Mark a referral as credited so the point isn't awarded twice. */
export function markReferralCredited(client_id: string): void {
  db.prepare('UPDATE referrals SET credited = 1 WHERE client_id = ?').run(client_id);
}

// ── Profile helpers ────────────────────────────────────────────────────────────

function ensureProfile(user_id: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO referral_profiles (user_id, points) VALUES (?, 0)',
  ).run(user_id);
}

/**
 * Add 1 referral point to a user's profile.
 * Returns the new point total.
 */
export function incrementPoints(user_id: string): number {
  ensureProfile(user_id);
  db.prepare('UPDATE referral_profiles SET points = points + 1 WHERE user_id = ?').run(user_id);
  const row = db
    .prepare('SELECT points FROM referral_profiles WHERE user_id = ?')
    .get(user_id) as { points: number };
  return row.points;
}

/** Get a user's referral profile, or null if none exists. */
export function getProfile(user_id: string): ReferralProfile | null {
  return (
    (db
      .prepare('SELECT * FROM referral_profiles WHERE user_id = ?')
      .get(user_id) as ReferralProfile | undefined) ?? null
  );
}

/** Save the reward choice a user made (e.g. 'free_icon' | 'discount_25'). */
export function setClaimedReward(user_id: string, reward: string): void {
  ensureProfile(user_id);
  db.prepare(
    `UPDATE referral_profiles
     SET claimed_reward = ?, reward_claimed_at = datetime('now')
     WHERE user_id = ?`,
  ).run(reward, user_id);
}

/** Clear the claimed reward once the order using it is completed. */
export function clearClaimedReward(user_id: string): void {
  db.prepare(
    'UPDATE referral_profiles SET claimed_reward = NULL, reward_claimed_at = NULL WHERE user_id = ?',
  ).run(user_id);
}

/** Get a formatted reward label for display, or null if none. */
export function getRewardLabel(user_id: string): string | null {
  const profile = getProfile(user_id);
  if (!profile?.claimed_reward) return null;
  return REWARD_LABELS[profile.claimed_reward] ?? null;
}
