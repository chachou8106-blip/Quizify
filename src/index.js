// Quizzalo — Cloudflare Worker API + static SPA + Durable Object live games.

import { Hono } from 'hono';
import { hashPassword, randomHex, signJWT, requireAuth } from './auth';
import { generateQuestions, generateMathQuestions, generateAnagramQuestions, CATEGORIES } from './ai';
import { activateLicense, reverifyAll } from './gumroad';
export { GameRoom } from './GameRoom';

const app = new Hono();

// Session secret: env var if set, else stored in D1 (auto-generated on first run).
let cachedSecret = null;
async function getSecret(env) {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'AUTH_SECRET'").first();
    if (row?.value) { cachedSecret = row.value; return cachedSecret; }
  } catch { /* table may not exist yet */ }
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
    await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('AUTH_SECRET', ?)").bind(randomHex(32)).run();
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'AUTH_SECRET'").first();
    cachedSecret = row?.value || null;
    if (cachedSecret) return cachedSecret;
  } catch { /* fall through */ }
  return 'dev-secret-change-me';
}
const secret = (c) => getSecret(c.env);
const auth = requireAuth(secret);

const FREE_AI_PER_MONTH = 3;
const FREE_MAX_PLAYERS = 10;
const PAID_MAX_PLAYERS = 100;

// ---------- helpers ----------

async function getPlan(c, userId) {
  const u = await c.env.DB.prepare('SELECT plan, plan_expires FROM users WHERE id = ?').bind(userId).first();
  if (!u) return 'free';
  if (u.plan === 'premium') return 'premium';
  if (u.plan === 'event' && u.plan_expires && new Date(u.plan_expires) > new Date()) return 'event';
  return 'free';
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shareCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  for (const b of a) s += chars[b % chars.length];
  return s;
}

function gamePin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}

// ---------- auth ----------

app.post('/api/auth/signup', async (c) => {
  const { email, password, name } = await c.req.json().catch(() => ({}));
  if (!email || !password || !name) return c.json({ error: 'Tous les champs sont requis' }, 400);
  if (password.length < 8) return c.json({ error: 'Mot de passe : 8 caractères minimum' }, 400);
  const em = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return c.json({ error: 'Email invalide' }, 400);
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(em).first();
  if (existing) return c.json({ error: 'Un compte existe déjà avec cet email' }, 409);
  const id = randomHex(12);
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  await c.env.DB.prepare('INSERT INTO users (id, email, name, pass_hash, salt) VALUES (?,?,?,?,?)')
    .bind(id, em, String(name).trim().slice(0, 40), hash, salt).run();
  const token = await signJWT({ id, email: em, name: String(name).trim().slice(0, 40) }, await secret(c));
  return c.json({ token, user: { id, email: em, name, plan: 'free' } }, 201);
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400);
  const em = String(email).trim().toLowerCase();
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(em).first();
  if (!u) return c.json({ error: 'Email ou mot de passe incorrect' }, 401);
  const hash = await hashPassword(password, u.salt);
  if (hash !== u.pass_hash) return c.json({ error: 'Email ou mot de passe incorrect' }, 401);
  const token = await signJWT({ id: u.id, email: u.email, name: u.name }, await secret(c));
  const plan = await getPlan(c, u.id);
  return c.json({ token, user: { id: u.id, email: u.email, name: u.name, plan } });
});

app.get('/api/auth/me', auth, async (c) => {
  const user = c.get('user');
  const u = await c.env.DB.prepare('SELECT id, email, name, plan, plan_expires, bonus_ai FROM users WHERE id = ?').bind(user.id).first();
  if (!u) return c.json({ error: 'Compte introuvable' }, 404);
  const plan = await getPlan(c, u.id);
  const usage = await c.env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND month = ?')
    .bind(u.id, monthKey()).first();
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, plan, plan_expires: u.plan_expires },
    aiUsed: usage?.count || 0,
    aiQuota: plan === 'free' ? FREE_AI_PER_MONTH : null,
    aiBonus: u.bonus_ai || 0,
  });
});

