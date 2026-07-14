import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Define the database file path
const dbFilePath = path.resolve('database.db');

// Check if the database file exists, if not create it
if (!fs.existsSync(dbFilePath)) {
  console.log('Database not found, creating new database...');
}

// Initialize the SQLite database
const db = new Database(dbFilePath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS vouches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    rating INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    payment TEXT NOT NULL DEFAULT 'Unknown'
  )
`);

// Queue table
db.exec(`
  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    position INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Stores the single queue embed message per guild so we can always edit it
db.exec(`
  CREATE TABLE IF NOT EXISTS queue_message (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  )
`);

// Payment / revenue tracking
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    paid_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Studio status banner message tracker
db.exec(`
  CREATE TABLE IF NOT EXISTS status_message (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  )
`);

// Referral program — who referred whom (one referral per client)
db.exec(`
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    referrer_id TEXT NOT NULL,
    credited INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Referral program — per-user point totals and claimed rewards
db.exec(`
  CREATE TABLE IF NOT EXISTS referral_profiles (
    user_id TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0,
    claimed_reward TEXT,
    reward_claimed_at TEXT
  )
`);

// Migrate: add guild_id to payments if missing (older schema without it)
const paymentCols = db.pragma('table_info(payments)') as { name: string }[];
if (!paymentCols.some((col) => col.name === 'guild_id')) {
  db.exec(`ALTER TABLE payments ADD COLUMN guild_id TEXT NOT NULL DEFAULT 'unknown'`);
  console.log('Migration: added guild_id column to payments table');
}

// Migrate queue_message table: rebuild if it uses the old schema (id PK instead of guild_id)
const queueMessageCols = db.pragma('table_info(queue_message)') as { name: string }[];
if (!queueMessageCols.some((col) => col.name === 'guild_id')) {
  db.exec(`DROP TABLE IF EXISTS queue_message`);
  db.exec(`
    CREATE TABLE queue_message (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL
    )
  `);
  console.log('Migration: rebuilt queue_message table with guild_id schema');
}

// Migrate existing databases: add payment column if missing
const columns = db.pragma('table_info(vouches)') as { name: string }[];
if (!columns.some((col) => col.name === 'payment')) {
  db.exec(`ALTER TABLE vouches ADD COLUMN payment TEXT NOT NULL DEFAULT 'Unknown'`);
  console.log('Migration: added payment column to vouches table');
}

export default db;
