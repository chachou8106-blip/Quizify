// ---------------------------------------------------------------------------
// Export nocturne de la banque de questions vers GitHub, un fichier par catégorie.
//
// C'est la matière première publiable : Shorts YouTube, packs Gumroad, pages SEO.
// Un seul commit par nuit (pas un commit par quiz), et uniquement des questions
// sur le monde — les quiz bâtis sur des anecdotes personnelles n'entrent jamais
// dans la banque, donc rien de privé ne peut arriver ici.
//
// Le jeton GitHub est lu dans la table `settings` (clé `github_token`). Tant
// qu'il n'est pas renseigné, l'export se met simplement en veille.
// ---------------------------------------------------------------------------

const REPO = 'chachou8106-blip/Quizify';
const BRANCH = 'main';
const UA = 'Quizzalo-bank-export';

async function gh(token, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function slug(s) {
  return String(s || 'divers')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'divers';
}

// Base64 sûr pour l'UTF-8 (les accents cassent un btoa naïf).
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function exportBank(env, { dryRun = false } = {}) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('github_token').first();
  const token = row?.value || null;
  if (!token && !dryRun) return { skipped: 'aucun jeton GitHub enregistré' };

  const rows = await env.DB.prepare(
    `SELECT category, topic_label, type, difficulty, language, question, options,
            correct, explanation, source_url, source_title, created_at
       FROM question_bank ORDER BY category, created_at`
  ).all();
  const all = rows.results || [];
  if (!all.length) return { skipped: 'banque vide' };

  // Regroupement par catégorie
  const byCat = new Map();
  for (const r of all) {
    const key = slug(r.category);
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push({
      sujet: r.topic_label,
      style: r.type,
      difficulte: r.difficulty,
      langue: r.language,
      question: r.question,
      reponses: JSON.parse(r.options),
      bonneReponse: r.correct,
      explication: r.explanation || '',
      pourAllerPlusLoin: r.source_url ? { titre: r.source_title, lien: r.source_url } : null,
      ajoutee: r.created_at,
    });
  }

  const files = [];
  for (const [cat, questions] of byCat) {
    files.push({
      path: `banque/${cat}.json`,
      content: JSON.stringify({ categorie: cat, nombre: questions.length, questions }, null, 2),
    });
  }
  files.push({
    path: 'banque/README.md',
    content: [
      '# Banque de questions Quizzalo',
      '',
      `Export automatique. ${all.length} question(s) réparties sur ${byCat.size} catégorie(s).`,
      '',
      '| Catégorie | Questions |',
      '| --- | ---: |',
      ...[...byCat.entries()].map(([c, q]) => `| ${c} | ${q.length} |`),
      '',
      'Chaque question a été contrôlée avant d\'entrer ici, et aucune n\'est en double.',
      'Les quiz personnels (anecdotes sur de vraies personnes) ne sont jamais exportés.',
    ].join('\n'),
  });

  if (dryRun) return { files: files.map((f) => ({ path: f.path, bytes: f.content.length })), total: all.length };

  // Un seul commit : blobs → arbre → commit → déplacement de la branche.
  const ref = await gh(token, `/git/ref/heads/${BRANCH}`);
  const parent = ref.object.sha;
  const parentCommit = await gh(token, `/git/commits/${parent}`);

  const tree = [];
  for (const f of files) {
    const blob = await gh(token, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: b64(f.content), encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = await gh(token, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }),
  });

  // Rien n'a changé depuis hier : pas de commit vide.
  if (newTree.sha === parentCommit.tree.sha) return { unchanged: true, total: all.length };

  const commit = await gh(token, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: `Banque de questions : ${all.length} questions, ${byCat.size} catégories`,
      tree: newTree.sha,
      parents: [parent],
    }),
  });
  await gh(token, `/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { committed: commit.sha.slice(0, 10), total: all.length, categories: byCat.size };
}
