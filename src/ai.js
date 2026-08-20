// AI quiz generation via Cloudflare Workers AI — robust JSON output, normalized format.
// Normalized question: { question, options: [..], correct: <index>, explanation }

import { wikiContext, answerSupported, normText, wiktionaryFilter } from './wiki';

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
  space: { name: 'Espace & Astronomie', emoji: '🌌', color: '#4338CA' },
  body: { name: 'Corps Humain & Santé', emoji: '🫀', color: '#DC2626' },
  mythology: { name: 'Mythologie', emoji: '⚡', color: '#B45309' },
  tv: { name: 'Télé & Émissions', emoji: '📺', color: '#0891B2' },
  motors: { name: 'Auto & Moto', emoji: '🏎️', color: '#334155' },
  couples: { name: 'Couples & Mariage', emoji: '💍', color: '#E11D48' },
  birthday: { name: 'Anniversaire', emoji: '🎂', color: '#F43F5E' },
  blindtest: { name: 'Blind Test', emoji: '🎧', color: '#0EA5E9' },
};

const DIFF_LABEL = { easy: 'facile (grand public, réponses évidentes pour qui connaît un peu le sujet)', medium: 'moyen (il faut bien connaître le sujet)', hard: 'difficile (pour experts, détails pointus)' };

const TYPE_RULES = {
    trueFalse: `Chaque question est une affirmation Vrai/Faux : "options" doit être exactement ["Vrai","Faux"] (ou ["True","False"] en anglais) et "correct" est 0 (vrai) ou 1 (faux).`,
    emoji: `C'est un quiz DEVINETTE EMOJI : le champ "question" contient UNIQUEMENT une suite de 3 à 6 emojis représentant un film, une chanson, un livre, une expression ou un objet lié au sujet (ex: "🦁👑🌍" pour Le Roi Lion). Les 4 "options" sont des titres/noms plausibles, une seule correcte. Varie la position de la bonne réponse.`,
    riddle: `C'est un quiz "QUI SUIS-JE ?" : le champ "question" contient 3 indices progressifs (du plus vague au plus précis) séparés par " • ", se terminant par "Qui suis-je ?". Les 4 "options" sont des personnes/personnages/objets plausibles, une seule correcte. Varie la position de la bonne réponse.`,
    chrono: `C'est un quiz CHRONOLOGIE : chaque question demande lequel de 4 événements, œuvres, inventions ou personnages est arrivé/né/sorti EN PREMIER (ou en dernier — varie). Le champ "question" précise clairement ce qu'on cherche (ex: "Lequel de ces films est sorti en premier ?"). Une seule bonne réponse, position variée.`,
    intru: `C'est un quiz TROUVE L'INTRUS : chaque "question" commence par "Trouve l'intrus :" suivi du thème (ex: "Trouve l'intrus : ces artistes ont tous gagné un Grammy… sauf un !"). Les 4 "options" partagent toutes un point commun SAUF une (l'intrus = la bonne réponse). L'explication révèle le point commun.`,
    mixed: `C'est un MIX SURPRISE : alterne les styles entre QCM classique, affirmation Vrai/Faux (options ["Vrai","Faux"], correct 0 ou 1), devinette emoji (question = uniquement des emojis), "Qui suis-je ?" (3 indices progressifs), "Trouve l'intrus", citation ("Qui a dit ça ?") et "En quelle année ?". Aucun style ne doit se répéter plus de 2 fois d'affilée.`,
    quote: `C'est un quiz QUI A DIT ÇA ? : chaque "question" est une citation ou réplique célèbre RÉELLE entre guillemets « », liée au sujet. Les 4 "options" sont des personnes/personnages plausibles ; une seule a réellement dit ou écrit cette phrase. L'explication donne le contexte de la citation.`,
    anagram: `C'est un quiz ANAGRAMMES : chaque "question" est de la forme "Remets les lettres dans l'ordre : X-Y-Z" où les lettres MAJUSCULES séparées par des tirets sont le VRAI mélange des lettres d'un mot ou nom lié au sujet. Les 4 "options" sont des mots plausibles de longueur similaire ; une seule correspond exactement à ces lettres. Vérifie soigneusement que les lettres correspondent.`,
    year: `C'est un quiz EN QUELLE ANNÉE ? : chaque question demande l'année précise d'un événement marquant lié au sujet (sortie d'un film, victoire, invention…). Les 4 "options" sont des années proches et crédibles (ex: "1994","1996","1998","2001") ; une seule est exacte.`,
    math: `C'est un quiz CALCUL RAPIDE spécial soirée : chaque "question" est un petit calcul mental amusant et accessible (additions, multiplications simples, pourcentages faciles, petites énigmes numériques), si possible habillé avec le thème du sujet. 4 "options" numériques proches ; une seule correcte.`,
    multipleChoice: `Chaque question a exactement 4 options plausibles, une seule correcte. Varie la position de la bonne réponse ("correct" entre 0 et 3).`,
};

