// AI quiz generation via Cloudflare Workers AI — robust JSON output, normalized format.
// Normalized question: { question, options: [..], correct: <index>, explanation }

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export const CATEGORIES = {
  culture: { name: 'Culture Générale', emoji: '🌍', color: '#3B82F6' },
  music: { name: 'Musique', emoji: '🎵', color: '#9333EA' },
  cinema: { name: 'Cinéma & Séries', emoji: '🎬', color: '#EC4899' },
  sport: { name: 'Sport', emoji: '⚽', color: '#10B981' },
  science: { name: 'Science', emoji: '🔬', color: '#F59E0B' },
  history: { name: 'Histoire', emoji: '🏛️', color: '#8B5CF6' },
  languages: { name: 'Langues', emoji: '🗣️', color: '#EF4444' },
  gaming: { name: 'Jeux Vidéo', emoji: '🎮', color: '#06B6D4' },
  food: { name: 'Cuisine', emoji: '🍳', color: '#F97316' },
  travel: { name: 'Voyages', emoji: '✈️', color: '#84CC16' },
  geo: { name: 'Géographie', emoji: '🗺️', color: '#14B8A6' },
  animals: { name: 'Animaux & Nature', emoji: '🐾', color: '#22C55E' },
  tech: { name: 'High-Tech & Web', emoji: '💻', color: '#6366F1' },
  litterature: { name: 'Littérature & BD', emoji: '📚', color: '#A16207' },
  art: { name: 'Art & Mode', emoji: '🎨', color: '#DB2777' },
  stars: { name: 'Célébrités', emoji: '🌟', color: '#EAB308' },
  kids: { name: 'Spécial Enfants', emoji: '🧸', color: '#FB7185' },
  retro: { name: 'Années 80/90/2000', emoji: '📼', color: '#7C3AED' },
  birthday: { name: 'Anniversaire', emoji: '🎂', color: '#F43F5E' },
  blindtest: { name: 'Blind Test', emoji: '🎧', color: '#0EA5E9' },
};

const DIFF_LABEL = { easy: 'facile (grand public, réponses évidentes pour qui connaît un peu le sujet)', medium: 'moyen (il faut bien connaître le sujet)', hard: 'difficile (pour experts, détails pointus)' };

function buildPrompt({ topic, category, type, count, difficulty, language, personalFacts }) {
  const lang = language === 'en' ? 'English' : 'français';
  const cat = CATEGORIES[category]?.name || 'Culture Générale';
  const diff = DIFF_LABEL[difficulty] || DIFF_LABEL.medium;

  let subject;
  if (personalFacts) {
    subject = `Ce quiz est un quiz PERSONNALISÉ sur une personne, pour une fête. Voici des anecdotes et faits fournis sur cette personne — chaque question DOIT être basée uniquement sur ces faits (n'invente RIEN d'autre sur la personne, mais invente des mauvaises réponses plausibles et drôles) :\n${personalFacts}`;
  } else {
    subject = `Sujet du quiz : ${topic}\nCatégorie : ${cat}`;
  }

  const TYPE_RULES = {
    trueFalse: `Chaque question est une affirmation Vrai/Faux : "options" doit être exactement ["Vrai","Faux"] (ou ["True","False"] en anglais) et "correct" est 0 (vrai) ou 1 (faux).`,
    emoji: `C'est un quiz DEVINETTE EMOJI : le champ "question" contient UNIQUEMENT une suite de 3 à 6 emojis représentant un film, une chanson, un livre, une expression ou un objet lié au sujet (ex: "🦁👑🌍" pour Le Roi Lion). Les 4 "options" sont des titres/noms plausibles, une seule correcte. Varie la position de la bonne réponse.`,
    riddle: `C'est un quiz "QUI SUIS-JE ?" : le champ "question" contient 3 indices progressifs (du plus vague au plus précis) séparés par " • ", se terminant par "Qui suis-je ?". Les 4 "options" sont des personnes/personnages/objets plausibles, une seule correcte. Varie la position de la bonne réponse.`,
    multipleChoice: `Chaque question a exactement 4 options plausibles, une seule correcte. Varie la position de la bonne réponse ("correct" entre 0 et 3).`,
  };
  const typeRules = TYPE_RULES[type] || TYPE_RULES.multipleChoice;

  return `Tu es un créateur de quiz expert et amusant. Génère EXACTEMENT ${count} questions de quiz en ${lang}.
${subject}
Difficulté : ${diff}
${typeRules}
Ajoute pour chaque question une courte "explanation" (1 phrase, instructive ou drôle).
Les questions doivent être variées, factuellement correctes, sans répétition, formulées de façon vivante.
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, au format :
[{"question":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}]`;
}

function extractText(res) {
  if (typeof res === 'string') return res;
  if (typeof res?.response === 'string') return res.response;
  if (typeof res?.result === 'string') return res.result;
  const c = res?.choices?.[0];
  if (typeof c?.message?.content === 'string') return c.message.content;
  if (typeof c?.text === 'string') return c.text;
  // Some models return an already-parsed object/array
  if (res?.response && typeof res.response === 'object') return JSON.stringify(res.response);
  return JSON.stringify(res ?? '');
}

function extractJSON(text) {
  // Strip code fences, find outermost array
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1) throw new Error('no-json');
  if (end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through to salvage */ }
  }
  return salvageObjects(cleaned.slice(start));
}

// Salvage individual {...} objects from truncated or slightly invalid JSON.
function salvageObjects(text) {
  const out = [];
  let depth = 0, objStart = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { if (depth === 0) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { out.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* skip bad object */ }
        objStart = -1;
      }
    }
  }
  if (out.length === 0) throw new Error('no-json');
  return out;
}

function normalize(raw, type) {
  if (!Array.isArray(raw)) throw new Error('not-array');
  const out = [];
  for (const q of raw) {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) continue;
    let options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : null;
    let correct = Number.isInteger(q.correct) ? q.correct : null;
    // Tolerate {answer: "text"} style
    if (correct === null && options && typeof q.answer === 'string') {
      const idx = options.findIndex((o) => o.trim().toLowerCase() === q.answer.trim().toLowerCase());
      if (idx >= 0) correct = idx;
    }
    if (type === 'trueFalse') {
      if (!options || options.length !== 2) options = ['Vrai', 'Faux'];
      if (correct === null && typeof q.answer === 'boolean') correct = q.answer ? 0 : 1;
    }
    if (!options || options.length < 2 || correct === null || correct < 0 || correct >= options.length) continue;
    out.push({
      question: q.question.trim(),
      options,
      correct,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    });
  }
  if (out.length === 0) throw new Error('no-valid-questions');
  return out;
}

export async function generateQuestions(env, opts) {
  const prompt = buildPrompt(opts);
  const count = Math.min(Math.max(parseInt(opts.count) || 5, 1), 20);

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'Tu réponds uniquement en JSON valide, sans aucun texte hors du JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: attempt === 0 ? 0.7 : 0.4,
      });
      const text = extractText(res);
      const questions = normalize(extractJSON(text), opts.type);
      // Accept a partial batch rather than failing (e.g. 7/10 questions)
      if (questions.length >= Math.min(3, count)) return questions.slice(0, count);
      throw new Error(`seulement ${questions.length} question(s) valides`);
    } catch (e) {
      lastErr = e;
      // brief pause before retrying (transient AI capacity errors)
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw new Error(lastErr?.message || 'erreur inconnue');
}
