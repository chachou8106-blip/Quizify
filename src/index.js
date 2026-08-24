// Quizzalo — Cloudflare Worker API + static SPA + Durable Object live games.

import { Hono } from 'hono';
import { hashPassword, randomHex, signJWT, requireAuth, verifyJWT } from './auth';
import { generateQuestions, generateMathQuestions, generateAnagramQuestions, generateVerifiedQuestions, CATEGORIES } from './ai';
import { activateLicense, reverifyAll } from './gumroad';
import { wikiContext, spellSuggestion } from './wiki';
import { cleAmbiance, estSansBase, trouverAmbiance, SYNONYMES } from './musique';
import {
  fingerprintAll, drawUnseen, knownFingerprints, storeQuestions, markSeen,
  seenAnswerKeys, unseenTracks, markTracksSeen, topicKey,
} from './bank';
import { exportBank } from './exportBank';
import {
  CREDENTIALS, getSetting, setSetting, maskValue, logError,
  overview, listQuizzes, listUsers, bankStats, listErrors, listVideos,
  gumroadStats, youtubeStats, cloudflareStats, githubStats,
} from './admin';
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
  return c.json({ token, user: { id: u.id, email: u.email, name: u.name, plan, isAdmin: !!u.is_admin } });
});

app.get('/api/auth/me', auth, async (c) => {
  const user = c.get('user');
  const u = await c.env.DB.prepare('SELECT id, email, name, plan, plan_expires, bonus_ai, is_admin FROM users WHERE id = ?').bind(user.id).first();
  if (!u) return c.json({ error: 'Compte introuvable' }, 404);
  const plan = await getPlan(c, u.id);
  const usage = await c.env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND month = ?')
    .bind(u.id, monthKey()).first();
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, plan, plan_expires: u.plan_expires, isAdmin: !!u.is_admin },
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

// Le titre doit décrire ce qu'il y a DANS le quiz, pas recopier ce qui a été tapé.
// Quand le sujet a été retrouvé dans une source, on prend le nom de l'article :
// c'est lui qui correspond réellement aux questions produites.
function titreDuQuiz(topic, sources) {
  const tape = String(topic || '').trim().replace(/\s+/g, ' ');
  const source = sources?.[0]?.title;
  if (source) {
    // On ne remplace que si le titre de l'article couvre bien le sujet tapé
    // (évite de rebaptiser « Les années 80 » en « Musique des années 1980 »).
    const a = source.toLowerCase(), b = tape.toLowerCase();
    if (a.includes(b) || b.includes(a) || !tape) return source.slice(0, 80);
  }
  if (!tape) return 'Quiz';
  return (tape.charAt(0).toUpperCase() + tape.slice(1)).slice(0, 80);
}

app.post('/api/ai/generate', auth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  // La vérification est TOUJOURS active : aucun réglage client ne peut la désactiver.
  const { topic, category = 'culture', type = 'multipleChoice', count = 5, difficulty = 'medium', language = 'fr', personalFacts } = body;
  if (!topic && !personalFacts) return c.json({ error: 'Indique un sujet ou des anecdotes' }, 400);

  // Faute de frappe : on propose la bonne orthographe AVANT de produire quoi que
  // ce soit. Sans ça, un « Grogrzphie » partait en génération et ressortait
  // comme titre définitif du quiz.
  if (topic && !personalFacts && !c.req.query('force')) {
    const correction = await spellSuggestion(topic).catch(() => null);
    if (correction) {
      return c.json({ error: 'topic_suggestion', suggestion: correction, saisi: String(topic).trim() }, 409);
    }
  }

  // Calcul mental : généré par du code (réponses garanties justes), gratuit et illimité.
  // On en fabrique plus que nécessaire et on écarte ce que ce joueur a déjà vu.
  if (type === 'math') {
    // Plafond aligné sur le reste de l'application : le sélecteur propose jusqu'à
    // 40, il serait mensonger d'en rendre 20. Le calcul est produit par du code,
    // donc en fabriquer davantage ne coûte rien.
    const n = Math.min(Math.max(parseInt(count) || 8, 1), 40);
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
    return c.json({
      questions: questions.map(stripInternal),
      demandees: n,
      alerte: questions.length < n
        ? `Tu as demandé ${n} questions, ${questions.length} ont pu être produites sans répétition.`
        : null,
    });
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

  const startedAt = Date.now();
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
      // Contrôle complet : questions ancrées dans des articles réels, vérifiées
      // une à une.
      //
      // Les gros quiz se produisent par VAGUES. Un appel unique demandait au
      // mieux 20 questions au modèle, puis le filtre en écartait la majorité :
      // demander 40 questions en rendait parfois une seule. Chaque vague reçoit
      // la liste de ce qui est déjà pris, pour ne pas refaire la même chose.
      const parVague = 10;
      const accumulees = [];
      let sourcesVues = null;
      const debutVagues = Date.now();

      for (let vague = 0; accumulees.length < total && vague < 5; vague++) {
        // Budget de temps : mieux vaut rendre 30 questions que faire patienter
        // trois minutes pour en obtenir 40.
        if (vague > 0 && Date.now() - debutVagues > 70000) break;
        const reste = total - accumulees.length;
        const r = await generateVerifiedQuestions(c.env, {
          topic: baseOpts.topic,
          count: Math.min(parVague, reste + 2),
          difficulty, language, type,
          deep: true,
          avoid: accumulees.map((q) => `${q.question} → ${q.options[q.correct]}`),
          maxAttempts: 2,
          skipJudge: vague > 0,
        });
        if (!r.questions.length) break;
        if (!sourcesVues && r.sources?.length) sourcesVues = r.sources;
        // Dédoublonnage entre vagues : ni la même question, ni la même réponse.
        const dejaQ = new Set(accumulees.map((q) => q.question.toLowerCase().replace(/\W+/g, ' ').trim()));
        const dejaR = new Set(accumulees.map((q) => String(q.options[q.correct]).toLowerCase().trim()));
        let ajoutees = 0;
        for (const q of r.questions) {
          if (accumulees.length >= total) break;
          const cleQ = q.question.toLowerCase().replace(/\W+/g, ' ').trim();
          const cleR = String(q.options[q.correct]).toLowerCase().trim();
          if (dejaQ.has(cleQ) || dejaR.has(cleR)) continue;
          dejaQ.add(cleQ); dejaR.add(cleR);
          accumulees.push(q);
          ajoutees++;
        }
        // Une vague qui n'apporte plus rien signale un sujet épuisé.
        if (ajoutees === 0) break;
      }

      if (accumulees.length > 0) {
        questions = accumulees;
        sources = sourcesVues;
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
    const busy = /neuron|allocation|capacity|429|quota/i.test(e.message || '');
    c.executionCtx.waitUntil(logError(
      c.env, busy ? 'moteur-sature' : 'creation',
      e.message, `sujet: ${String(topic || '').slice(0, 120)} · style: ${type} · ${count} questions`, user.id
    ));
    if (busy) {
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

  // La mémoire du joueur (a-t-il déjà vu ça un autre jour ?) ne s'applique qu'aux
  // quiz sur le monde. Un quiz d'anniversaire est bâti sur des anecdotes privées :
  // rien à comparer avec la banque mondiale.
  const fps = fresh.map((q) => q.fp);
  const [inBank, alreadySeen, answersSeen] = personalFacts
    ? [new Set(), new Set(), new Set()]
    : await Promise.all([
        knownFingerprints(c.env, fps),
        seenByUser(c.env, user.id, fps),
        seenAnswerKeys(c.env, user.id, fresh.map((q) => q.ak)),
      ]);

  // En revanche, l'interdit « jamais deux fois la même question ni la même
  // réponse DANS UN MÊME QUIZ » s'applique à TOUT, anniversaire compris.
  // C'est exactement le défaut qu'a subi Nicole : deux questions différentes
  // répondant toutes les deux « Ératosthène » dans le même quiz.
  {
    const usedFp = new Set(fromBank.map((q) => q.fp));
    const usedAk = new Set(fromBank.map((q) => q.ak).filter(Boolean));
    const kept = [];
    for (const q of fresh) {
      if (usedFp.has(q.fp) || alreadySeen.has(q.fp)) continue;
      if (q.ak && (usedAk.has(q.ak) || answersSeen.has(q.ak))) continue;
      usedFp.add(q.fp);
      if (q.ak) usedAk.add(q.ak);
      kept.push({ ...q, fromBank: inBank.has(q.fp) });
    }
    // Aucune exception : un doublon ne passe jamais, même si le quiz raccourcit.
    // Les rattrapages ci-dessous se chargent de le recompléter.
    fresh = kept;
  }

  let merged = [...fromBank, ...fresh].slice(0, totalWanted);

  // Le filtre anti-doublon a raccourci le quiz : on repart chercher, mais cette
  // fois en lisant les articles EN ENTIER (pas seulement l'introduction) et en
  // interdisant explicitement les angles déjà pris.
  // Borné en temps : mieux vaut un quiz d'une question de moins qu'une création
  // qui n'aboutit pas. Le filtre anti-doublon, lui, ne cède jamais.
  if (merged.length < totalWanted && !personalFacts && Date.now() - startedAt < 25000) {
    try {
      const avoid = merged.map((q) => `${q.question} → ${q.options[q.correct]}`);
      const need = (totalWanted - merged.length) + 2;
      let more;
      if (VERIFIABLE_TYPES.has(type)) {
        more = await generateVerifiedQuestions(c.env, {
          topic: String(topic || ''), count: need, difficulty, language, type,
          deep: true, avoid, maxAttempts: 2, skipJudge: true,
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

  // Dernier filet, sans le moindre neurone : plutôt que de rendre un quiz plus
  // court, on rouvre la banque en levant la seule contrainte négociable — « ce
  // joueur l'a déjà vue un jour ». L'interdit absolu, lui, reste entier :
  // jamais deux fois la même question NI la même réponse DANS UN MÊME QUIZ.
  if (merged.length < totalWanted && !personalFacts) {
    try {
      const takenFp = new Set(merged.map((q) => q.fp).filter(Boolean));
      const takenAk = new Set(merged.map((q) => q.ak).filter(Boolean));
      const rows = await c.env.DB.prepare(
        `SELECT fp, ak, question, options, correct, explanation, source_url, source_title
           FROM question_bank
          WHERE topic_key = ? AND type = ? AND language = ?
          ORDER BY served ASC, RANDOM() LIMIT 40`
      ).bind(topicKey(String(topic || '')), type, language).all();
      for (const r of rows.results || []) {
        if (merged.length >= totalWanted) break;
        if (takenFp.has(r.fp) || (r.ak && takenAk.has(r.ak))) continue;
        takenFp.add(r.fp); if (r.ak) takenAk.add(r.ak);
        merged.push({
          fp: r.fp, ak: r.ak, question: r.question, options: JSON.parse(r.options),
          correct: r.correct, explanation: r.explanation || '',
          sourceUrl: r.source_url || null, sourceTitle: r.source_title || null, fromBank: true,
        });
      }
    } catch { /* la banque est un bonus, jamais bloquante */ }
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

  // On ne facture pas une génération qui n'a pas tenu sa promesse. Rendre 1
  // question sur 40 ET décompter un crédit, c'est la double peine.
  const aTenuSaPromesse = questions.length >= Math.ceil(totalWanted / 2);
  if (aTenuSaPromesse) {
    if (useBonus) {
      await c.env.DB.prepare('UPDATE users SET bonus_ai = MAX(0, bonus_ai - 1) WHERE id = ?').bind(user.id).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO ai_usage (user_id, month, count) VALUES (?,?,1) ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1'
      ).bind(user.id, monthKey()).run();
    }
  }

  // Et on le DIT quand le compte n'y est pas, au lieu de laisser croire que
  // c'est normal.
  const manque = totalWanted - questions.length;
  const alerte = manque > 0
    ? `Tu as demandé ${totalWanted} questions, ce sujet n'en a permis que ${questions.length}. `
      + (questions.length < 5
        ? 'Essaie un sujet plus large, ou un sujet différent.'
        : 'Les questions douteuses ou répétées ont été écartées. Tu peux relancer pour en obtenir d\'autres.')
    : null;

  return c.json({
    alerte,
    demandees: totalWanted,
    questions: questions.map(stripInternal),
    sources,
    verified: true,
    titre: titreDuQuiz(topic, sources),
  });
});

// ---------- Blind Test musical (vrais extraits 30s via l'API publique iTunes, sans quota IA) ----------

// Marqueurs d'une prise autre que la version connue de tous.
const VERSION_AUTRE = /remaster|version|\bedit\b|\bmix\b|\blive\b|radio|acoustic|acoustique|unplugged|\bdub\b|instrumental|re-?recorded|rerecorded|pianoforte|extended|\bmono\b|\bstereo\b|\bdemo\b|session/i;

function cleanTitle(s) {
  return String(s).replace(/\s*\((?=[^)]*(?:remaster|version|edit|mix|live|radio|acoustic|acoustique|unplugged|dub|instrumental|re-?recorded|rerecorded|pianoforte|extended|mono|stereo|demo|session))[^)]*\)/gi, '').trim();
}

// Un blind test se joue sur la version que tout le monde a en tête. « Creep
// (Acoustic) », « Take On Me (MTV Unplugged) » ou « All That She Wants
// (Extended Dub) » passent donc derrière l'originale.
function versionAlternative(t) {
  return VERSION_AUTRE.test(String(t?.title || '')) ? 1 : 0;
}

async function deezerJson(path) {
  const res = await fetch(`https://api.deezer.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Quizzalo)' } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// Quizzalo se joue en famille, enfants compris : on écarte les morceaux
// signalés comme explicites par le catalogue, ainsi que les titres grossiers.
// Un blind test qui affiche une insulte en gros sur la télé du salon, c'est
// exactement ce qu'on ne veut pas le soir d'un anniversaire.
const GROS_MOTS = /\b(fuck|f\*ck|shit|bitch|nigga|niggas|pussy|cunt|salope|pute|enculé|encule|nique|niquer|connard|bite|couilles)\b/i;

// Le catalogue est plein de reprises au kilomètre. Un blind test qui fait
// écouter « Bohemian Rhapsody » par un ensemble karaoké n'est plus un blind
// test : personne ne reconnaît l'enregistrement, et la bonne réponse devient
// fausse.
const CONTREFACONS = /\b(karaoke|karaoké|tribute|hommage à|cover band|covers?\b.*\bband|made famous by|in the style of|instrumental version|backing track|playback|the hit crew|kidz bop|orchestre de variété)\b/i;

function mapDeezerTracks(list) {
  return (list || [])
    .filter((t) => t.preview && t.title && t.artist?.name)
    .filter((t) => !t.explicit_lyrics && !GROS_MOTS.test(t.title) && !GROS_MOTS.test(t.artist?.name || ''))
    .filter((t) => !CONTREFACONS.test(t.artist?.name || '') && !CONTREFACONS.test(t.title || '')
      && !CONTREFACONS.test(t.album?.title || ''))
    .map((t) => ({
      title: cleanTitle(t.title),
      artist: t.artist.name,
      // Deezer preview URLs expire after a few minutes — store a proxy path
      // that resolves a fresh URL at play time instead.
      preview: `/api/music/preview/dz/${t.id}`,
      art: t.album?.cover_medium || '',
      // Sert à départager les enregistrements : la bande originale d'un film
      // porte le nom du film sur son album, pas la reprise d'un inconnu.
      album: t.album?.title || '',
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

// --- Morceaux d'un artiste de la base d'ambiances --------------------------
// `titres` vide = les morceaux les plus écoutés de l'artiste.
// `titres` renseigné = uniquement ceux-là (indispensable pour les décennies).
// Deux enregistrements du même morceau ne sont pas deux questions : « Perfect
// (Acoustic) » et « Perfect Duet (with Beyoncé) » sont la même chanson, et
// « Amoureuse » revient deux fois dans le catalogue de Véronique Sanson.
function cleMorceau(t) {
  const titre = normTxt(
    String(t.title || '')
      .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
      .replace(/\s+-\s+.*$/, '')
      .replace(/\bfeat\.?\s.*$/i, ''),
  );
  return `${titre}|${normTxt(t.artist || '')}`;
}

async function fetchArtistTracks(nom, titres = []) {
  const data = await deezerJson(`/search?q=${encodeURIComponent(`artist:"${nom}"`)}&limit=40`);
  const cible = normTxt(nom);
  let pistes = mapDeezerTracks(data?.data).filter((t) => {
    // La recherche par artiste reste une recherche : on vérifie que le morceau
    // est bien du bon interprète. La comparaison ne doit accepter le nom
    // cherché qu'en TÊTE du nom trouvé : « Warren » (zouk) attrapait sinon
    // « Alex Warren », et « The Who » un obscur artiste nommé « Who ».
    const brut = String(t.artist || '');
    const a = normTxt(brut);
    if (a === cible) return true;
    // Le catalogue crédite parfois plus court que la base : « Bob Marley »
    // pour « Bob Marley & The Wailers ».
    if (cible.startsWith(`${a} `)) return true;
    // Plus long : on n'accepte qu'une collaboration, jamais un homonyme.
    // « Michael Jackson & Paul McCartney » oui, « Queen Latifah » non.
    if (a.startsWith(`${cible} `)) return /[&,]|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bvs\.?\b/i.test(brut);
    return false;
  });
  if (titres.length) {
    // Un seul enregistrement par titre demandé, et le plus proche du titre
    // cherché. Une simple recherche « contient » retenait « December (Based on
    // \"September\") » pour September et « Macarena Christmas » pour Macarena.
    const proximite = (t, v) => {
      const ti = normTxt(t.title);
      if (ti === v) return 0;
      if (ti.startsWith(v)) return 1;
      return 2;
    };
    const retenus = [];
    for (const voulu of titres.map((x) => normTxt(x)).filter(Boolean)) {
      const candidats = pistes.filter((t) => normTxt(t.title).includes(voulu));
      if (!candidats.length) continue;
      candidats.sort((a, b) => proximite(a, voulu) - proximite(b, voulu)
        || versionAlternative(a) - versionAlternative(b));
      retenus.push(candidats[0]);
    }
    pistes = retenus;
  }
  // L'originale d'abord, les prises alternatives ensuite. Le tri est stable :
  // à l'intérieur de chaque groupe, l'ordre de popularité du catalogue est
  // conservé. C'est ce qui fait gagner « Creep » contre « Creep (Acoustic) »
  // au moment du dédoublonnage juste en dessous.
  pistes.sort((a, b) => versionAlternative(a) - versionAlternative(b));
  // Un même enregistrement figure sur l'album, la compilation et le live : sans
  // ce tri, « Amsterdam » occupait trois des huit meilleures places de Brel.
  const vus = new Set();
  return pistes.filter((t) => {
    const k = cleMorceau(t);
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}

// Certaines ambiances se définissent par des chansons, pas par des artistes :
// personne ne cherche « la discographie d'Anaïs Delva », on cherche
// « Libérée, délivrée ». On prend alors l'enregistrement le plus écouté.
async function fetchTitreTrack(titre, contexte = '') {
  const data = await deezerJson(`/search?q=${encodeURIComponent(`${titre} ${contexte}`.trim())}&limit=10`);
  const pistes = mapDeezerTracks(data?.data);
  // Le titre trouvé doit être celui qu'on cherchait. Sans cette vérification,
  // une recherche « Heigh-Ho Blanche-Neige » rapportait « Sifflez en
  // travaillant » : même film, autre chanson, donc mauvaise réponse.
  const voulu = normTxt(titre);
  const correspond = pistes.filter((t) => {
    const ti = normTxt(t.title);
    return ti === voulu || ti.startsWith(voulu) || ti.includes(voulu);
  });
  // On préfère l'enregistrement officiel : celui dont l'album parle du film.
  // Sans cela, « Un jour mon prince viendra » revenait chanté par un compte de
  // reprises plutôt que par la bande originale.
  const mots = normTxt(contexte).split(' ').filter((m) => m.length >= 4);
  const officiel = (t) => {
    const ou = normTxt(`${t.album} ${t.title}`);
    return mots.some((m) => ou.includes(m)) || /disney|bande originale|original soundtrack/.test(ou) ? 0 : 1;
  };
  correspond.sort((a, b) => officiel(a) - officiel(b) || versionAlternative(a) - versionAlternative(b));
  return correspond.length ? [correspond[0]] : [];
}

// --- Ambiance servie par la base maison ------------------------------------
async function fetchAmbianceTracks(libelle, besoin = 8, budget = 18) {
  const base = trouverAmbiance(libelle);
  if (!base) return null;
  // Les listes sont écrites du plus connu au moins connu. On mélange à
  // l'intérieur de deux moitiés plutôt que sur l'ensemble : une soirée réclame
  // Brel et Piaf avant Guy Béart, tout en gardant de la variété d'une partie à
  // l'autre.
  const coupe = Math.ceil(base.length * 0.55);
  const entrees = [...shuffle(base.slice(0, coupe)), ...shuffle(base.slice(coupe))];
  // On vise un vivier un peu plus large que le nombre de morceaux demandés :
  // les trois mauvaises propositions de chaque question y sont puisées aussi.
  const objectif = besoin + Math.max(4, Math.ceil(besoin / 2));
  const out = [];
  let i = 0;
  let appels = 0;
  // Par vagues de six artistes : on s'arrête dès qu'on a de quoi jouer, ce qui
  // économise des appels, et on continue si des artistes n'ont rien donné.
  // Le budget borne le total (une Worker gratuite est limitée à 50 requêtes
  // externes par requête entrante).
  while (i < entrees.length && appels < budget && out.length < objectif) {
    const paquet = entrees.slice(i, i + 6);
    i += paquet.length;
    appels += paquet.length;
    const lots = await Promise.all(paquet.map(async (entree) => {
      const brut = String(entree);
      if (brut.startsWith('#')) {
        // Format « #Titre|Film » : le film sert à cibler la recherche, le titre
        // sert à vérifier qu'on a bien trouvé la bonne chanson.
        const [titre, contexte = ''] = brut.slice(1).split('|');
        try { return await fetchTitreTrack(titre.trim(), contexte.trim()); } catch { return []; }
      }
      const [nom, ...titres] = brut.split('|');
      try {
        const pistes = await fetchArtistTracks(nom.trim(), titres);
        // Trois morceaux au maximum par artiste : personne ne veut cinq
        // questions de suite sur le même chanteur.
        if (titres.length) return shuffle(pistes).slice(0, Math.min(titres.length, 3));
        // Deezer renvoie les morceaux par popularité décroissante. On puise
        // dans les huit premiers : un blind test se joue sur des chansons que
        // l'on reconnaît, pas sur la face B d'un album de 1954.
        //
        // Le nombre par artiste s'ajuste à la longueur de la partie : sur
        // quinze morceaux, quatre titres de Florent Pagny d'affilée, c'est
        // trop.
        const parArtiste = Math.min(4, Math.max(2, Math.ceil(besoin / 6)));
        return shuffle(pistes.slice(0, 8)).slice(0, parArtiste);
      } catch { return []; }
    }));
    out.push(...lots.flat());
  }
  return out;
}

// --- Chemin de secours : playlists Deezer, filtrées sévèrement --------------
const MOTS_PLAYLIST = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'ou', 'au', 'aux', 'en', 'the', 'of', 'and', 'pour', 'avec']);

// Le titre de la playlist doit VRAIMENT parler du thème. Sans cette exigence,
// une recherche « Chanson française » remontait une playlist de ballades
// tristes anglo-saxonnes, dont tous les morceaux entraient dans le quiz.
function titrePlaylistCorrespond(titre, theme) {
  const t = normTxt(titre || '');
  const cle = cleAmbiance(theme).replace(/,/g, '');
  for (const [prefixe, mots] of Object.entries(SYNONYMES)) {
    if (cle.startsWith(prefixe) || prefixe.startsWith(cle)) return mots.some((m) => t.includes(m));
  }
  const mots = normTxt(theme).split(' ').filter((m) => m.length >= 3 && !MOTS_PLAYLIST.has(m));
  if (!mots.length) return true;
  // Une lettre de tolérance : « française » doit accepter « francais ».
  return mots.every((m) => t.includes(m.slice(0, Math.max(4, m.length - 1))));
}

// « Années 80 90 2000 » passait le filtre de décennie et ramenait tout.
function melangeDeDecennies(titre, court, long) {
  const trouvees = (normTxt(titre || '').match(/\b(19[5-9]0|20[0-2]0|[5-9]0|10)\b/g) || []);
  return trouvees.some((d) => d !== court && d !== long);
}

// Thème d'ambiance : base maison d'abord, playlists Deezer en secours.
async function fetchThemeTracks(term, limit = 60, besoin = 8, budget = 18) {
  if (/\bhits? du moment\b|\btop 50\b|\btendance/.test(normTxt(term))) return fetchChartTracks(limit);

  // Source maîtrisée : chaque ambiance nomme ses artistes (voir src/musique.js).
  if (!estSansBase(term)) {
    const maison = await fetchAmbianceTracks(term, besoin, budget);
    // Un vivier maîtrisé, même modeste, vaut mieux qu'une playlist d'inconnu.
    if (maison && maison.length >= 6) return maison;
  }

  const search = await deezerJson(`/search/playlist?q=${encodeURIComponent(term)}&limit=25`);
  let candidates = (search?.data || [])
    .filter((p) => (p.nb_tracks || 0) >= 15)
    .filter((p) => titrePlaylistCorrespond(p.title, term));

  const dec = normTxt(term).match(/\b(19)?([5-9]0)\b|\b(20)([0-2]0)\b/);
  if (dec) {
    const court = dec[2] || dec[4];
    const long = dec[2] ? `19${dec[2]}` : `20${dec[4]}`;
    candidates = candidates.filter((p) => {
      const t = normTxt(p.title || '');
      const parleDeLaBonne = t.includes(long) || new RegExp(`\\b${court}(s|'s)?\\b`).test(t);
      return parleDeLaBonne && !melangeDeDecennies(p.title, court, long);
    });
  }

  const playlists = candidates
    .sort((a, b) => (b.fans || b.nb_tracks || 0) - (a.fans || a.nb_tracks || 0))
    .slice(0, 3);
  const out = [];
  for (const p of playlists) {
    const tr = await deezerJson(`/playlist/${p.id}/tracks?limit=${Math.min(limit, 100)}`);
    out.push(...mapDeezerTracks(tr?.data));
    if (out.length >= limit) break;
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

// Construit les questions d'un blind test à partir d'un vivier de morceaux.
// Partagé par le blind test, la création de quiz et le banc d'essai : une
// seule version du code, donc une seule chose à vérifier.
function construireBlindTest(pool, reponses) {
  const label = (t) => `${t.title} — ${t.artist}`;
  return reponses.map((track) => {
    const leurres = shuffle(pool.filter((t) => t !== track)).slice(0, 3);
    const options = shuffle([track, ...leurres]).map(label);
    return {
      question: '🎵 Quel est ce morceau ?',
      options,
      correct: options.indexOf(label(track)),
      explanation: `C'était « ${track.title} » de ${track.artist}.`,
      audioUrl: track.preview,
      artwork: track.art,
    };
  });
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
  // Une Worker ne peut émettre que 50 requêtes externes par requête entrante.
  // On s'arrête à 30 pour garder de la marge (chemin de secours, redirections).
  const budget = Math.max(4, Math.floor(30 / Math.max(1, themes.length + artists.length)));
  const pools = await Promise.all([
    ...themes.map((t) => fetchThemeTracks(t, perTheme, count, budget)),
    ...artists.map((a) => fetchTracksDeezer(a, Math.min(perTheme, 25)).then((r) => r.tracks)),
  ]);

  // Dedupe by title+artist
  const seen = new Set();
  const pool = [];
  for (const track of shuffle(pools.flat())) {
    const key = cleMorceau(track);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(track);
  }
  if (pool.length < 4) {
    c.executionCtx.waitUntil(logError(c.env, 'blind-test', 'Pas assez de morceaux', `thèmes: ${themesParam || q} · artistes: ${artistsParam}`));
    return c.json({ error: 'Pas assez de morceaux trouvés pour ce thème — essaie d\'autres artistes ou genres.' }, 404);
  }

  // Anti-répétition : on met devant les morceaux que ce joueur n'a jamais entendus
  // dans l'application. S'il a déjà tout écouté, on complète avec le reste.
  const player = await softUser(c);
  const ordered = player ? await unseenTracks(c.env, player.id, pool, count) : pool;

  const answers = ordered.slice(0, Math.min(count, ordered.length));
  const questions = construireBlindTest(pool, answers);
  if (player) c.executionCtx.waitUntil(markTracksSeen(c.env, player.id, answers));
  return c.json({ questions });
});

// ---------- quizzes ----------

// Retire d'un quiz les questions répétées et celles qui refont la même réponse.
// Les blind tests sont épargnés : plusieurs morceaux peuvent légitimement
// partager un même artiste sans que ce soit un doublon.
async function dedupQuiz(questions) {
  try {
    const marques = await fingerprintAll(questions, '');
    const vusFp = new Set();
    const vusAk = new Set();
    const gardees = [];
    for (let i = 0; i < marques.length; i++) {
      const q = marques[i];
      if (q.audioUrl) { gardees.push(questions[i]); continue; }
      if (vusFp.has(q.fp) || (q.ak && vusAk.has(q.ak))) continue;
      vusFp.add(q.fp); if (q.ak) vusAk.add(q.ak);
      gardees.push(questions[i]);
    }
    return gardees.length ? gardees : questions;
  } catch {
    return questions;
  }
}

app.post('/api/quizzes', auth, async (c) => {
  const user = c.get('user');
  const { title, category = 'culture', difficulty = 'medium', language = 'fr', questions, sources = null, verified = false } = await c.req.json().catch(() => ({}));
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return c.json({ error: 'Titre et questions requis' }, 400);
  }
  // Dernier verrou avant enregistrement : quel que soit le chemin emprunté
  // (création classique, anniversaire, blind test, quiz importé), un quiz ne
  // peut pas contenir deux fois la même question ni deux fois la même réponse.
  const propres = await dedupQuiz(questions);

  const id = randomHex(10);
  const code = shareCode();
  const emoji = CATEGORIES[category]?.emoji || '🎯';
  await c.env.DB.prepare(
    'INSERT INTO quizzes (id, user_id, title, category, emoji, difficulty, language, questions, share_code, sources, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(id, user.id, String(title).slice(0, 100), category, emoji, difficulty, language, JSON.stringify(propres), code,
    sources ? JSON.stringify(sources) : null, verified ? 1 : 0).run();
  return c.json({ quiz: { id, title, category, emoji, share_code: code, questions: propres, sources, verified: !!verified } }, 201);
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
  // Le correcteur d'orthographe n'est testable qu'ici : Wikipédia est
  // injoignable depuis l'environnement de développement.
  try { out.correctionProposee = await spellSuggestion(term); }
  catch (e) { out.correctionProposee = { erreur: e.message }; }
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
// ---- Atelier de préparation : fabriquer un quiz et l'enregistrer -----------
// Sert à préparer une soirée à l'avance sans que l'animateur ait à cliquer.
//
// Point d'attention : on appelle ici les fonctions de génération DIRECTEMENT.
// Une première version se rappelait elle-même via app.fetch() depuis un
// waitUntil ; comme la réponse « started » était déjà partie, le contexte de la
// requête était détruit et la sous-requête mourait sans jamais rien écrire.
app.get('/api/prepare', async (c) => {
  if (c.req.query('key') !== (await secret(c))) return c.json({ error: 'forbidden' }, 403);
  const id = c.req.query('id') || randomHex(4);
  const email = (c.req.query('email') || '').trim().toLowerCase();
  const topic = c.req.query('topic') || '';
  const type = c.req.query('type') || 'multipleChoice';
  const category = c.req.query('cat') || 'free';
  const difficulty = c.req.query('difficulty') || 'medium';
  const count = Math.min(Math.max(parseInt(c.req.query('count')) || 8, 1), 25);
  const titreVoulu = c.req.query('titre') || '';
  if (!email || !topic) return c.json({ error: 'email et topic requis' }, 400);

  c.executionCtx.waitUntil((async () => {
    let payload;
    try {
      const u = await c.env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first();
      if (!u) throw new Error(`aucun compte pour ${email}`);

      let questions = [];
      let sources = null;

      if (type === 'blindtest') {
        // Les morceaux viennent du catalogue musical : aucune unité consommée.
        const themes = topic.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
        const perTheme = Math.max(20, count * 4);
        const budget = Math.max(4, Math.floor(30 / Math.max(1, themes.length)));
        const pools = await Promise.all(themes.map((t) => fetchThemeTracks(t, perTheme, count, budget)));
        const vus = new Set();
        const pool = [];
        for (const t of shuffle(pools.flat())) {
          const k = cleMorceau(t);
          if (vus.has(k)) continue;
          vus.add(k); pool.push(t);
        }
        if (pool.length < 4) throw new Error('pas assez de morceaux');
        questions = construireBlindTest(pool, pool.slice(0, Math.min(count, pool.length)));
      } else if (type === 'math') {
        questions = generateMathQuestions({ count, difficulty });
      } else if (type === 'anagram') {
        questions = await generateAnagramQuestions(c.env, { topic, count, language: 'fr' });
      } else if (VERIFIABLE_TYPES.has(type) && c.req.query('mode') !== 'fete') {
        // Mode « fête » : on n'ancre PAS les questions dans l'article
        // encyclopédique du sujet. Un article d'encyclopédie sur « Dinosaure »
        // parle de clades et de nomenclature : ancré dessus, le modèle ne peut
        // produire qu'un cours de phylogénie, inutilisable en soirée.
        // Les questions restent contrôlées — relecture factuelle, contre-épreuve
        // à l'aveugle et filtre hors-sujet s'appliquent toujours — mais elles
        // sortent de la connaissance générale, pas du vocabulaire d'un article.
        const r = await generateVerifiedQuestions(c.env, { topic, count, difficulty, language: 'fr', type });
        questions = r.questions;
        sources = r.sources;
        if (!questions.length) {
          questions = await generateQuestions(c.env, { topic, category, type, count, difficulty, language: 'fr', personalFacts: null });
        }
      } else {
        questions = await generateQuestions(c.env, { topic, category, type, count, difficulty, language: 'fr', personalFacts: null });
      }
      if (!questions.length) throw new Error('génération vide');

      // Mêmes verrous qu'une création normale : pas deux fois la même question
      // ni la même réponse dans un quiz.
      const propres = await dedupQuiz(questions);

      const qid = randomHex(10);
      const code = shareCode();
      const emoji = CATEGORIES[category]?.emoji || '🎯';
      const titre = (titreVoulu || topic).slice(0, 100);
      await c.env.DB.prepare(
        'INSERT INTO quizzes (id, user_id, title, category, emoji, difficulty, language, questions, share_code, sources, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(qid, u.id, titre, category, emoji, difficulty, 'fr', JSON.stringify(propres), code,
        sources ? JSON.stringify(sources) : null, sources ? 1 : 0).run();

      payload = {
        done: true, titre, lien: `/s/${code}`,
        questions: propres.length, demandees: count, type,
        apercu: propres.map((q) => ({ q: q.question, r: q.options[q.correct] })),
      };
    } catch (e) {
      payload = { done: true, error: e.message };
    }
    await c.env.KV.put(`export:${id}`, JSON.stringify(payload), { expirationTtl: 21600 });
  })());

  return c.json({ started: true, id });
});

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

// ===========================================================================
// Console d'administration — réservée au compte propriétaire.
// La protection est ici, côté serveur : cacher le bouton ne protège rien.
// ===========================================================================
const admin = async (c, next) => {
  const user = c.get('user');
  const u = await c.env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(user.id).first();
  if (!u?.is_admin) return c.json({ error: 'Accès réservé' }, 403);
  await next();
};

app.get('/api/admin/overview', auth, admin, async (c) => c.json(await overview(c.env)));

app.get('/api/admin/quizzes', auth, admin, async (c) => c.json(await listQuizzes(c.env, {
  q: c.req.query('q') || '',
  category: c.req.query('cat') || '',
  page: Math.max(0, parseInt(c.req.query('page')) || 0),
  perPage: Math.min(100, parseInt(c.req.query('per')) || 25),
})));

// Consulter n'importe quel quiz, y compris ceux des autres joueurs.
app.get('/api/admin/quiz/:id', auth, admin, async (c) => {
  const q = await c.env.DB.prepare(
    `SELECT q.*, u.email, u.name AS auteur FROM quizzes q
       LEFT JOIN users u ON u.id = q.user_id WHERE q.id = ?`
  ).bind(c.req.param('id')).first();
  if (!q) return c.json({ error: 'Quiz introuvable' }, 404);
  return c.json({ quiz: { ...q, questions: JSON.parse(q.questions), sources: q.sources ? JSON.parse(q.sources) : null } });
});

app.delete('/api/admin/quiz/:id', auth, admin, async (c) => {
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

app.get('/api/admin/users', auth, admin, async (c) => c.json(await listUsers(c.env)));

// Changer le plan d'un joueur ou lui offrir des créations.
app.post('/api/admin/user/:id', auth, admin, async (c) => {
  const { plan, bonus, resetQuota } = await c.req.json().catch(() => ({}));
  const id = c.req.param('id');
  if (plan && ['free', 'premium', 'event'].includes(plan)) {
    await c.env.DB.prepare('UPDATE users SET plan = ?, plan_expires = NULL WHERE id = ?').bind(plan, id).run();
  }
  if (Number.isInteger(bonus)) {
    await c.env.DB.prepare('UPDATE users SET bonus_ai = MAX(0, bonus_ai + ?) WHERE id = ?').bind(bonus, id).run();
  }
  if (resetQuota) {
    await c.env.DB.prepare('DELETE FROM ai_usage WHERE user_id = ? AND month = ?').bind(id, monthKey()).run();
  }
  return c.json({ ok: true });
});

app.get('/api/admin/bank', auth, admin, async (c) => c.json(await bankStats(c.env)));
app.get('/api/admin/errors', auth, admin, async (c) => c.json(await listErrors(c.env)));

app.delete('/api/admin/errors', auth, admin, async (c) => {
  await c.env.DB.prepare('DELETE FROM app_errors').run();
  return c.json({ ok: true });
});

// --- Vidéos : suivi de ce qui est produit et de ce qui est publié -----------
app.get('/api/admin/videos', auth, admin, async (c) => c.json(await listVideos(c.env)));

app.post('/api/admin/videos', auth, admin, async (c) => {
  const { quizId = null, title, platform = 'youtube', status = 'a_publier', url = null, note = null } = await c.req.json().catch(() => ({}));
  if (!title) return c.json({ error: 'Titre manquant' }, 400);
  const id = randomHex(8);
  await c.env.DB.prepare(
    'INSERT INTO videos (id, quiz_id, title, platform, status, url, note) VALUES (?,?,?,?,?,?,?)'
  ).bind(id, quizId, title.slice(0, 160), platform, status, url, note).run();
  return c.json({ ok: true, id }, 201);
});

app.post('/api/admin/video/:id', auth, admin, async (c) => {
  const { status, url, note } = await c.req.json().catch(() => ({}));
  const published = status === 'publie' ? "datetime('now')" : 'published_at';
  await c.env.DB.prepare(
    `UPDATE videos SET status = COALESCE(?, status), url = COALESCE(?, url),
            note = COALESCE(?, note), published_at = ${published} WHERE id = ?`
  ).bind(status || null, url || null, note || null, c.req.param('id')).run();
  return c.json({ ok: true });
});

app.delete('/api/admin/video/:id', auth, admin, async (c) => {
  await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// --- Coffre à identifiants --------------------------------------------------
app.get('/api/admin/settings', auth, admin, async (c) => {
  const out = [];
  for (const cred of CREDENTIALS) {
    const v = await getSetting(c.env, cred.key);
    out.push({ ...cred, rempli: !!v, apercu: maskValue(cred.key, v) });
  }
  return c.json({ identifiants: out });
});

app.post('/api/admin/settings', auth, admin, async (c) => {
  const { key, value } = await c.req.json().catch(() => ({}));
  if (!CREDENTIALS.some((x) => x.key === key)) return c.json({ error: 'Clé inconnue' }, 400);
  await setSetting(c.env, key, value ?? '');
  return c.json({ ok: true });
});

// --- Argent, audience, infrastructure ---------------------------------------
// Chaque bloc est appelé séparément : une intégration lente ou en panne ne doit
// pas empêcher les autres de s'afficher.
app.get('/api/admin/gumroad', auth, admin, async (c) => c.json(await gumroadStats(c.env)));
app.get('/api/admin/youtube', auth, admin, async (c) => c.json(await youtubeStats(c.env)));
app.get('/api/admin/cloudflare', auth, admin, async (c) => c.json(await cloudflareStats(c.env)));
app.get('/api/admin/github', auth, admin, async (c) => c.json(await githubStats(c.env)));

// Relancer l'export de la banque vers GitHub à la demande.
app.post('/api/admin/export', auth, admin, async (c) => {
  const id = randomHex(4);
  c.executionCtx.waitUntil((async () => {
    let payload;
    try { payload = { done: true, ...(await exportBank(c.env)) }; }
    catch (e) { payload = { done: true, error: e.message }; await logError(c.env, 'export', e.message); }
    await c.env.KV.put(`export:${id}`, JSON.stringify(payload), { expirationTtl: 3600 });
  })());
  return c.json({ started: true, id });
});

app.get('/api/admin/export/:id', auth, admin, async (c) => {
  const raw = await c.env.KV.get(`export:${c.req.param('id')}`);
  return raw ? c.json(JSON.parse(raw)) : c.json({ done: false });
});

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) return c.json({ error: 'Not Found' }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

// --- Banc d'essai en production --------------------------------------------
//
// Le catalogue musical n'est pas joignable depuis l'environnement de
// développement : la seule façon d'éprouver une ambiance sur de vraies données
// est de la faire tourner là où l'application tourne. Une tâche déposée dans la
// table `banc` est exécutée à la minuterie suivante et son résultat y est
// réécrit. C'est ce qui permet de contrôler un blind test sans demander à
// personne de le tester à notre place.
async function executerBanc(env) {
  const t = await env.DB.prepare("SELECT * FROM banc WHERE etat = 'attente' ORDER BY cree_le LIMIT 1").first();
  if (!t) return;
  await env.DB.prepare("UPDATE banc SET etat = 'encours' WHERE id = ?").bind(t.id).run();
  let res;
  try {
    const params = JSON.parse(t.params || '{}');
    if (t.tache === 'blindtest') {
      const sortie = {};
      const themes = (params.themes || []).slice(0, 5);
      const combien = params.count || 10;
      const budget = Math.max(4, Math.floor(30 / Math.max(1, themes.length)));
      for (const theme of themes) {
        const pistes = await fetchThemeTracks(theme, 60, combien, budget);
        const vus = new Set();
        const pool = [];
        for (const x of shuffle(pistes)) {
          const k = cleMorceau(x);
          if (vus.has(k)) continue;
          vus.add(k); pool.push(x);
        }
        // Le banc produit exactement ce que produirait l'application : les
        // questions complètes, propositions comprises.
        const questions = construireBlindTest(pool, pool.slice(0, Math.min(combien, pool.length)));
        sortie[theme] = {
          vivier: pool.length,
          questions: questions.map((q) => ({
            bonne: q.options[q.correct],
            leurres: q.options.filter((_, i) => i !== q.correct),
            extrait: !!q.audioUrl,
          })),
        };
      }
      res = sortie;
    } else if (t.tache === 'blindtest_save') {
      // Génère un blind test et l'enregistre dans un compte, comme si la
      // personne l'avait créé elle-même depuis l'application.
      const u = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(params.email).first();
      if (!u) throw new Error('compte introuvable');
      const themes = (params.themes || []).slice(0, 3);
      const combien = params.count || 12;
      const budget = Math.max(4, Math.floor(30 / Math.max(1, themes.length)));
      const pistes = (await Promise.all(themes.map((th) => fetchThemeTracks(th, 60, combien, budget)))).flat();
      const vus = new Set();
      const pool = [];
      for (const x of shuffle(pistes)) {
        const k = cleMorceau(x);
        if (vus.has(k)) continue;
        vus.add(k); pool.push(x);
      }
      if (pool.length < 4) throw new Error('pas assez de morceaux');
      const questions = construireBlindTest(pool, pool.slice(0, Math.min(combien, pool.length)));
      const id = randomHex(10);
      const code = shareCode();
      await env.DB.prepare(
        'INSERT INTO quizzes (id, user_id, title, category, emoji, difficulty, language, questions, share_code, sources, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(id, u.id, String(params.titre || `🎧 Blind test : ${themes.join(', ')}`).slice(0, 100),
        'blindtest', '🎧', 'medium', 'fr', JSON.stringify(questions), code, null, 0).run();
      res = { id, titre: params.titre, morceaux: questions.length, liste: questions.map((q) => q.options[q.correct]) };
    } else {
      res = { erreur: 'tache inconnue' };
    }
  } catch (e) {
    res = { erreur: String((e && e.message) || e) };
  }
  await env.DB.prepare("UPDATE banc SET etat = 'fait', resultat = ? WHERE id = ?")
    .bind(JSON.stringify(res).slice(0, 200000), t.id).run();
}

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Chaque minuterie a sa mission : sans ce test, la revérification des
    // licences et la publication de la banque tourneraient toutes les
    // deux minutes.
    if (event.cron === '*/2 * * * *') {
      ctx.waitUntil(executerBanc(env));
      return;
    }
    ctx.waitUntil(reverifyAll(env));
    // Publication nocturne de la banque de questions vers GitHub (un commit/nuit).
    ctx.waitUntil(exportBank(env).catch(() => {}));
  },
};
