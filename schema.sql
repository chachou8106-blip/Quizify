CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', plan_expires TEXT, license_key TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'culture', emoji TEXT DEFAULT '🎯', difficulty TEXT DEFAULT 'medium', language TEXT DEFAULT 'fr', questions TEXT NOT NULL, share_code TEXT UNIQUE, plays INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_share ON quizzes(share_code);
CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL, month TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, month));
CREATE TABLE IF NOT EXISTS licenses (license_key TEXT PRIMARY KEY, product TEXT NOT NULL, email TEXT, activated_by TEXT, activated_at TEXT);