// ---------- AI generation ----------

app.get('/api/categories', (c) => c.json({ categories: CATEGORIES }));

app.post('/api/ai/generate', auth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { topic, category = 'culture', type = 'multipleChoice', count = 5, difficulty = 'medium', language = 'fr', personalFacts } = body;
  if (!topic && !personalFacts) return c.json({ error: 'Indique un sujet ou des anecdotes' }, 400);

  // Calcul mental : généré par du code (réponses garanties justes), gratuit et illimité.
  if (type === 'math') {
    const questions = generateMathQuestions({
      count: Math.min(Math.max(parseInt(count) || 8, 1), 20),
      difficulty,
    });
    return c.json({ questions });
  }

  const plan = await getPlan(c, user.id);
  let useBonus = false;
  if (plan === 'free') {
    const usage = await c.env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND month = ?')
      .bind(user.id, monthKey()).first();
    if ((usage?.count || 0) >= FREE_AI_PER_MONTH) {
      // Crédits bonus gagnés en remportant des parties
      const u = await c.env.DB.prepare('SELECT bonus_ai FROM users WHERE id = ?').bind(user.id).first();
      if ((u?.bonus_ai || 0) > 0) {
        useBonus = true;
      } else {
        return c.json({ error: 'quota', message: `Tu as utilisé tes ${FREE_AI_PER_MONTH} générations gratuites du mois. Passe en Premium pour générer sans limite !` }, 402);
      }
    }
  }

  let questions;
  try {
    const total = Math.min(Math.max(parseInt(count) || 5, 1), 40);
    const baseOpts = {
      topic: String(topic || '').slice(0, 2000),
      category, type, difficulty, language,
      personalFacts: personalFacts ? String(personalFacts).slice(0, 4000) : null,
    };
    if (type === 'anagram') {
      // L'IA choisit les mots, le code mélange et vérifie → réponses garanties.
      questions = await generateAnagramQuestions(c.env, { topic: baseOpts.topic, count: total, language });
      if (questions.length === 0) throw new Error('impossible de construire les anagrammes');
    } else if (total <= 12) {
      questions = await generateQuestions(c.env, { ...baseOpts, count: total });
    } else {
      // Gros quiz : génération par lots parallèles de 10 (fiable), puis fusion + dédoublonnage.
      const chunks = [];
      for (let left = total; left > 0; left -= 10) chunks.push(Math.min(10, left));
      const batches = await Promise.all(chunks.map((n, i) =>
        generateQuestions(c.env, { ...baseOpts, count: n, topic: `${baseOpts.topic}\n(Lot ${i + 1} — propose des questions sur des aspects différents des autres lots.)` })
          .catch(() => [])
      ));
      const seen = new Set();
      questions = batches.flat().filter((q) => {
        const k = q.question.toLowerCase().replace(/\W+/g, ' ').trim();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, total);
      if (questions.length < Math.min(8, total)) throw new Error('pas assez de questions valides');
    }
  } catch (e) {
    return c.json({ error: 'ai_failed', message: `La génération a échoué (${e.message}). Réessaie dans quelques secondes !` }, 502);
  }

  if (useBonus) {
    await c.env.DB.prepare('UPDATE users SET bonus_ai = MAX(0, bonus_ai - 1) WHERE id = ?').bind(user.id).run();
  } else {
    await c.env.DB.prepare(
      'INSERT INTO ai_usage (user_id, month, count) VALUES (?,?,1) ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1'
    ).bind(user.id, monthKey()).run();
  }

  return c.json({ questions });
});

// ---------- Blind Test musical (vrais extraits 30s via l'API publique iTunes, sans quota IA) ----------

function cleanTitle(s) {
  return String(s).replace(/\s*\(.*?(remaster|version|edit|mix|live|radio).*?\)/gi, '').trim();
}