function buildTypeRules(type) { return TYPE_RULES[type] || TYPE_RULES.multipleChoice; }

function buildPrompt({ topic, category, type, count, difficulty, language, personalFacts, context }) {
  const lang = language === 'en' ? 'English' : 'français';
  const cat = CATEGORIES[category]?.name || 'Culture Générale';
  const diff = DIFF_LABEL[difficulty] || DIFF_LABEL.medium;

  let subject;
  if (personalFacts) {
    subject = `Ce quiz est un quiz PERSONNALISÉ sur une personne, pour une fête. Voici des anecdotes et faits fournis sur cette personne — chaque question DOIT être basée uniquement sur ces faits (n'invente RIEN d'autre sur la personne, mais invente des mauvaises réponses plausibles et drôles) :\n${personalFacts}`;
  } else if (category === 'free' || !CATEGORIES[category]) {
    // Sujet libre : aucune contrainte de catégorie, l'IA suit uniquement le sujet donné.
    subject = `Sujet du quiz (sujet libre, sans catégorie imposée) : ${topic}`;
  } else {
    subject = `Sujet du quiz : ${topic}\nCatégorie : ${cat}`;
  }


  const typeRules = buildTypeRules(type);

  // Documentation de référence (quand elle existe) : les faits doivent en provenir.
  const refBlock = context
    ? `\nDOCUMENTATION DE RÉFÉRENCE (fais reposer tous les faits sur ces extraits, n'invente aucun fait qui les contredise) :\n${context}\n`
    : '';

  return `Tu es un créateur de quiz expert et amusant. Génère EXACTEMENT ${count} questions de quiz en ${lang}.
${subject}${refBlock}
Difficulté : ${diff}
${typeRules}
Ajoute pour chaque question une courte "explanation" (1 phrase, instructive ou drôle).
Les questions doivent être variées, factuellement correctes, sans répétition, formulées de façon vivante.
Pour toute notation mathématique, utilise UNIQUEMENT les symboles Unicode : ², ³, ×, ÷, √, π, ½ — jamais ^, **, ni notation LaTeX.
Orthographe, accents et grammaire françaises impeccables.
INTERDIT : proposer deux options qui pourraient être toutes les deux correctes (deux noms d'une même chose, deux graphies d'un même mot, une réponse contestée par les spécialistes). En cas de doute sur un fait, choisis une autre question.
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

// Écriture mathématique propre : convertit ^2, **3, LaTeX… en ², ³, √, ×, ÷, π.
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const supNum = (n) => String(n).split('').map((d) => SUP[d] || d).join('');
function cleanMath(s) {
  if (typeof s !== 'string') return s;
  let t = s;
  t = t.replace(/\\\(|\\\)|\\\[|\\\]/g, '');                     // délimiteurs LaTeX
  t = t.replace(/\$+([^$]+)\$+/g, '$1');                          // $...$
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');       // fractions
  t = t.replace(/\\times/g, '×').replace(/\\cdot/g, '×').replace(/\\div/g, '÷').replace(/\\pi/g, 'π');
  t = t.replace(/\\sqrt\s*\{([^}]+)\}/g, '√($1)').replace(/\\sqrt/g, '√').replace(/\bsqrt\s*\(/gi, '√(');
  t = t.replace(/\*\*\s*(\d+)/g, (_, n) => supNum(n));            // x**2 → x²
  t = t.replace(/\^\s*\{?(\d+)\}?/g, (_, n) => supNum(n));        // x^2, x^{3} → x², x³
  t = t.replace(/(\d)\s*\*\s*(\d)/g, '$1 × $2');                  // 4*5 → 4 × 5
  return t;
}

// Deux options qui ne diffèrent que par la typographie (H²O vs H₂O), les accents ou
// la casse rendent la question inéquitable : on l'écarte.
const DIGIT_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
function optionKey(s) {
  return String(s)
    .replace(/[⁰-⁹₀-₉]/g, (d) => DIGIT_MAP[d] || d)
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
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
    // Anti-ambiguïté : aucune option ne doit être le doublon typographique d'une autre
    if (new Set(options.map(optionKey)).size !== options.length) continue;
    if (options.some((o) => !String(o).trim())) continue;
    out.push({
      question: cleanMath(q.question.trim()),
      options: options.map(cleanMath),
      correct,
      explanation: typeof q.explanation === 'string' ? cleanMath(q.explanation.trim()) : '',
    });
  }
  if (out.length === 0) throw new Error('no-valid-questions');
  return out;
}

// ---------- Calcul mental : généré par du code, jamais par l'IA → réponses garanties justes ----------

const rnd = (n) => Math.floor(Math.random() * n);
const between = (a, b) => a + rnd(b - a + 1);
const pick = (arr) => arr[rnd(arr.length)];

function mathItem(difficulty) {
  const easy = [
    () => { const a = between(2, 20), b = between(2, 20); return { q: `Combien font ${a} + ${b} ?`, a: a + b, e: `${a} + ${b} = ${a + b}` }; },
    () => { const a = between(8, 20), b = between(2, a - 1); return { q: `Combien font ${a} − ${b} ?`, a: a - b, e: `${a} − ${b} = ${a - b}` }; },
    () => { const a = between(2, 5), b = between(2, 10); return { q: `Combien font ${a} × ${b} ?`, a: a * b, e: `${a} × ${b} = ${a * b}` }; },
    () => { const n = between(2, 30); return { q: `Quel est le double de ${n} ?`, a: 2 * n, e: `${n} × 2 = ${2 * n}` }; },
    () => { const k = between(2, 20); return { q: `Quelle est la moitié de ${2 * k} ?`, a: k, e: `${2 * k} ÷ 2 = ${k}` }; },
  ];
  const medium = [
    () => { const a = between(3, 12), b = between(3, 12); return { q: `Combien font ${a} × ${b} ?`, a: a * b, e: `${a} × ${b} = ${a * b}` }; },
    () => { const b = between(2, 12), k = between(2, 12); return { q: `Combien font ${b * k} ÷ ${b} ?`, a: k, e: `${b * k} ÷ ${b} = ${k}` }; },
    () => { const k = between(2, 25); return { q: `Quel est le quart de ${4 * k} ?`, a: k, e: `${4 * k} ÷ 4 = ${k}` }; },
    () => { const k = between(2, 20); return { q: `Quel est le tiers de ${3 * k} ?`, a: k, e: `${3 * k} ÷ 3 = ${k}` }; },
    () => { const k = between(2, 40); return { q: `Combien font 50 % de ${2 * k} ?`, a: k, e: `50 % = la moitié : ${2 * k} ÷ 2 = ${k}` }; },
    () => { const k = between(2, 20); return { q: `Combien font 25 % de ${4 * k} ?`, a: k, e: `25 % = le quart : ${4 * k} ÷ 4 = ${k}` }; },
    () => { const k = between(2, 30); return { q: `Combien font 10 % de ${10 * k} ?`, a: k, e: `10 % : ${10 * k} ÷ 10 = ${k}` }; },
    () => { const a = between(25, 99), b = between(25, 99); return { q: `Combien font ${a} + ${b} ?`, a: a + b, e: `${a} + ${b} = ${a + b}` }; },
  ];
  const hard = [
    () => { const n = between(6, 15); return { q: `Combien font ${n}² ?`, a: n * n, e: `${n} × ${n} = ${n * n}` }; },
    () => { const n = between(4, 15); return { q: `Quelle est la racine carrée de ${n * n} (√${n * n}) ?`, a: n, e: `${n} × ${n} = ${n * n}, donc √${n * n} = ${n}` }; },
    () => { const n = between(3, 9); return { q: `Combien font ${n}³ ?`, a: n * n * n, e: `${n} × ${n} × ${n} = ${n * n * n}` }; },
    () => { const a = between(12, 29), b = between(3, 9); return { q: `Combien font ${a} × ${b} ?`, a: a * b, e: `${a} × ${b} = ${a * b}` }; },
    () => { const k = between(3, 30); return { q: `Combien font 20 % de ${5 * k} ?`, a: k, e: `20 % = un cinquième : ${5 * k} ÷ 5 = ${k}` }; },
    () => { const k = between(2, 20); return { q: `Combien font 75 % de ${4 * k} ?`, a: 3 * k, e: `75 % = trois quarts : (${4 * k} ÷ 4) × 3 = ${3 * k}` }; },
    () => { const k = between(2, 15); return { q: `Combien font les trois quarts de ${4 * k} ?`, a: 3 * k, e: `(${4 * k} ÷ 4) × 3 = ${3 * k}` }; },
  ];
  const pool = difficulty === 'easy' ? easy : difficulty === 'hard' ? hard : medium;
  return pick(pool)();
}

export function generateMathQuestions({ count = 8, difficulty = 'medium' }) {
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < count && guard++ < 300) {
    const { q, a, e } = mathItem(difficulty);
    if (seen.has(q)) continue;
    seen.add(q);
    // Distracteurs plausibles, uniques, jamais égaux à la bonne réponse
    const cands = [a + 1, a - 1, a + 2, a - 2, a + 10, a - 10, a * 2, Math.round(a / 2), a + 5, a - 5]
      .filter((x) => Number.isInteger(x) && x >= 0 && x !== a);
    const distractors = [...new Set(cands)].sort(() => Math.random() - 0.5).slice(0, 3);
    if (distractors.length < 3) continue;
    const options = [a, ...distractors].map(String).sort(() => Math.random() - 0.5);
    out.push({ question: q, options, correct: options.indexOf(String(a)), explanation: e });
  }
  return out;
}

// ---------- MODE RÉVISION : questions ancrées dans Wikipédia et vérifiées ----------
// L'IA ne puise plus dans sa mémoire : elle rédige à partir d'extraits encyclopédiques
// réels, et chaque bonne réponse doit se retrouver dans la source, sinon la question saute.

export async function generateVerifiedQuestions(env, { topic, count = 8, difficulty = 'medium', language = 'fr', type = 'multipleChoice' }) {
  const n = Math.min(Math.max(parseInt(count) || 8, 1), 40);
  const sources = await wikiContext(env, topic);
  if (!sources.length) {
    return { questions: [], sources: [], reason: 'Aucun article Wikipédia trouvé pour ce sujet.' };
  }
  const context = sources.map((s, i) => `[Source ${i + 1} : ${s.title}]\n${s.extract}`).join('\n\n');
  const ctxNorm = normText(context);
  const diff = DIFF_LABEL[difficulty] || DIFF_LABEL.medium;

  // On demande volontairement PLUS de questions que nécessaire : le filtre de vérification
  // en écarte une partie, et l'utilisateur doit malgré tout recevoir le nombre demandé.
  const perBatch = Math.min(Math.ceil(n * 1.7) + 2, 18);
  const target = Math.ceil(n * 1.7) + 2;

  const prompt = `Tu rédiges un quiz SCOLAIRE en ${language === 'en' ? 'anglais' : 'français'} à partir de sources encyclopédiques vérifiées (Wikipédia).

${context}

RÈGLES ABSOLUES :
1. Chaque question porte sur une information EXPLICITEMENT écrite dans les sources ci-dessus. N'utilise JAMAIS tes connaissances personnelles.
2. La bonne réponse doit être un mot ou une expression qui APPARAÎT tel quel dans les sources.
3. Les 3 mauvaises réponses sont de VRAIS termes existants, plausibles et de même nature (même type de mot, même ordre de grandeur). N'invente jamais un faux mot en dérivant la bonne réponse (« photosynthèse » → « respiration hybride » est INTERDIT).
4. JAMAIS deux options qui pourraient être toutes les deux correctes. Si la source donne deux noms pour une même chose (« dit X ou Y »), n'utilise pas cette information.
5. Questions COURTES et naturelles (15 mots maximum). Ne recopie pas la phrase de la source : reformule.
6. Orthographe, accents et grammaire irréprochables. Formulation claire pour un élève.
7. L'explication est brève (1 phrase) et s'appuie sur la source.
Difficulté : ${diff}.

STYLE DE QUESTION DEMANDÉ : ${buildTypeRules(type)}

Génère EXACTEMENT ${perBatch} questions (4 options, une seule correcte, position variée).
Réponds UNIQUEMENT avec un tableau JSON : [{"question":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}]`;

  // Budget de temps : on enchaîne les passes tant qu'il reste du temps, jamais au-delà.
  const started = Date.now();
  const DEADLINE = 38000;

  let candidates = [];
  for (let attempt = 0; attempt < 4 && candidates.length < target; attempt++) {
    if (attempt > 0 && Date.now() - started > DEADLINE) break;
    try {
      const extra = attempt === 0 ? '' : `\n\nATTENTION : porte ces questions sur des informations DIFFÉRENTES de celles-ci, déjà utilisées : ${candidates.slice(-12).map((c) => c.question).join(' | ')}`;
      const res = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'Tu réponds uniquement en JSON valide. Tu ne rédiges que des questions dont la réponse figure dans les sources fournies.' },
          { role: 'user', content: prompt + extra },
        ],
        max_tokens: 4096,
        temperature: attempt === 0 ? 0.5 : 0.6,
      });
      const batch = normalize(extractJSON(extractText(res)), 'multipleChoice');
      for (const q of batch) {
        if (candidates.some((c) => normText(c.question) === normText(q.question))) continue;
        candidates.push(q);
      }
    } catch { /* on retentera */ }
  }

  // Filtre de vérification : la bonne réponse doit être soutenue par la source,
  // et aucune mauvaise option ne doit être citée dans l'explication (signe d'ambiguïté,
  // ex. « dit le Grand ou le Roi-Soleil » où deux options seraient acceptables).
  const verified = [];
  const usedAnswers = new Set();
  for (const q of candidates) {
    const good = q.options[q.correct];
    if (!answerSupported(good, ctxNorm)) continue;
    // Pas deux questions différentes avec la même bonne réponse
    const answerKey = normText(good);
    if (usedAnswers.has(answerKey)) continue;
    usedAnswers.add(answerKey);
    const whyNorm = normText(q.explanation || '');
    const ambiguous = q.options.some((o, i) => {
      if (i === q.correct) return false;
      const on = normText(o);
      return on.length > 4 && whyNorm.includes(on);
    });
    if (ambiguous) continue;
    verified.push({ ...q, verified: true });
    // Marge de sécurité : le contrôle adverse ci-dessous en écartera encore quelques-unes.
    if (verified.length >= n + 4) break;
  }

  // Passe adverse : on demande explicitement quelles questions ont PLUSIEURS réponses
  // acceptables (ex. « quelle femme fut guillotinée ? » avec 3 femmes guillotinées en options).
  const clean = (await dropAmbiguous(env, verified, context)).slice(0, n);

  return {
    questions: clean,
    sources: sources.map((s) => ({ title: s.title, url: s.url })),
    asked: n,
  };
}

// Contrôle adverse : une seule requête, tâche étroite (juger, pas se souvenir).
async function dropAmbiguous(env, questions, context) {
  if (questions.length === 0) return questions;
  const list = questions.map((q, i) =>
    `${i}. ${q.question}\n   Options : ${q.options.join(' | ')}\n   Réponse retenue : ${q.options[q.correct]}`
  ).join('\n');
  const prompt = `Tu contrôles la qualité d'un quiz scolaire. Voici la source de référence :

${context}

Voici les questions :
${list}

Signale le NUMÉRO de toute question qui présente l'un de ces défauts :
- PLUSIEURS options pourraient être considérées comme correctes (question ambiguë) ;
- la réponse retenue est fausse ou contestée ;
- la question est incompréhensible ou mal orthographiée.
Sois strict : dans le doute, signale-la.
Réponds UNIQUEMENT avec un tableau JSON de numéros, par exemple [0,3]. Si tout est correct : [].`;
  try {
    const res = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'Tu réponds uniquement par un tableau JSON de nombres.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 256,
      temperature: 0,
    });
    const bad = extractJSON(extractText(res));
    if (!Array.isArray(bad)) return questions;
    const drop = new Set(bad.filter((x) => Number.isInteger(x)));
    const kept = questions.filter((_, i) => !drop.has(i));
    // Garde-fou : si le contrôleur rejette tout, on garde la version d'origine.
    return kept.length ? kept : questions;
  } catch {
    return questions;
  }
}

// ---------- Anagrammes : l'IA choisit les MOTS, le code fait tout le reste ----------
// (mélange réel des lettres, mot garanti complet, distracteurs par permutation → zéro erreur possible)

const FALLBACK_WORDS = ['CHOCOLAT', 'PAPILLON', 'MONTAGNE', 'ORCHESTRE', 'AVENTURE', 'CARNAVAL', 'TOURNESOL', 'HORIZON', 'MYSTERE', 'FUSEE', 'PIRATE', 'TRESOR', 'GALAXIE', 'CASCADE', 'BOUSSOLE', 'LANTERNE', 'VOLCAN', 'SIRENE', 'DRAGON', 'ETOILE'];

function stripAccents(s) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
}

function shuffleWord(word) {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

// Mélange garanti différent du mot original
function scrambled(word, avoid = new Set()) {
  for (let i = 0; i < 30; i++) {
    const s = shuffleWord(word);
    if (s !== word && !avoid.has(s)) return s;
  }
  return null;
}

export async function generateAnagramQuestions(env, { topic, count = 8, language = 'fr' }) {
  const n = Math.min(Math.max(parseInt(count) || 8, 1), 20);
  let raw = [];
  try {
    const res = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'Tu réponds uniquement en JSON valide, sans aucun texte hors du JSON.' },
        { role: 'user', content: `Donne EXACTEMENT ${n * 3} mots ${language === 'en' ? 'anglais' : 'français'} d'UN SEUL MOT (noms communs, sans espace, sans trait d'union, sans apostrophe), de 5 à 12 lettres, correctement orthographiés avec leurs accents, en rapport avec le sujet : « ${topic || 'culture générale'} ». Mots COMPLETS uniquement, jamais tronqués. Réponds UNIQUEMENT avec un tableau JSON de chaînes, ex: ["chocolat","montagne"].` },
      ],
      max_tokens: 1024,
      temperature: 0.6,
    });
    const arr = extractJSON(extractText(res));
    if (Array.isArray(arr)) {
      raw = arr.map((w) => String(w).trim())
        .filter((w) => /^[\p{L}]{5,12}$/u.test(w));
    }
  } catch { /* on utilisera la liste de secours */ }
  raw = [...new Set(raw)];

  // 📖 Vérification au Wiktionnaire : seuls les mots réellement attestés sont gardés.
  let words = [];
  if (raw.length) {
    try {
      const found = await wiktionaryFilter(raw);
      words = raw.filter((w) => found.has(w)).map((w) => stripAccents(w));
    } catch { /* dictionnaire injoignable */ }
  }
  words = [...new Set(words.filter((w) => w.length >= 5 && w.length <= 12))];
  if (words.length < n) words = [...words, ...FALLBACK_WORDS.filter((w) => !words.includes(w))];

  const out = [];
  for (const word of words) {
    if (out.length >= n) break;
    const used = new Set([word]);
    const shown = scrambled(word, used);
    if (!shown) continue; // lettres toutes identiques etc.
    used.add(shown);
    const distractors = [];
    for (let i = 0; i < 3; i++) {
      const d = scrambled(word, used);
      if (!d) break;
      used.add(d);
      distractors.push(d);
    }
    if (distractors.length < 3) continue;
    const options = [word, ...distractors].sort(() => Math.random() - 0.5);
    out.push({
      question: `Quel est le vrai mot caché dans ces lettres : ${shown.split('').join('-')} ?`,
      options,
      correct: options.indexOf(word),
      explanation: `Le mot était « ${word} ».`,
    });
  }
  return out;
}

// ---------- Passe de vérification : l'IA relit et corrige le quiz avant affichage ----------

async function verifyQuestions(env, questions, language) {
  const lang = language === 'en' ? 'English' : 'français';
  const prompt = `Tu es un vérificateur de quiz rigoureux. Voici un quiz en ${lang} au format JSON.
