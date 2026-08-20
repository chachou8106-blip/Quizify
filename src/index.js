// Quizzalo — Cloudflare Worker API + static SPA + Durable Object live games.

import { Hono } from 'hono';
import { hashPassword, randomHex, signJWT, requireAuth, verifyJWT } from './auth';
import { generateQuestions, generateMathQuestions, generateAnagramQuestions, generateVerifiedQuestions, CATEGORIES } from './ai';
import { activateLicense, reverifyAll } from './gumroad';
import { wikiContext } from './wiki';
import {
  fingerprintAll, drawUnseen, knownFingerprints, storeQuestions, markSeen,
  seenAnswerKeys, unseenTracks, markTracksSeen,
} from './bank';
import { exportBank } from './exportBank';
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

// Types dont la réponse peut être confrontée à une source encyclopédique.
// (Vrai/Faux, emoji, « qui suis-je », mix : la réponse n'est pas un extrait de texte → non vérifiables)
const VERIFIABLE_TYPES = new Set(['multipleChoice', 'year', 'quote', 'chrono', 'intru']);

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

// L'empreinte est une mécanique interne : elle ne sort jamais vers le joueur.
function stripInternal(q) {
  return {
    question: q.question, options: q.options, correct: q.correct,
    explanation: q.explanation || '',
  };
}

// Les liens « Pour aller plus loin » attachés aux questions tirées de la banque.
function sourcesOf(questions) {
  const out = [];
  for (const q of questions) {
    if (!q.sourceUrl || out.some((s) => s.url === q.sourceUrl)) continue;
    out.push({ title: q.sourceTitle || q.sourceUrl, url: q.sourceUrl });
  }
  return out.length ? out.slice(0, 6) : null;
}

// Identifie le joueur si un jeton est présent, sans jamais refuser la requête.
// (Le blind test reste ouvert aux invités : ils n'ont simplement pas de mémoire.)
async function softUser(c) {
  try {
    const h = c.req.header('Authorization') || '';
    if (!h.startsWith('Bearer ')) return null;
    return await verifyJWT(h.slice(7), await secret(c));
  } catch {
    return null;
  }
}