async function deezerJson(path) {
  const res = await fetch(`https://api.deezer.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Quizzalo)' } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

function mapDeezerTracks(list) {
  return (list || [])
    .filter((t) => t.preview && t.title && t.artist?.name)
    .map((t) => ({
      title: cleanTitle(t.title),
      artist: t.artist.name,
      // Deezer preview URLs expire after a few minutes — store a proxy path
      // that resolves a fresh URL at play time instead.
      preview: `/api/music/preview/dz/${t.id}`,
      art: t.album?.cover_medium || '',
    }));
}

async function fetchTracksDeezer(term, limit = 25) {
  const data = await deezerJson(`/search?q=${encodeURIComponent(term)}&limit=${limit}`);
  return { status: data ? 200 : 500, tracks: mapDeezerTracks(data?.data) };
}

const normTxt = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// « Hits du moment » = playlist officielle « Top France » (le vrai classement français),
// avec le chart mondial Deezer en secours. Jamais de recherche textuelle.
async function fetchChartTracks(limit = 60) {
  const search = await deezerJson(`/search/playlist?q=${encodeURIComponent('Top France')}&limit=10`);
  const top = (search?.data || [])
    .filter((p) => /top\s*france/i.test(p.title || '') && (p.nb_tracks || 0) >= 40)
    .sort((a, b) => (b.fans || b.nb_tracks || 0) - (a.fans || a.nb_tracks || 0))[0];
  if (top) {
    const tr = await deezerJson(`/playlist/${top.id}/tracks?limit=${Math.min(limit, 100)}`);
    const tracks = mapDeezerTracks(tr?.data);
    if (tracks.length >= 10) return tracks;
  }
  const data = await deezerJson(`/chart/0/tracks?limit=${limit}`);
  return mapDeezerTracks(data?.data);
}

// Thème d'ambiance = morceaux des playlists les PLUS POPULAIRES correspondant au thème.
async function fetchThemeTracks(term, limit = 60) {
  if (/\bhits? du moment\b|\btop 50\b|\btendance/.test(normTxt(term))) return fetchChartTracks(limit);
  const search = await deezerJson(`/search/playlist?q=${encodeURIComponent(term)}&limit=10`);
  const playlists = (search?.data || [])
    .filter((p) => (p.nb_tracks || 0) >= 15)
    .sort((a, b) => (b.fans || b.nb_tracks || 0) - (a.fans || a.nb_tracks || 0))
    .slice(0, 2);
  const out = [];
  for (const p of playlists) {
    const tr = await deezerJson(`/playlist/${p.id}/tracks?limit=${Math.min(limit, 100)}`);
    out.push(...mapDeezerTracks(tr?.data));
    if (out.length >= limit) break;
  }
  // Filet de sécurité si aucune playlist pertinente
  if (out.length < 8) {
    const s = await fetchTracksDeezer(term, 25);
    out.push(...s.tracks);
  }
  return out;
}

// Resolve a fresh Deezer preview URL at play time (stored URLs never expire).
async function deezerPreviewUrl(id) {
  const res = await fetch(`https://api.deezer.com/track/${encodeURIComponent(id)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Quizzalo)' },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.preview || null;
}

async function fetchTracksItunes(term, limit = 25) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=FR&limit=${limit}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Quizzalo)' } });
  if (!res.ok) return { status: res.status, tracks: [] };
  const data = await res.json().catch(() => ({}));
  const tracks = (data.results || [])
    .filter((t) => t.previewUrl && t.trackName && t.artistName)
    .map((t) => ({
      title: cleanTitle(t.trackName),
      artist: t.artistName,
      preview: t.previewUrl,
      art: (t.artworkUrl100 || '').replace('100x100', '300x300'),
    }));
  return { status: res.status, tracks };
}