Pour CHAQUE question : vérifie que la réponse à l'index "correct" est factuellement EXACTE et que les autres options sont fausses.
- Si l'index "correct" pointe vers une mauvaise option alors qu'une autre option est la bonne, corrige l'index.
- Si la question est fausse, ambiguë ou invérifiable, SUPPRIME-la du tableau.
- Ne reformule pas les questions correctes, ne rajoute rien.
Réponds UNIQUEMENT avec le tableau JSON final (même format).
Quiz : ${JSON.stringify(questions)}`;
  const res = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: 'Tu réponds uniquement en JSON valide, sans aucun texte hors du JSON.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });
  const verified = normalize(extractJSON(extractText(res)), 'multipleChoice');
  return verified;
}

// ---------- Contre-épreuve indépendante ----------
// On refait passer le quiz « à l'aveugle » : la machine répond elle-même aux questions,
// sans savoir quelle réponse avait été retenue. Toute divergence = question écartée.
// C'est ce filtre qui rattrape les affirmations plausibles mais fausses
// (ex. « les lions chassent le jour ») sur les styles de quiz sans source encyclopédique.
async function crossCheck(env, questions) {
  if (!Array.isArray(questions) || questions.length < 2) return questions;
  const list = questions.map((q, i) =>
    `${i}. ${q.question}\n${q.options.map((o, j) => `   ${j}) ${o}`).join('\n')}`
  ).join('\n');
  const prompt = `Réponds à ce questionnaire. Pour chaque question, donne l'INDEX (0 à 3) de la seule réponse exacte.
