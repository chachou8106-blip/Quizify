CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', plan_expires TEXT, license_key TEXT, bonus_ai INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'culture', emoji TEXT DEFAULT '🎯', difficulty TEXT DEFAULT 'medium', language TEXT DEFAULT 'fr', questions TEXT NOT NULL, share_code TEXT UNIQUE, plays INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_share ON quizzes(share_code);
CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL, month TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, month));
CREATE TABLE IF NOT EXISTS licenses (license_key TEXT PRIMARY KEY, product TEXT NOT NULL, email TEXT, activated_by TEXT, activated_at TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rewards (code TEXT PRIMARY KEY, pin TEXT, credits INTEGER NOT NULL DEFAULT 3, claimed_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
-- users.bonus_ai : crédits gagnés en remportant des parties (ALTER TABLE users ADD COLUMN bonus_ai INTEGER NOT NULL DEFAULT 0;)

-- Banque de questions mondiale : toutes les catégories, tous les types de jeu.
-- Chaque question a une empreinte (fp) calculée sur son texte normalisé : deux formulations
-- équivalentes donnent la même empreinte, donc un doublon ne peut pas entrer.
-- fp = empreinte du texte de la question ; ak = clé « sujet + bonne réponse »,
-- qui attrape les reformulations que le texte seul laisse passer.
CREATE TABLE IF NOT EXISTS question_bank (fp TEXT PRIMARY KEY, ak TEXT, category TEXT NOT NULL DEFAULT 'culture', topic_key TEXT NOT NULL, topic_label TEXT, type TEXT NOT NULL DEFAULT 'multipleChoice', difficulty TEXT NOT NULL DEFAULT 'medium', language TEXT NOT NULL DEFAULT 'fr', question TEXT NOT NULL, options TEXT NOT NULL, correct INTEGER NOT NULL, explanation TEXT, source_url TEXT, source_title TEXT, sourced INTEGER NOT NULL DEFAULT 0, served INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_bank_pick ON question_bank(topic_key, type, difficulty, language);
CREATE INDEX IF NOT EXISTS idx_bank_cat ON question_bank(category, created_at);
CREATE INDEX IF NOT EXISTS idx_bank_ak ON question_bank(ak);
-- Mémoire par joueur : garantit qu'un joueur ne revoit jamais la même question,
-- ni la même réponse sur un même sujet (donc pas de question reformulée).
CREATE TABLE IF NOT EXISTS question_seen (user_id TEXT NOT NULL, fp TEXT NOT NULL, seen_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, fp));
CREATE TABLE IF NOT EXISTS answer_seen (user_id TEXT NOT NULL, ak TEXT NOT NULL, seen_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, ak));
-- Idem pour les morceaux des blind tests.
CREATE TABLE IF NOT EXISTS track_seen (user_id TEXT NOT NULL, track_id TEXT NOT NULL, seen_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, track_id));

-- Banc d'essai exécuté en production (voir executerBanc dans src/index.js).
-- Permet d'éprouver une génération sur de vraies données depuis l'extérieur :
-- on dépose une tâche, la minuterie l'exécute, on relit le résultat.
CREATE TABLE IF NOT EXISTS banc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tache TEXT NOT NULL,
  params TEXT,
  etat TEXT NOT NULL DEFAULT 'attente',
  resultat TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