async function fetchTracks(term, limit = 25) {
  const deezer = await fetchTracksDeezer(term, limit);
  if (deezer.tracks.length >= 4) return deezer.tracks;
  const itunes = await fetchTracksItunes(term, limit);
  return [...deezer.tracks, ...itunes.tracks];
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.get('/api/music/preview/dz/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^\d+$/.test(id)) return c.json({ error: 'invalid id' }, 400);
  const url = await deezerPreviewUrl(id);
  if (!url) return c.json({ error: 'Extrait indisponible' }, 404);
  return c.redirect(url, 302);
});

// Diagnostic sources musicales (protégé)
app.get('/api/music/debug', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const term = c.req.query('q') || 'queen';
  const [deezer, itunes] = await Promise.all([fetchTracksDeezer(term, 5), fetchTracksItunes(term, 5)]);
  return c.json({
    deezer: { status: deezer.status, count: deezer.tracks.length, sample: deezer.tracks[0] || null },
    itunes: { status: itunes.status, count: itunes.tracks.length, sample: itunes.tracks[0]?.title || null },
  });
});

app.get('/api/music/blindtest', async (c) => {
  const q = (c.req.query('q') || '').trim();               // rétro-compatibilité
  const themesParam = (c.req.query('themes') || '').trim(); // ambiances → playlists populaires / charts
  const artistsParam = (c.req.query('artists') || '').trim(); // artistes précis → recherche directe
  const count = Math.min(Math.max(parseInt(c.req.query('count')) || 8, 3), 50);
  if (!q && !themesParam && !artistsParam) return c.json({ error: 'Indique au moins un artiste, genre ou thème' }, 400);

  const split = (s) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 10);
  const themes = split(themesParam || (artistsParam ? '' : q));
  const artists = split(artistsParam);
  const perTheme = Math.min(100, Math.max(20, Math.ceil((count * 4) / Math.max(1, themes.length + artists.length))));
  const pools = await Promise.all([
    ...themes.map((t) => fetchThemeTracks(t, perTheme)),
    ...artists.map((a) => fetchTracksDeezer(a, Math.min(perTheme, 25)).then((r) => r.tracks)),
  ]);

  // Dedupe by title+artist
  const seen = new Set();
  const pool = [];
  for (const track of shuffle(pools.flat())) {
    const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(track);
  }
  if (pool.length < 4) {
    return c.json({ error: 'Pas assez de morceaux trouvés pour ce thème — essaie d\'autres artistes ou genres.' }, 404);
  }

  const answers = pool.slice(0, Math.min(count, pool.length));
  const questions = answers.map((track) => {
    const label = (t) => `${t.title} — ${t.artist}`;
    const distractors = shuffle(pool.filter((t) => t !== track)).slice(0, 3);
    const options = shuffle([track, ...distractors]).map(label);
    return {
      question: '🎵 Quel est ce morceau ?',
      options,
      correct: options.indexOf(label(track)),
      explanation: `C'était « ${track.title} » de ${track.artist}.`,
      audioUrl: track.preview,
      artwork: track.art,
    };
  });
  return c.json({ questions });
});

// ---------- quizzes ----------

app.post('/api/quizzes', auth, async (c) => {
  const user = c.get('user');
  const { title, category = 'culture', difficulty = 'medium', language = 'fr', questions } = await c.req.json().catch(() => ({}));
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return c.json({ error: 'Titre et questions requis' }, 400);
  }
  const id = randomHex(10);
  const code = shareCode();
  const emoji = CATEGORIES[category]?.emoji || '🎯';
  await c.env.DB.prepare(
    'INSERT INTO quizzes (id, user_id, title, category, emoji, difficulty, language, questions, share_code) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, user.id, String(title).slice(0, 100), category, emoji, difficulty, language, JSON.stringify(questions), code).run();
  return c.json({ quiz: { id, title, category, emoji, share_code: code, questions } }, 201);
});