Si tu n'es pas certain à 100 %, ou si plusieurs réponses peuvent convenir, réponds -1.

${list}

Réponds UNIQUEMENT par un tableau JSON d'entiers, un par question, dans l'ordre. Exemple : [2,0,-1,1]`;
  try {
    const res = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'Tu es un expert rigoureux. Tu réponds uniquement par un tableau JSON d\'entiers.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 512,
      temperature: 0,
    });
    const answers = extractJSON(extractText(res));
    if (!Array.isArray(answers) || answers.length !== questions.length) return questions;
    const kept = questions.filter((q, i) => answers[i] === q.correct);
    // Garde-fou : si la contre-épreuve rejette presque tout (modèle hésitant),
    // on préfère le quiz d'origine à un quiz vide.
    return kept.length >= Math.min(4, Math.ceil(questions.length / 2)) ? kept : questions;
  } catch {
    return questions;
  }
}

export async function generateQuestions(env, opts) {
  const count = Math.min(Math.max(parseInt(opts.count) || 5, 1), 20);
  // On en demande quelques-unes de plus : les contrôles en écartent toujours une partie,
  // et l'utilisateur doit recevoir le nombre de questions qu'il a demandé.
  const asked = Math.min(count + Math.ceil(count / 3) + 1, 20);
  const prompt = buildPrompt({ ...opts, count: asked });

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'Tu réponds uniquement en JSON valide, sans aucun texte hors du JSON. Ton contenu est toujours adapté à un public familial : jamais vulgaire, choquant ou inapproprié, drôle et bienveillant.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: attempt === 0 ? 0.7 : 0.4,
      });
      const text = extractText(res);
      let questions = normalize(extractJSON(text), opts.type);
      // Accept a partial batch rather than failing (e.g. 7/10 questions)
      if (questions.length < Math.min(3, count)) throw new Error(`seulement ${questions.length} question(s) valides`);
      questions = questions.slice(0, asked);
      // Passe de vérification : relecture factuelle avant affichage (sauf quiz personnalisés,
      // dont la vérité vient des anecdotes fournies par l'utilisateur).
      if (!opts.personalFacts) {
        try {
          const verified = await verifyQuestions(env, questions, opts.language);
          if (verified.length >= Math.min(3, questions.length)) questions = verified;
        } catch { /* en cas d'échec de la relecture, on garde la version initiale */ }
        // Contre-épreuve à l'aveugle : dernier filet avant affichage.
        questions = await crossCheck(env, questions);
      }
      return questions.slice(0, count);
    } catch (e) {
      lastErr = e;
      // brief pause before retrying (transient AI capacity errors)
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw new Error(lastErr?.message || 'erreur inconnue');
}
