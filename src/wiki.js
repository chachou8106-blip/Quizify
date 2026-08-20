// Sources de vérité externes : Wikipédia (encyclopédie) et Wiktionnaire (dictionnaire).
// Gratuites, sans clé d'API. Utilisées pour ANCRER les questions dans des faits réels
// au lieu de les laisser sortir de la mémoire (faillible) du modèle.

const UA = 'Quizzalo/1.0 (application de quiz educatif)';

async function wapi(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function normText(s) {
  return String(s)
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// --- Wikipédia : récupère de vrais extraits d'articles liés au sujet ---
export async function wikiContext(env, topic, { maxArticles = 3, chars = 2000 } = {}) {
  const key = `wiki:${normText(topic).slice(0, 80)}`;
  try {
    const hit = await env.KV.get(key);
    if (hit) return JSON.parse(hit);
  } catch { /* cache indisponible */ }

  const search = await wapi('fr.wikipedia.org', {
    action: 'query', list: 'search', srsearch: topic,
    srlimit: String(maxArticles), srnamespace: '0',
  });
  const titles = (search?.query?.search || []).map((s) => s.title).slice(0, maxArticles);
  if (!titles.length) return [];

  const data = await wapi('fr.wikipedia.org', {
    action: 'query', prop: 'extracts', explaintext: '1', exintro: '1',
    exlimit: 'max', titles: titles.join('|'), redirects: '1',
  });
  const pages = Object.values(data?.query?.pages || {});
  const out = pages
    .filter((p) => p.extract && p.extract.length > 200)
    .map((p) => ({
      title: p.title,
      extract: p.extract.replace(/\s+/g, ' ').slice(0, chars),
      url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
    }));

  try { await env.KV.put(key, JSON.stringify(out), { expirationTtl: 86400 }); } catch { /* ignore */ }
  return out;
}

// Une réponse est « soutenue » par la source si elle y figure (littéralement,
// ou par tous ses mots significatifs).
export function answerSupported(answer, ctxNorm) {
  const a = normText(answer);
  if (!a || a.length < 2) return false;
  if (ctxNorm.includes(a)) return true;
  const words = a.split(' ').filter((w) => w.length > 3);
  return words.length > 0 && words.every((w) => ctxNorm.includes(w));
}

// --- Wiktionnaire : le mot existe-t-il vraiment en français ? ---
// Vérifie un lot de mots en un seul appel. Renvoie l'ensemble des mots trouvés.
export async function wiktionaryFilter(words) {
  if (!words.length) return new Set();
  const variants = new Map(); // titre testé -> mot d'origine
  for (const w of words.slice(0, 25)) {
    const lower = w.toLowerCase();
    const cap = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    variants.set(lower, w);
    variants.set(cap, w);
  }
  const data = await wapi('fr.wiktionary.org', {
    action: 'query', titles: [...variants.keys()].join('|'), redirects: '1',
  });
  const found = new Set();
  const pages = data?.query?.pages || {};
  // Les titres normalisés par l'API doivent être remappés
  const normalized = new Map((data?.query?.normalized || []).map((n) => [n.to, n.from]));
  for (const [id, page] of Object.entries(pages)) {
    if (Number(id) > 0 && page.title) {
      const original = variants.get(page.title) || variants.get(normalized.get(page.title));
      if (original) found.add(original);
    }
  }
  return found;
}