app.get('/api/quizzes', auth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, category, emoji, difficulty, share_code, plays, created_at, questions FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();
  return c.json({
    quizzes: (results || []).map((q) => ({ ...q, questionCount: JSON.parse(q.questions).length, questions: undefined })),
  });
});

app.get('/api/quizzes/:id', auth, async (c) => {
  const user = c.get('user');
  const q = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), user.id).first();
  if (!q) return c.json({ error: 'Quiz introuvable' }, 404);
  return c.json({ quiz: { ...q, questions: JSON.parse(q.questions) } });
});

app.delete('/api/quizzes/:id', auth, async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  return c.json({ ok: true });
});

// Public shared quiz (play by link) — answers included client-side for solo play.
app.get('/api/shared/:code', async (c) => {
  const q = await c.env.DB.prepare('SELECT id, title, category, emoji, difficulty, questions FROM quizzes WHERE share_code = ?')
    .bind(c.req.param('code')).first();
  if (!q) return c.json({ error: 'Quiz introuvable' }, 404);
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE quizzes SET plays = plays + 1 WHERE id = ?').bind(q.id).run()
  );
  return c.json({ quiz: { ...q, questions: JSON.parse(q.questions) } });
});

// ---------- live game rooms ----------

app.post('/api/rooms', auth, async (c) => {
  const user = c.get('user');
  const { quizId, questions, title } = await c.req.json().catch(() => ({}));
  let quiz;
  if (quizId) {
    const q = await c.env.DB.prepare('SELECT title, questions FROM quizzes WHERE id = ? AND user_id = ?')
      .bind(quizId, user.id).first();
    if (!q) return c.json({ error: 'Quiz introuvable' }, 404);
    quiz = { title: q.title, questions: JSON.parse(q.questions) };
  } else if (Array.isArray(questions) && questions.length > 0) {
    quiz = { title: String(title || 'Quiz').slice(0, 100), questions };
  } else {
    return c.json({ error: 'quizId ou questions requis' }, 400);
  }

  const plan = await getPlan(c, user.id);
  const maxPlayers = plan === 'free' ? FREE_MAX_PLAYERS : PAID_MAX_PLAYERS;
  const hostKey = randomHex(16);

  // Find a free PIN (avoid collision with an active room)
  let pin;
  for (let i = 0; i < 5; i++) {
    pin = gamePin();
    const stub = c.env.GAME.get(c.env.GAME.idFromName(`room:${pin}`));
    const st = await stub.fetch('https://do/status').then((r) => r.json());
    if (!st.exists || st.phase === 'podium') break;
  }
  // Récompense du vainqueur : 3 générations IA offertes, réclamées en créant un compte.
  const rewardCode = shareCode();
  await c.env.DB.prepare('INSERT INTO rewards (code, pin, credits) VALUES (?, ?, 3)')
    .bind(rewardCode, pin).run().catch(() => {});

  const stub = c.env.GAME.get(c.env.GAME.idFromName(`room:${pin}`));
  await stub.fetch('https://do/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz, hostKey, maxPlayers, rewardCode }),
  });
  return c.json({ pin, hostKey, maxPlayers, title: quiz.title, questionCount: quiz.questions.length });
});

app.get('/api/rooms/:pin', async (c) => {
  const pin = c.req.param('pin');
  if (!/^\d{6}$/.test(pin)) return c.json({ exists: false });
  const stub = c.env.GAME.get(c.env.GAME.idFromName(`room:${pin}`));
  const st = await stub.fetch('https://do/status').then((r) => r.json());
  return c.json(st);
});

// WebSocket upgrade — forwarded to the room's Durable Object.
app.get('/api/rooms/:pin/ws', async (c) => {
  const pin = c.req.param('pin');
  if (!/^\d{6}$/.test(pin)) return c.text('PIN invalide', 400);
  const stub = c.env.GAME.get(c.env.GAME.idFromName(`room:${pin}`));
  return stub.fetch(c.req.raw);
});

