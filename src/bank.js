// ---------------------------------------------------------------------------
// Banque de questions mondiale — anti-doublon
//
// Principe : chaque question générée par n'importe quel joueur, dans n'importe
// quelle catégorie et n'importe quel type de jeu, est rangée dans une banque
// commune avec une EMPREINTE calculée sur son texte normalisé.
//
// 1. Deux questions équivalentes donnent la même empreinte → un doublon ne peut
//    pas entrer dans la banque, même formulé différemment.
// 2. On mémorise ce que chaque joueur a déjà vu → il ne retombe jamais dessus.
// 3. Quand on crée un quiz, on sert d'abord des questions inédites tirées de la
//    banque, et on ne fabrique que ce qui manque. Plus l'application tourne,
//    plus les quiz sont variés — et moins ils coûtent cher à produire.
//
// Les quiz bâtis sur des anecdotes personnelles (mode Anniversaire) n'entrent
// JAMAIS dans la banque : ils parlent de vraies personnes.
// ---------------------------------------------------------------------------

// Normalisation agressive : accents, ponctuation, pluriels courants et mots
// vides sautent, pour que « Qui a peint la Joconde ? » et « La Joconde a été
// peinte par qui ? » se ressemblent le plus possible.
const STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'a', 'au', 'aux',
  'et', 'ou', 'en', 'est', 'ce', 'cet', 'cette', 'qui', 'que', 'quoi', 'quel',
  'quelle', 'quels', 'quelles', 'dans', 'par', 'pour', 'sur', 'avec', 'son',
  'sa', 'ses', 'il', 'elle', 'on', 'y', 'ne', 'pas', 'plus', 'the', 'of', 'is',
]);