// Quelles empreintes ce joueur a-t-il déjà rencontrées ?
async function seenByUser(env, userId, fps) {
  if (!userId || !fps.length) return new Set();
  try {
    const marks = fps.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT fp FROM question_seen WHERE user_id = ? AND fp IN (${marks})`
    ).bind(userId, ...fps).all();
    return new Set((rows.results || []).map((r) => r.fp));
  } catch {
    return new Set();
  }
}

app.post('/api/ai/generate', auth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  // La vérification est TOUJOURS active : aucun réglage client ne peut la désactiver.
  const { topic, category = 'culture', type = 'multipleChoice', count = 5, difficulty = 'medium', language = 'fr', personalFacts } = body;
  if (!topic && !personalFacts) return c.json({ error: 'Indique un sujet ou des anecdotes' }, 400);

  // Calcul mental : généré par du code (réponses garanties justes), gratuit et illimité.
  // On en fabrique plus que nécessaire et on écarte ce que ce joueur a déjà vu.
  if (type === 'math') {
    const n = Math.min(Math.max(parseInt(count) || 8, 1), 20);
    // En calcul, deux questions différentes tombent souvent sur le même résultat :
    // on ne filtre donc que sur la question elle-même, jamais sur la réponse.
    const pool = (await fingerprintAll(generateMathQuestions({ count: n * 4, difficulty })))
      .map((q) => ({ ...q, ak: null }));
    const already = await seenByUser(c.env, user.id, pool.map((q) => q.fp));
    const uniq = [];
    const used = new Set();
    for (const q of pool) {
      if (already.has(q.fp) || used.has(q.fp)) continue;
      used.add(q.fp);
      uniq.push(q);
      if (uniq.length >= n) break;
    }
    const questions = uniq.length >= Math.min(3, n) ? uniq : pool.slice(0, n);
    c.executionCtx.waitUntil((async () => {
      await storeQuestions(c.env, questions, { category: 'education', topic: 'calcul mental', type, difficulty, language });
      await markSeen(c.env, user.id, questions);
    })());
    return c.json({ questions: questions.map(stripInternal) });
  }

  // ---- La banque d'abord : des questions inédites, sans rien consommer ------
  const totalWanted = Math.min(Math.max(parseInt(count) || 5, 1), 40);
  const fromBank = personalFacts ? [] : await drawUnseen(c.env, {
    userId: user.id, topic: String(topic || ''), type, difficulty, language, limit: totalWanted,
  });
  // Tout est déjà disponible et inédit pour ce joueur : service immédiat et gratuit.
  if (fromBank.length >= totalWanted) {
    const picked = fromBank.slice(0, totalWanted);
    c.executionCtx.waitUntil(markSeen(c.env, user.id, picked));
    return c.json({ questions: picked.map(stripInternal), sources: sourcesOf(picked), verified: true });
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
  let sources = null;
  try {
    // On ne fabrique que ce que la banque n'a pas pu fournir.
    const total = totalWanted - fromBank.length;
    const baseOpts = {
      topic: String(topic || '').slice(0, 2000),
      category, type, difficulty, language,
      personalFacts: personalFacts ? String(personalFacts).slice(0, 4000) : null,
    };
    if (!personalFacts && VERIFIABLE_TYPES.has(type)) {
      // Contrôle complet : questions ancrées dans des articles réels et vérifiées une à une.
      const r = await generateVerifiedQuestions(c.env, { topic: baseOpts.topic, count: total, difficulty, language, type });
      if (r.questions.length > 0) {
        questions = r.questions;
        sources = r.sources;
      } else {
        // Aucun article exploitable : on documente quand même le sujet avant d'écrire.
        const ctx = await wikiContext(c.env, baseOpts.topic).catch(() => []);
        const context = ctx.map((s, i) => `[${s.title}]\n${s.extract}`).join('\n\n') || null;
        questions = await generateQuestions(c.env, { ...baseOpts, count: total, context });
        sources = ctx.length ? ctx.map((s) => ({ title: s.title, url: s.url })) : null;
      }
    } else if (type === 'anagram') {
      // L'IA choisit les mots, le code mélange et vérifie → réponses garanties.
      questions = await generateAnagramQuestions(c.env, { topic: baseOpts.topic, count: total, language });
      if (questions.length === 0) throw new Error('impossible de construire les anagrammes');
    } else {
      // Styles libres (emoji, vrai/faux, mix…) : on documente d'abord le sujet,
      // puis la relecture factuelle intégrée écarte les questions douteuses.
      let context = null;
      if (!personalFacts) {
        const ctx = await wikiContext(c.env, baseOpts.topic).catch(() => []);
        if (ctx.length) {
          context = ctx.map((s) => `[${s.title}]\n${s.extract}`).join('\n\n');
          sources = ctx.map((s) => ({ title: s.title, url: s.url }));
        }
      }
      if (total <= 12) {
        questions = await generateQuestions(c.env, { ...baseOpts, count: total, context });
      } else {
      // Gros quiz : génération par lots parallèles de 10 (fiable), puis fusion + dédoublonnage.
      const chunks = [];
      for (let left = total; left > 0; left -= 10) chunks.push(Math.min(10, left));
      const batches = await Promise.all(chunks.map((n, i) =>
        generateQuestions(c.env, { ...baseOpts, count: n, context, topic: `${baseOpts.topic}\n(Lot ${i + 1} — propose des questions sur des aspects différents des autres lots.)` })
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
    }
  } catch (e) {
    // Quota quotidien du moteur atteint : message clair, sans jargon technique.
    if (/neuron|allocation|capacity|429|quota/i.test(e.message || '')) {
      return c.json({
        error: 'engine_busy',
        message: "Beaucoup de quiz ont été créés aujourd'hui ! La création repart dans quelques heures. En attendant, tes quiz déjà enregistrés et les blind tests fonctionnent normalement.",
      }, 503);
    }
    return c.json({ error: 'ai_failed', message: 'La création a échoué. Réessaie dans quelques secondes !' }, 502);
  }

  // ---- Filtre anti-doublon sur ce qui vient d'être fabriqué ------------------
  // Une question déjà présente dans la banque mondiale, ou déjà vue par ce
  // joueur, ou répétée dans le même lot, est écartée.
  let fresh = await fingerprintAll(questions || [], String(topic || ''));
  if (!personalFacts) {
    const fps = fresh.map((q) => q.fp);
    const [inBank, alreadySeen, answersSeen] = await Promise.all([
      knownFingerprints(c.env, fps),
      seenByUser(c.env, user.id, fps),
      seenAnswerKeys(c.env, user.id, fresh.map((q) => q.ak)),
    ]);
    const usedFp = new Set(fromBank.map((q) => q.fp));
    const usedAk = new Set(fromBank.map((q) => q.ak).filter(Boolean));
    const kept = [];
    for (const q of fresh) {
      if (usedFp.has(q.fp) || alreadySeen.has(q.fp)) continue;
      // Même réponse sur le même sujet = même question reformulée.
      if (q.ak && (usedAk.has(q.ak) || answersSeen.has(q.ak))) continue;
      usedFp.add(q.fp);
      if (q.ak) usedAk.add(q.ak);
      kept.push({ ...q, fromBank: inBank.has(q.fp) });
    }
    // Aucune exception : un doublon ne passe jamais, même si le quiz raccourcit.
    // Le rattrapage en lecture profonde ci-dessous se charge de le recompléter.
    fresh = kept;
  }

  let merged = [...fromBank, ...fresh].slice(0, totalWanted);

  // Le filtre anti-doublon a raccourci le quiz : on repart chercher, mais cette
  // fois en lisant les articles EN ENTIER (pas seulement l'introduction) et en
  // interdisant explicitement les angles déjà pris.
  if (merged.length < totalWanted && !personalFacts) {
    try {
      const avoid = merged.map((q) => `${q.question} → ${q.options[q.correct]}`);
      const need = (totalWanted - merged.length) + 2;
      let more;
      if (VERIFIABLE_TYPES.has(type)) {
        more = await generateVerifiedQuestions(c.env, {
          topic: String(topic || ''), count: need, difficulty, language, type, deep: true, avoid,
        });
      } else {
        // Styles libres : même principe, la consigne d'évitement passe par le sujet.
        const qs = await generateQuestions(c.env, {
          topic: `${String(topic || '')}\n\nCES QUESTIONS SONT DÉJÀ POSÉES — trouve autre chose, même pas reformulé :\n${avoid.slice(0, 20).map((a) => `- ${a}`).join('\n')}`,
          category, type, difficulty, language, count: need, personalFacts: null,
        });
        more = { questions: qs, sources: null };
      }
      const extra = await fingerprintAll(more.questions || [], String(topic || ''));
      const takenFp = new Set(merged.map((q) => q.fp));
      const takenAk = new Set(merged.map((q) => q.ak).filter(Boolean));
      const seenFp = await seenByUser(c.env, user.id, extra.map((q) => q.fp));
      const seenAk = await seenAnswerKeys(c.env, user.id, extra.map((q) => q.ak));
      for (const q of extra) {
        if (merged.length >= totalWanted) break;
        if (takenFp.has(q.fp) || seenFp.has(q.fp)) continue;
        if (q.ak && (takenAk.has(q.ak) || seenAk.has(q.ak))) continue;
        takenFp.add(q.fp); if (q.ak) takenAk.add(q.ak);
        merged.push(q);
        fresh.push(q);
      }
      if (more.sources?.length) {
        sources = [...(sources || []), ...more.sources]
          .filter((s, i, arr) => arr.findIndex((o) => o.url === s.url) === i).slice(0, 6);
      }
    } catch { /* on rend ce qu'on a plutôt que d'échouer */ }
  }

  questions = merged;
  const bankSources = sourcesOf(fromBank);
  if (bankSources) sources = [...(sources || []), ...bankSources].filter(
    (s, i, arr) => arr.findIndex((o) => o.url === s.url) === i
  ).slice(0, 6);

  if (!personalFacts) {
    c.executionCtx.waitUntil((async () => {
      await storeQuestions(c.env, fresh, {
        category, topic: String(topic || ''), type, difficulty, language,
        source: sources?.[0] || null,
      });
      await markSeen(c.env, user.id, merged);
    })());
  }

  if (useBonus) {
    await c.env.DB.prepare('UPDATE users SET bonus_ai = MAX(0, bonus_ai - 1) WHERE id = ?').bind(user.id).run();
  } else {
    await c.env.DB.prepare(
      'INSERT INTO ai_usage (user_id, month, count) VALUES (?,?,1) ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1'
    ).bind(user.id, monthKey()).run();
  }

  return c.json({ questions: questions.map(stripInternal), sources, verified: true });
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

  // Anti-répétition : on met devant les morceaux que ce joueur n'a jamais entendus
  // dans l'application. S'il a déjà tout écouté, on complète avec le reste.
  const player = await softUser(c);
  const ordered = player ? await unseenTracks(c.env, player.id, pool, count) : pool;

  const answers = ordered.slice(0, Math.min(count, ordered.length));
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
  if (player) c.executionCtx.waitUntil(markTracksSeen(c.env, player.id, answers));
  return c.json({ questions });
});

// ---------- quizzes ----------

app.post('/api/quizzes', auth, async (c) => {
  const user = c.get('user');
  const { title, category = 'culture', difficulty = 'medium', language = 'fr', questions, sources = null, verified = false } = await c.req.json().catch(() => ({}));
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return c.json({ error: 'Titre et questions requis' }, 400);
  }
  const id = randomHex(10);
  const code = shareCode();
  const emoji = CATEGORIES[category]?.emoji || '🎯';
  await c.env.DB.prepare(
    'INSERT INTO quizzes (id, user_id, title, category, emoji, difficulty, language, questions, share_code, sources, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, user.id, String(title).slice(0, 100), category, emoji, difficulty, language, JSON.stringify(questions), code,
    sources ? JSON.stringify(sources) : null, verified ? 1 : 0).run();
  return c.json({ quiz: { id, title, category, emoji, share_code: code, questions, sources, verified: !!verified } }, 201);
});

app.get('/api/quizzes', auth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, category, emoji, difficulty, share_code, plays, created_at, questions, verified FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
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
  return c.json({ quiz: { ...q, questions: JSON.parse(q.questions), sources: q.sources ? JSON.parse(q.sources) : null } });
});

app.delete('/api/quizzes/:id', auth, async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  return c.json({ ok: true });
});

// Public shared quiz (play by link) — answers included client-side for solo play.
app.get('/api/shared/:code', async (c) => {
  const q = await c.env.DB.prepare('SELECT id, title, category, emoji, difficulty, questions, sources, verified FROM quizzes WHERE share_code = ?')
    .bind(c.req.param('code')).first();
  if (!q) return c.json({ error: 'Quiz introuvable' }, 404);
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE quizzes SET plays = plays + 1 WHERE id = ?').bind(q.id).run()
  );
  return c.json({ quiz: { ...q, questions: JSON.parse(q.questions), sources: q.sources ? JSON.parse(q.sources) : null } });
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

// Audit qualité (protégé) : lance la génération en tâche de fond, résultat lisible via /api/audit/get.
app.get('/api/audit', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.query('id') || randomHex(4);
  const topic = c.req.query('topic') || 'culture générale';
  const category = c.req.query('cat') || 'culture';
  const type = c.req.query('type') || 'multipleChoice';
  const count = Math.min(parseInt(c.req.query('count')) || 5, 15);
  const difficulty = c.req.query('difficulty') || 'medium';

  c.executionCtx.waitUntil((async () => {
    let payload;
    try {
      let questions; let srcs = null;
      if (type === 'math') questions = generateMathQuestions({ count, difficulty });
      else if (type === 'anagram') questions = await generateAnagramQuestions(c.env, { topic, count });
      else if (c.req.query('verified') === '1') {
        const r = await generateVerifiedQuestions(c.env, { topic, count, difficulty, language: 'fr' });
        questions = r.questions; srcs = r.sources;
      } else questions = await generateQuestions(c.env, { topic, category, type, count, difficulty, language: 'fr', personalFacts: null });
      payload = { done: true, topic, category, type, sources: srcs, questions: questions.map((q) => ({ q: q.question, ok: q.options[q.correct], opts: q.options, why: q.explanation })) };
    } catch (e) {
      payload = { done: true, error: e.message };
    }
    await c.env.KV.put(`audit:${id}`, JSON.stringify(payload), { expirationTtl: 3600 });
  })());

  return c.json({ started: true, id });
});

app.get('/api/audit/get', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const raw = await c.env.KV.get(`audit:${c.req.query('id')}`);
  return raw ? c.json(JSON.parse(raw)) : c.json({ done: false });
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

// ---- Banque de questions : pilotage (protégé par AUTH_SECRET) --------------

// Enregistre le jeton GitHub qui autorise l'export nocturne.
// À créer sur github.com/settings/tokens (fine-grained), limité au seul dépôt
// Quizify, avec la permission « Contents: Read and write ». Rien d'autre.
app.post('/api/bank/token', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const { token } = await c.req.json().catch(() => ({}));
  if (!token || typeof token !== 'string') return c.json({ error: 'jeton manquant' }, 400);
  await c.env.DB.prepare(
    'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind('github_token', token.trim()).run();
  return c.json({ ok: true });
});

// État de la banque : combien de questions, dans quelles catégories.
app.get('/api/bank/stats', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM question_bank').first();
  const byCat = await c.env.DB.prepare(
    'SELECT category, type, COUNT(*) AS n FROM question_bank GROUP BY category, type ORDER BY n DESC'
  ).all();
  const seen = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM question_seen').first();
  const tracks = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM track_seen').first();
  const tokenSet = !!(await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('github_token').first());
  return c.json({ questions: total?.n || 0, parCategorie: byCat.results || [], vues: seen?.n || 0, morceauxVus: tracks?.n || 0, exportPret: tokenSet });
});

// Déclenche l'export tout de suite (asynchrone, résultat dans KV).
app.get('/api/bank/export', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.query('id') || randomHex(4);
  const dryRun = c.req.query('dry') === '1';
  c.executionCtx.waitUntil((async () => {
    let payload;
    try { payload = { done: true, ...(await exportBank(c.env, { dryRun })) }; }
    catch (e) { payload = { done: true, error: e.message }; }
    await c.env.KV.put(`export:${id}`, JSON.stringify(payload), { expirationTtl: 3600 });
  })());
  return c.json({ started: true, id });
});

// Preuve d'absence de doublon : on crée un joueur factice, on lui fabrique DEUX
// quiz sur le même sujet via le vrai parcours de création, et on compare.
app.get('/api/bank/selftest', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.query('id') || randomHex(4);
  const topic = c.req.query('topic') || 'Louis XIV';
  const type = c.req.query('type') || 'multipleChoice';
  const count = Math.min(parseInt(c.req.query('count')) || 6, 12);
  // Une génération complète dépasse le temps d'une requête : on procède en deux
  // passes (phase=1 puis phase=2), avec le même joueur factice.
  const phase = c.req.query('phase') === '2' ? 2 : 1;
  const uid = `selftest-${id}`;

  c.executionCtx.waitUntil((async () => {
    const run = async (token) => {
      const res = await app.fetch(new Request('https://selftest/api/ai/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, type, count, difficulty: 'medium', language: 'fr' }),
      }), c.env, c.executionCtx);
      return res.json();
    };
    const norm = (q) => q.question.toLowerCase().replace(/\W+/g, ' ').trim();
    const ansNorm = (q) => String(q.options[q.correct]).toLowerCase().replace(/\W+/g, ' ').trim();

    try {
      if (phase === 1) {
        await c.env.DB.prepare(
          "INSERT OR IGNORE INTO users (id, email, name, pass_hash, salt, plan) VALUES (?,?,?,'x','x','premium')"
        ).bind(uid, `${uid}@selftest.local`, 'Autotest').run();
        const token = await signJWT({ id: uid, email: `${uid}@selftest.local`, name: 'Autotest' }, await secret(c));
        const first = await run(token);
        // La mémoire du joueur s'écrit en tâche de fond : on attend qu'elle soit posée.
        for (let i = 0; i < 25; i++) {
          const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM question_seen WHERE user_id = ?').bind(uid).first();
          if ((n?.n || 0) >= (first.questions?.length || 1)) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        await c.env.KV.put(`export:${id}`, JSON.stringify({
          done: true, phase: 1, topic, type,
          quiz1: (first.questions || []).length,
          questions1: (first.questions || []).map((q) => q.question),
          reponses1: (first.questions || []).map((q) => q.options[q.correct]),
          _n: (first.questions || []).map(norm),
          _a: (first.questions || []).map(ansNorm),
          erreur: first.error || null,
          suite: 'relancer avec &phase=2',
        }), { expirationTtl: 3600 });
        return;
      }

      const prev = JSON.parse((await c.env.KV.get(`export:${id}`)) || '{}');
      const token = await signJWT({ id: uid, email: `${uid}@selftest.local`, name: 'Autotest' }, await secret(c));
      const second = await run(token);
      const set1 = new Set(prev._n || []);
      const ans1 = new Set(prev._a || []);
      const repQ = (second.questions || []).filter((q) => set1.has(norm(q))).map((q) => q.question);
      const repA = (second.questions || []).filter((q) => ans1.has(ansNorm(q))).map((q) => q.options[q.correct]);
      const bank = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM question_bank').first();
      await c.env.KV.put(`export:${id}`, JSON.stringify({
        done: true, phase: 2, topic, type,
        quiz1: prev.quiz1 || 0,
        quiz2: (second.questions || []).length,
        questionsRepetees: repQ,
        reponsesRepetees: repA,
        verdict: repQ.length === 0 && repA.length === 0 ? 'AUCUN DOUBLON' : 'DOUBLON DETECTE',
        banque: bank?.n || 0,
        questions1: prev.questions1 || [],
        questions2: (second.questions || []).map((q) => q.question),
        erreur: second.error || null,
      }), { expirationTtl: 3600 });
      // Ménage : le joueur factice disparaît, les questions restent dans la banque.
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM question_seen WHERE user_id = ?').bind(uid),
        c.env.DB.prepare('DELETE FROM answer_seen WHERE user_id = ?').bind(uid),
        c.env.DB.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(uid),
        c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid),
      ]);
    } catch (e) {
      await c.env.KV.put(`export:${id}`, JSON.stringify({ done: true, error: e.message, phase }), { expirationTtl: 3600 });
    }
  })());

  return c.json({ started: true, id, phase });
});

app.get('/api/bank/export/get', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const raw = await c.env.KV.get(`export:${c.req.query('id')}`);
  return raw ? c.json(JSON.parse(raw)) : c.json({ done: false });
});

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) return c.json({ error: 'Not Found' }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(reverifyAll(env));
    // Publication nocturne de la banque de questions vers GitHub (un commit/nuit).
    ctx.waitUntil(exportBank(env).catch(() => {}));
  },
};