// ---------- billing ----------

app.post('/api/billing/activate', auth, async (c) => {
  const user = c.get('user');
  const { licenseKey } = await c.req.json().catch(() => ({}));
  if (!licenseKey) return c.json({ error: 'Clé de licence requise' }, 400);
  const key = String(licenseKey).trim();
  // A license can only be used by one account
  const taken = await c.env.DB.prepare('SELECT id FROM users WHERE license_key = ? AND id != ?').bind(key, user.id).first();
  if (taken) return c.json({ error: 'Cette clé est déjà utilisée par un autre compte' }, 409);
  const result = await activateLicense(c.env, key);
  if (!result) return c.json({ error: 'Clé invalide ou abonnement terminé' }, 400);
  await c.env.DB.prepare('UPDATE users SET plan = ?, plan_expires = ?, license_key = ? WHERE id = ?')
    .bind(result.plan, result.expires, key, user.id).run();
  return c.json({ ok: true, plan: result.plan, expires: result.expires });
});

// Gumroad ping webhook (form-encoded). Handles refunds/cancellations by email.
app.post('/api/billing/webhook', async (c) => {
  const form = await c.req.parseBody().catch(() => ({}));
  const email = String(form.email || '').toLowerCase();
  const refunded = form.refunded === 'true';
  if (email && refunded) {
    await c.env.DB.prepare("UPDATE users SET plan = 'free', plan_expires = NULL WHERE email = ?").bind(email).run();
  }
  return c.json({ ok: true });
});

// ---------- récompenses (le vainqueur d'une partie gagne 3 quiz IA) ----------

app.post('/api/rewards/claim', auth, async (c) => {
  const user = c.get('user');
  const { code } = await c.req.json().catch(() => ({}));
  if (!code) return c.json({ error: 'Code requis' }, 400);
  const r = await c.env.DB.prepare('SELECT * FROM rewards WHERE code = ?').bind(String(code).trim().toLowerCase()).first();
  if (!r) return c.json({ error: 'Code invalide' }, 404);
  if (r.claimed_by) return c.json({ error: 'Ce code a déjà été utilisé' }, 409);
  await c.env.DB.prepare('UPDATE rewards SET claimed_by = ? WHERE code = ?').bind(user.id, r.code).run();
  await c.env.DB.prepare('UPDATE users SET bonus_ai = bonus_ai + ? WHERE id = ?').bind(r.credits, user.id).run();
  const u = await c.env.DB.prepare('SELECT bonus_ai FROM users WHERE id = ?').bind(user.id).first();
  return c.json({ ok: true, credits: r.credits, bonus: u?.bonus_ai || r.credits });
});

// Config publique : liens d'achat + AdSense. Remplie via les [vars] de wrangler.toml.
app.get('/api/config', (c) => c.json({
  gumroad: {
    premium: c.env.GUMROAD_PREMIUM_URL || `https://gumroad.com/l/${c.env.GUMROAD_PREMIUM_PERMALINK || 'quizzalo-premium'}`,
    event: c.env.GUMROAD_EVENT_URL || `https://gumroad.com/l/${c.env.GUMROAD_EVENT_PERMALINK || 'quizzalo-event'}`,
  },
  adsenseClient: c.env.ADSENSE_CLIENT || null,
}));

