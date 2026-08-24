// La bonne réponse doit changer de place. Avant ce contrôle, « Trouve
// l'intrus » plaçait la réponse en 4e position à TOUS les coups.
// src/ai.js importe des modules du Worker : on le rassemble d'abord.
import { execSync } from 'child_process';
const paquet = '/tmp/quizzalo-ai.mjs';
execSync(`npx esbuild src/ai.js --bundle --format=esm --platform=neutral --outfile=${paquet} --external:cloudflare:workers`, { stdio: 'pipe' });
const { melangerOptions, generateMathQuestions } = await import(`${paquet}?v=${process.pid}`);

const ok = []; const ko = [];
const dit = (b, t) => { (b ? ok : ko).push(t); console.log(`${b ? '✅' : '❌'} ${t}`); };

// 1. L'intrus, toujours produit en dernier par le modèle
const positions = [0, 0, 0, 0];
for (let i = 0; i < 2000; i++) {
  const q = melangerOptions({ question: 'Trouve l\'intrus', options: ['A', 'B', 'C', 'Intrus'], correct: 3, explanation: '' }, 'intru');
  dit0(q);
  positions[q.correct]++;
}
function dit0(q) {
  if (q.options[q.correct] !== 'Intrus') { ko.push('la bonne réponse a changé de valeur !'); }
}
const part = positions.map((n) => n / 2000);
dit(part.every((p) => p > 0.2 && p < 0.3), `la réponse se répartit sur les 4 positions : ${part.map((p) => Math.round(p * 100) + '%').join(' · ')}`);
dit(ko.length === 0, 'la bonne réponse reste la bonne après mélange');

// 2. Vrai / Faux ne doit PAS être mélangé
let inverse = 0;
for (let i = 0; i < 500; i++) {
  const q = melangerOptions({ question: 'x', options: ['Vrai', 'Faux'], correct: 0, explanation: '' }, 'trueFalse');
  if (q.options[0] !== 'Vrai') inverse++;
}
dit(inverse === 0, 'Vrai reste avant Faux');

// 3. Deux options (mix) : jamais mélangées non plus
let inv2 = 0;
for (let i = 0; i < 500; i++) {
  const q = melangerOptions({ question: 'x', options: ['Vrai', 'Faux'], correct: 1, explanation: '' }, 'mixed');
  if (q.options[0] !== 'Vrai') inv2++;
}
dit(inv2 === 0, 'même dans un mix, Vrai reste avant Faux');

// 4. Calcul mental : la bonne réponse doit aussi bouger
const pos = [0, 0, 0, 0];
for (let i = 0; i < 40; i++) {
  for (const q of generateMathQuestions({ count: 25, difficulty: 'medium' })) pos[q.correct]++;
}
const total = pos.reduce((a, b) => a + b, 0);
const partM = pos.map((n) => n / total);
dit(partM.every((p) => p > 0.2 && p < 0.3), `calcul mental, réponse répartie : ${partM.map((p) => Math.round(p * 100) + '%').join(' · ')}`);

console.log(ko.length ? `\n${ko.length} échec(s)` : `\n${ok.length} vérifications, 0 échec`);
if (ko.length) process.exit(1);
