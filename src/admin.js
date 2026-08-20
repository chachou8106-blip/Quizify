// ---------------------------------------------------------------------------
// Console d'administration — réservée au compte propriétaire.
//
// Règle de conduite de tout ce fichier : on n'affiche JAMAIS un chiffre inventé.
// Une intégration non connectée renvoie { connecte: false } et l'écran le dit
// franchement, plutôt que de montrer un zéro qui ressemble à une vraie mesure.
// ---------------------------------------------------------------------------

// Clés d'intégration rangées dans la table `settings`.
export const CREDENTIALS = [
  { key: 'gumroad_token', label: 'Gumroad — jeton d\'accès', help: 'gumroad.com → Settings → Advanced → Applications. Sert à lire les ventes.' },
  { key: 'youtube_api_key', label: 'YouTube — clé API', help: 'console.cloud.google.com → API YouTube Data v3 → Créer une clé.' },
  { key: 'youtube_channel_id', label: 'YouTube — identifiant de la chaîne', help: 'Commence par UC… Visible dans les paramètres avancés de la chaîne.' },
  { key: 'cloudflare_token', label: 'Cloudflare — jeton de lecture', help: 'Permission « Account Analytics: Read ». Sert au trafic et à la consommation.' },
  { key: 'cloudflare_account_id', label: 'Cloudflare — identifiant de compte', help: 'Visible dans l\'URL du tableau de bord Cloudflare.' },
  { key: 'github_token', label: 'GitHub — jeton', help: 'Jeton « fine-grained » limité au dépôt Quizify, permission Contents: lecture/écriture.' },
  { key: 'adsense_client', label: 'AdSense — identifiant éditeur', help: 'De la forme ca-pub-0000000000000000.' },
];

const SECRET_KEYS = new Set(['gumroad_token', 'youtube_api_key', 'cloudflare_token', 'github_token']);

export async function getSetting(env, key) {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return r?.value || null;
}