// ads.txt requis par AdSense (généré dès que ADSENSE_CLIENT est rempli)
app.get('/ads.txt', (c) => {
  if (!c.env.ADSENSE_CLIENT) return c.text('', 200);
  return c.text(`google.com, ${c.env.ADSENSE_CLIENT.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
});

// Audit qualité (protégé) : génère un quiz sans quota, format compact pour relecture.
app.get('/api/audit', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const topic = c.req.query('topic') || 'culture générale';
  const category = c.req.query('cat') || 'culture';
  const type = c.req.query('type') || 'multipleChoice';
  const count = Math.min(parseInt(c.req.query('count')) || 5, 15);
  const difficulty = c.req.query('difficulty') || 'medium';
  try {
    let questions;
    if (type === 'math') questions = generateMathQuestions({ count, difficulty });
    else if (type === 'anagram') questions = await generateAnagramQuestions(c.env, { topic, count });
    else questions = await generateQuestions(c.env, { topic, category, type, count, difficulty, language: 'fr', personalFacts: null });
    return c.json({
      questions: questions.map((q) => ({ q: q.question, ok: q.options[q.correct], opts: q.options, why: q.explanation })),
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Diagnostic des sources externes (Wikipédia / Wiktionnaire)
app.get('/api/wiki/debug', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const term = c.req.query('q') || 'Napoléon Ier';
  const out = {};
  try {
    const r = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
      { headers: { 'User-Agent': 'Quizzalo/1.0 (education quiz app)' } });
    const d = r.ok ? await r.json() : null;
    out.wikipedia = { status: r.status, title: d?.title || null, extract: d?.extract?.slice(0, 180) || null };
  } catch (e) { out.wikipedia = { error: e.message }; }
  try {
    const r = await fetch(`https://fr.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent('cheval')}&format=json`,
      { headers: { 'User-Agent': 'Quizzalo/1.0 (education quiz app)' } });
    const d = r.ok ? await r.json() : null;
    out.wiktionary = { status: r.status, found: d ? !Object.keys(d.query?.pages || { '-1': 1 }).includes('-1') : null };
  } catch (e) { out.wiktionary = { error: e.message }; }
  try {
    const r = await fetch('https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=Louis%20XIV&format=json&srlimit=2',
      { headers: { 'User-Agent': 'Quizzalo/1.0 (education quiz app)' } });
    const d = r.ok ? await r.json() : null;
    out.wikiSearch = { status: r.status, hits: (d?.query?.search || []).map((s) => s.title) };
  } catch (e) { out.wikiSearch = { error: e.message }; }
  return c.json(out);
});

app.get('/api/health', (c) => c.json({ status: 'ok', app: c.env.APP_NAME || 'Quizzalo' }));

// Protected self-test: verifies AI, D1 and KV in production. GET /api/selftest?key=<AUTH_SECRET>
app.get('/api/selftest', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const out = {};
  try {
    const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    out.d1 = { ok: true, users: r.n };
  } catch (e) { out.d1 = { ok: false, error: e.message }; }
  try {
    await c.env.KV.put('selftest', String(Date.now()), { expirationTtl: 60 });
    out.kv = { ok: (await c.env.KV.get('selftest')) !== null };
  } catch (e) { out.kv = { ok: false, error: e.message }; }
  try {
    const questions = await generateQuestions(c.env, {
      topic: 'La France', category: 'culture', type: 'multipleChoice',
      count: 2, difficulty: 'easy', language: 'fr', personalFacts: null,
    });
    out.ai = { ok: true, sample: questions[0]?.question, count: questions.length };
  } catch (e) { out.ai = { ok: false, error: e.message }; }
  try {
    const mq = generateMathQuestions({ count: 2, difficulty: 'medium' });
    out.math = { ok: mq.length === 2, sample: mq[0]?.question, answer: mq[0]?.options[mq[0]?.correct] };
  } catch (e) { out.math = { ok: false, error: e.message }; }
  try {
    const aq = await generateAnagramQuestions(c.env, { topic: 'la cuisine française', count: 2 });
    out.anagram = { ok: aq.length === 2, sample: aq[0]?.question, answer: aq[0]?.options[aq[0]?.correct] };
  } catch (e) { out.anagram = { ok: false, error: e.message }; }
  out.secretSource = c.env.AUTH_SECRET ? 'env' : (cachedSecret ? 'd1' : 'fallback');
  return c.json(out);
});

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) return c.json({ error: 'Not Found' }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(reverifyAll(env));
  },
};