function words(s) {
  return String(s || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

// Empreinte : les mots significatifs de la question + la bonne réponse, triés.
// Le tri rend l'empreinte insensible à l'ordre des mots, donc à la reformulation.
export async function fingerprint(question, answer) {
  const core = [...words(question)].sort().join(' ');
  const good = words(answer).sort().join(' ');
  const buf = new TextEncoder().encode(`${core}|${good}`);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Clé de sujet : « Les années 80 !! » et « les annees 80 » désignent le même rayon.
export function topicKey(topic) {
  return words(topic).sort().join('-').slice(0, 120) || 'divers';
}

// Deuxième garde-fou, plus robuste que l'empreinte : la clé de réponse.
// « Qui a peint la Joconde ? » et « La Joconde a été peinte par qui ? » n'ont pas
// le même texte, mais elles ont le même sujet ET la même réponse — c'est donc la
// même question déguisée. Un joueur ne reçoit jamais deux fois la même réponse
// sur un même sujet, ce qui élimine les reformulations que le hachage laisse passer.
export async function answerKey(topic, answer) {
  const buf = new TextEncoder().encode(`${topicKey(topic)}|${words(answer).sort().join(' ')}`);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintAll(questions, topic = '') {
  return Promise.all(questions.map(async (q) => {
    const good = q.options?.[q.correct] ?? '';
    return {
      ...q,
      fp: await fingerprint(q.question, good),
      ak: await answerKey(topic, good),
    };
  }));
}

// --- Tirage : des questions de ce sujet que CE joueur n'a jamais vues ---------
export async function drawUnseen(env, { userId, topic, type, difficulty, language = 'fr', limit }) {
  if (!limit || limit < 1) return [];
  try {
    // Ni la question, ni sa réponse ne doivent avoir déjà été servies à ce joueur.
    const rows = await env.DB.prepare(
      `SELECT b.fp, b.ak, b.question, b.options, b.correct, b.explanation, b.source_url, b.source_title
         FROM question_bank b
         LEFT JOIN question_seen s ON s.fp = b.fp AND s.user_id = ?
         LEFT JOIN answer_seen  a ON a.ak = b.ak AND a.user_id = ?
        WHERE b.topic_key = ? AND b.type = ? AND b.difficulty = ? AND b.language = ?
          AND s.fp IS NULL AND a.ak IS NULL
        GROUP BY b.ak
        ORDER BY b.served ASC, RANDOM()
        LIMIT ?`
    ).bind(userId, userId, topicKey(topic), type, difficulty, language, limit).all();
    return (rows.results || []).map((r) => ({
      fp: r.fp,
      ak: r.ak,
      question: r.question,
      options: JSON.parse(r.options),
      correct: r.correct,
      explanation: r.explanation || '',
      sourceUrl: r.source_url || null,
      sourceTitle: r.source_title || null,
      fromBank: true,
    }));
  } catch {
    return [];
  }
}

// --- Quelles empreintes existent déjà ? (pour rejeter les doublons) ----------
export async function knownFingerprints(env, fps) {
  if (!fps.length) return new Set();
  try {
    const marks = fps.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT fp FROM question_bank WHERE fp IN (${marks})`
    ).bind(...fps).all();
    return new Set((rows.results || []).map((r) => r.fp));
  } catch {
    return new Set();
  }
}

// --- Rangement des nouvelles questions dans la banque ------------------------
export async function storeQuestions(env, questions, meta) {
  const fresh = questions.filter((q) => q.fp && !q.fromBank);
  if (!fresh.length) return;
  const { category = 'culture', topic = '', type = 'multipleChoice', difficulty = 'medium', language = 'fr', source = null } = meta;
  const key = topicKey(topic);
  try {
    await env.DB.batch(fresh.map((q) => env.DB.prepare(
      `INSERT OR IGNORE INTO question_bank
         (fp, ak, category, topic_key, topic_label, type, difficulty, language, question, options, correct, explanation, source_url, source_title, sourced)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      q.fp, q.ak || null, category, key, String(topic).slice(0, 120), type, difficulty, language,
      q.question, JSON.stringify(q.options), q.correct, q.explanation || '',
      source?.url || null, source?.title || null, source ? 1 : 0
    )));
  } catch { /* la banque est un bonus : jamais bloquante */ }
}

// --- Mémoire du joueur ------------------------------------------------------
export async function markSeen(env, userId, questions) {
  const fps = questions.map((q) => q.fp).filter(Boolean);
  const aks = [...new Set(questions.map((q) => q.ak).filter(Boolean))];
  if (!userId || !fps.length) return;
  try {
    await env.DB.batch([
      ...fps.map((fp) => env.DB.prepare('INSERT OR IGNORE INTO question_seen (user_id, fp) VALUES (?,?)').bind(userId, fp)),
      ...aks.map((ak) => env.DB.prepare('INSERT OR IGNORE INTO answer_seen (user_id, ak) VALUES (?,?)').bind(userId, ak)),
      ...fps.map((fp) => env.DB.prepare('UPDATE question_bank SET served = served + 1 WHERE fp = ?').bind(fp)),
    ]);
  } catch { /* non bloquant */ }
}

// Quelles réponses ce joueur a-t-il déjà reçues sur ce sujet ?
export async function seenAnswerKeys(env, userId, aks) {
  const list = [...new Set(aks.filter(Boolean))];
  if (!userId || !list.length) return new Set();
  try {
    const marks = list.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT ak FROM answer_seen WHERE user_id = ? AND ak IN (${marks})`
    ).bind(userId, ...list).all();
    return new Set((rows.results || []).map((r) => r.ak));
  } catch {
    return new Set();
  }
}

// --- Blind tests : mêmes règles, appliquées aux morceaux ---------------------
export async function unseenTracks(env, userId, tracks, need) {
  if (!userId || !tracks.length) return tracks;
  try {
    const ids = tracks.map((t) => String(t.id));
    const marks = ids.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT track_id FROM track_seen WHERE user_id = ? AND track_id IN (${marks})`
    ).bind(userId, ...ids).all();
    const seen = new Set((rows.results || []).map((r) => r.track_id));
    const fresh = tracks.filter((t) => !seen.has(String(t.id)));
    // S'il n'y a plus assez d'inédits dans cette ambiance, on complète avec des
    // morceaux déjà entendus plutôt que de rendre une playlist trop courte.
    if (fresh.length >= need) return fresh;
    return [...fresh, ...tracks.filter((t) => seen.has(String(t.id)))];
  } catch {
    return tracks;
  }
}

export async function markTracksSeen(env, userId, tracks) {
  if (!userId || !tracks.length) return;
  try {
    await env.DB.batch(tracks.slice(0, 60).map((t) => env.DB.prepare(
      'INSERT OR IGNORE INTO track_seen (user_id, track_id) VALUES (?,?)'
    ).bind(userId, String(t.id))));
  } catch { /* non bloquant */ }
}