export async function setSetting(env, key, value) {
  if (value === null || value === '') {
    await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    return;
  }
  await env.DB.prepare(
    'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, String(value).trim()).run();
}

// On ne renvoie jamais un secret en clair vers le navigateur : juste sa présence
// et un aperçu de quelques caractères pour que Chachou reconnaisse la bonne clé.
export function maskValue(key, value) {
  if (!value) return null;
  if (!SECRET_KEYS.has(key)) return value;
  return value.length <= 8 ? '••••' : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

// --- Journal des erreurs ----------------------------------------------------
export async function logError(env, kind, message, detail = null, userId = null) {
  try {
    await env.DB.prepare(
      'INSERT INTO app_errors (kind, message, detail, user_id) VALUES (?,?,?,?)'
    ).bind(kind, String(message).slice(0, 400), detail ? String(detail).slice(0, 1200) : null, userId).run();
  } catch { /* un échec de journalisation ne doit jamais casser une requête */ }
}

// --- Vue d'ensemble ---------------------------------------------------------
export async function overview(env) {
  const one = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()) || {};
  const [users, quizzes, bank, plays, errors24, gen30] = await Promise.all([
    one('SELECT COUNT(*) AS n, SUM(CASE WHEN plan != \'free\' THEN 1 ELSE 0 END) AS payants FROM users'),
    one('SELECT COUNT(*) AS n FROM quizzes'),
    one('SELECT COUNT(*) AS n FROM question_bank'),
    one('SELECT COALESCE(SUM(plays),0) AS n FROM quizzes'),
    one("SELECT COUNT(*) AS n FROM app_errors WHERE created_at > datetime('now','-1 day')"),
    one("SELECT COALESCE(SUM(count),0) AS n FROM ai_usage WHERE month = strftime('%Y-%m','now')"),
  ]);
  const parCategorie = await env.DB.prepare(
    'SELECT category, COUNT(*) AS n FROM quizzes GROUP BY category ORDER BY n DESC LIMIT 30'
  ).all();
  const recents = await env.DB.prepare(
    `SELECT q.id, q.title, q.category, q.emoji, q.share_code, q.plays, q.created_at, u.name AS auteur, u.email
       FROM quizzes q LEFT JOIN users u ON u.id = q.user_id
      ORDER BY q.created_at DESC LIMIT 8`
  ).all();
  return {
    joueurs: users.n || 0,
    joueursPayants: users.payants || 0,
    quiz: quizzes.n || 0,
    banque: bank.n || 0,
    parties: plays.n || 0,
    erreurs24h: errors24.n || 0,
    generationsCeMois: gen30.n || 0,
    parCategorie: parCategorie.results || [],
    derniersQuiz: recents.results || [],
  };
}

// --- Tous les quiz de tous les joueurs --------------------------------------
export async function listQuizzes(env, { q = '', category = '', page = 0, perPage = 25 }) {
  const where = [];
  const args = [];
  if (q) { where.push('(q.title LIKE ? OR u.email LIKE ? OR u.name LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (category) { where.push('q.category = ?'); args.push(category); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM quizzes q LEFT JOIN users u ON u.id = q.user_id ${clause}`
  ).bind(...args).first();
  const rows = await env.DB.prepare(
    `SELECT q.id, q.title, q.category, q.emoji, q.difficulty, q.share_code, q.plays, q.created_at,
            q.user_id, u.name AS auteur, u.email,
            (SELECT COUNT(*) FROM json_each(q.questions)) AS nbQuestions
       FROM quizzes q LEFT JOIN users u ON u.id = q.user_id
       ${clause} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...args, perPage, page * perPage).all();
  return { total: total?.n || 0, page, perPage, quiz: rows.results || [] };
}

// --- Comptes et quotas ------------------------------------------------------
export async function listUsers(env) {
  const rows = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.plan, u.plan_expires, u.bonus_ai, u.is_admin, u.created_at,
            (SELECT COUNT(*) FROM quizzes WHERE user_id = u.id) AS quiz,
            (SELECT COALESCE(count,0) FROM ai_usage WHERE user_id = u.id AND month = strftime('%Y-%m','now')) AS generationsCeMois
       FROM users u ORDER BY u.created_at DESC LIMIT 500`
  ).all();
  return { joueurs: rows.results || [] };
}

// --- Banque de questions ----------------------------------------------------
export async function bankStats(env) {
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM question_bank').first();
  const parCategorie = await env.DB.prepare(
    `SELECT category, COUNT(*) AS n, SUM(sourced) AS avecSource FROM question_bank
      GROUP BY category ORDER BY n DESC`
  ).all();
  const parType = await env.DB.prepare(
    'SELECT type, COUNT(*) AS n FROM question_bank GROUP BY type ORDER BY n DESC'
  ).all();
  const topSujets = await env.DB.prepare(
    'SELECT topic_label, COUNT(*) AS n FROM question_bank GROUP BY topic_key ORDER BY n DESC LIMIT 15'
  ).all();
  const reutilisees = await env.DB.prepare(
    'SELECT COALESCE(SUM(served),0) AS n FROM question_bank'
  ).first();
  return {
    total: total?.n || 0,
    reutilisations: reutilisees?.n || 0,
    parCategorie: parCategorie.results || [],
    parType: parType.results || [],
    topSujets: topSujets.results || [],
  };
}

// --- Erreurs ----------------------------------------------------------------
export async function listErrors(env, limit = 60) {
  const rows = await env.DB.prepare(
    `SELECT e.id, e.kind, e.message, e.detail, e.created_at, u.email
       FROM app_errors e LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.id DESC LIMIT ?`
  ).bind(limit).all();
  const parType = await env.DB.prepare(
    "SELECT kind, COUNT(*) AS n FROM app_errors WHERE created_at > datetime('now','-7 day') GROUP BY kind ORDER BY n DESC"
  ).all();
  return { erreurs: rows.results || [], parType: parType.results || [] };
}

// --- Vidéos -----------------------------------------------------------------
export async function listVideos(env) {
  const rows = await env.DB.prepare(
    `SELECT v.*, q.title AS quizTitre FROM videos v LEFT JOIN quizzes q ON q.id = v.quiz_id
      ORDER BY v.created_at DESC LIMIT 200`
  ).all();
  return { videos: rows.results || [] };
}

// ---------------------------------------------------------------------------
// Intégrations externes. Chacune renvoie { connecte, ... } ou { connecte:false }.
// ---------------------------------------------------------------------------

export async function gumroadStats(env) {
  const token = await getSetting(env, 'gumroad_token');
  if (!token) return { connecte: false, quoiFaire: 'Colle ton jeton Gumroad dans Réglages pour voir les ventes ici.' };
  try {
    const r = await fetch(`https://api.gumroad.com/v2/sales?access_token=${encodeURIComponent(token)}`, {
      headers: { 'User-Agent': 'Quizzalo-admin' },
    });
    if (!r.ok) return { connecte: false, erreur: `Gumroad a répondu ${r.status}` };
    const d = await r.json();
    const sales = d.sales || [];
    const cents = sales.reduce((s, v) => s + (v.price || 0), 0);
    const parProduit = {};
    for (const s of sales) {
      const k = s.product_name || 'Sans nom';
      parProduit[k] = parProduit[k] || { ventes: 0, cents: 0 };
      parProduit[k].ventes += 1;
      parProduit[k].cents += s.price || 0;
    }
    const mois = new Date().toISOString().slice(0, 7);
    const ceMois = sales.filter((s) => String(s.created_at || '').startsWith(mois));
    return {
      connecte: true,
      ventes: sales.length,
      revenuTotal: (cents / 100).toFixed(2),
      ventesCeMois: ceMois.length,
      revenuCeMois: (ceMois.reduce((s, v) => s + (v.price || 0), 0) / 100).toFixed(2),
      parProduit: Object.entries(parProduit).map(([nom, v]) => ({ nom, ventes: v.ventes, revenu: (v.cents / 100).toFixed(2) })),
    };
  } catch (e) {
    return { connecte: false, erreur: e.message };
  }
}

export async function youtubeStats(env) {
  const [key, channel] = await Promise.all([
    getSetting(env, 'youtube_api_key'), getSetting(env, 'youtube_channel_id'),
  ]);
  if (!key || !channel) {
    return { connecte: false, quoiFaire: 'Il faut la clé API YouTube ET l\'identifiant de la chaîne dans Réglages.' };
  }
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${encodeURIComponent(channel)}&key=${encodeURIComponent(key)}`
    );
    if (!r.ok) return { connecte: false, erreur: `YouTube a répondu ${r.status}` };
    const d = await r.json();
    const item = (d.items || [])[0];
    if (!item) return { connecte: false, erreur: 'Chaîne introuvable — vérifie l\'identifiant.' };
    const s = item.statistics || {};
    return {
      connecte: true,
      chaine: item.snippet?.title || channel,
      vues: Number(s.viewCount || 0),
      abonnes: Number(s.subscriberCount || 0),
      videos: Number(s.videoCount || 0),
    };
  } catch (e) {
    return { connecte: false, erreur: e.message };
  }
}

export async function cloudflareStats(env) {
  const [token, account] = await Promise.all([
    getSetting(env, 'cloudflare_token'), getSetting(env, 'cloudflare_account_id'),
  ]);
  if (!token || !account) {
    return { connecte: false, quoiFaire: 'Jeton Cloudflare avec la permission « Account Analytics: Read » + identifiant de compte.' };
  }
  // Requêtes du Worker sur les 7 derniers jours.
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const query = `query($account: String!, $since: Time!) {
    viewer { accounts(filter: {accountTag: $account}) {
      workersInvocationsAdaptive(limit: 100, filter: {datetime_geq: $since}) {
        sum { requests errors subrequests }
        dimensions { scriptName }
      } } } }`;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { account, since } }),
    });
    const d = await r.json();
    if (!r.ok || d.errors) return { connecte: false, erreur: d.errors?.[0]?.message || `Cloudflare a répondu ${r.status}` };
    const rows = d.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
    const tot = rows.reduce((a, x) => ({
      requetes: a.requetes + (x.sum?.requests || 0),
      erreurs: a.erreurs + (x.sum?.errors || 0),
    }), { requetes: 0, erreurs: 0 });
    return { connecte: true, periode: '7 derniers jours', ...tot, parWorker: rows.map((x) => ({ nom: x.dimensions?.scriptName, requetes: x.sum?.requests || 0 })) };
  } catch (e) {
    return { connecte: false, erreur: e.message };
  }
}

export async function githubStats(env) {
  const token = await getSetting(env, 'github_token');
  const repo = 'chachou8106-blip/Quizify';
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Quizzalo-admin' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=8`, { headers });
    if (!r.ok) {
      return { connecte: false, erreur: r.status === 404 ? 'Dépôt privé : ajoute un jeton GitHub dans Réglages.' : `GitHub a répondu ${r.status}` };
    }
    const commits = await r.json();
    return {
      connecte: true,
      depot: repo,
      avecJeton: !!token,
      commits: (commits || []).map((c) => ({
        sha: c.sha.slice(0, 8),
        message: (c.commit?.message || '').split('\n')[0],
        date: c.commit?.author?.date,
        auteur: c.commit?.author?.name,
      })),
    };
  } catch (e) {
    return { connecte: false, erreur: e.message };
  }
}
