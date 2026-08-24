// Filtres de qualité appliqués à toute question produite.
import { execSync } from 'child_process';
const paquet = '/tmp/quizzalo-ai2.mjs';
execSync(`npx esbuild src/ai.js --bundle --format=esm --platform=neutral --outfile=${paquet} --external:cloudflare:workers`, { stdio: 'pipe' });

const QUESTION_DICTIONNAIRE = /\btaxons?\b|\bnomenclature\b|\bsigle\b|\bacronyme\b|étymologi|que signifie l['’]abr|nom scientifique|nom latin|\ben latin\b|\bclades?\b|\bbinomin/i;
const UN_EMOJI = /\p{Extended_Pictographic}/gu;
const CITATION = /[«"“][^»"”]{8,}[»"”]/;

const ok = []; const ko = [];
const dit = (b, t) => { (b ? ok : ko).push(t); console.log(`${b ? '✅' : '❌'} ${t}`); };

const dico = [
  ['En quelle année le taxon des animaux a-t-il été créé par Linné ?', true],
  ['Que signifie le sigle OTAN ?', true],
  ['Quel est le nom latin du loup ?', true],
  ['Quelle est l’étymologie du mot « bistrot » ?', true],
  ['Quel animal peut dormir debout ?', false],
  ['Combien de cœurs a une pieuvre ?', false],
  ['Qui a remporté le premier Tour de France ?', false],
];
let e = 0;
for (const [q, att] of dico) if (QUESTION_DICTIONNAIRE.test(q) !== att) { e++; console.log('   ✗', q); }
dit(e === 0, `questions « de dictionnaire » écartées, questions de soirée conservées (${dico.length} cas)`);

const emo = [['🐠🌊🎶', true], ['🦁👑🌍', true], ['¡', false], ['Quel est ce film ?', false], ['🎬', false]];
e = 0;
for (const [q, att] of emo) if (((q.match(UN_EMOJI) || []).length >= 2) !== att) { e++; console.log('   ✗', JSON.stringify(q)); }
dit(e === 0, `devinettes emoji : au moins deux emojis exigés (${emo.length} cas)`);

const cit = [
  ['« Je suis le roi du monde »', true],
  ['"Le comique est le genre français le plus populaire"', true],
  ['Le cinéma comique français regroupe l\'ensemble des films comiques français', false],
  ['Les Aventures de Rabbi Jacob est sorti en 1973.', false],
];
e = 0;
for (const [q, att] of cit) if (CITATION.test(q) !== att) { e++; console.log('   ✗', q); }
dit(e === 0, `« Qui a dit ça ? » : une phrase sans guillemets n'est pas une citation (${cit.length} cas)`);

console.log(ko.length ? `\n${ko.length} échec(s)` : `\n${ok.length} vérifications, 0 échec`);
if (ko.length) process.exit(1);

// 4. Les explications ne doivent pas parler de « la source »
const nettoyer = (b) => String(b).trim()
  .replace(/^(selon|d['’]après|comme l['’]indique|conformément à)\s+(la|les|le)\s+(source|sources|document|documents|extrait|extraits|texte)s?\s*,?\s*/i, '')
  .replace(/\s*\((?:selon|d['’]après)\s+(?:la|les)\s+sources?\)\s*/gi, ' ')
  .trim();
const expl = [
  ['Selon la source, le livre écrit par Scappi en 1570 s\'appelle Opera.', 'Le livre écrit par Scappi en 1570 s\'appelle Opera.'],
  ['D\'après les sources, Paris compte 2 millions d\'habitants.', 'Paris compte 2 millions d\'habitants.'],
  ['Maurice Garin a remporté la première édition en 1903.', 'Maurice Garin a remporté la première édition en 1903.'],
];
let e4 = 0;
for (const [avant, apres] of expl) {
  const r = nettoyer(avant);
  const attendu = apres.charAt(0).toLowerCase() + apres.slice(1);
  if (r.toLowerCase() !== attendu.toLowerCase()) { e4++; console.log('   ✗', JSON.stringify(r)); }
}
console.log(e4 === 0 ? '✅ explications débarrassées de « selon la source »' : `❌ ${e4} cas`);
if (e4) process.exit(1);
