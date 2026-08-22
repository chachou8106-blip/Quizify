// Test de bout en bout du jeu en direct, avec l'ANIMATEUR QUI JOUE.
// Vérifie que l'animateur est traité exactement comme les autres joueurs :
// inscription automatique, chrono partagé, réponses acceptées jusqu'au bout,
// score et classement identiques, reprise après rechargement de page.

import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://localhost:8799';
const WSB = BASE.replace('http', 'ws');
const ok = [];
const ko = [];
const dit = (bon, texte) => { (bon ? ok : ko).push(texte); console.log(`${bon ? '✅' : '❌'} ${texte}`); };
const dors = (ms) => new Promise((r) => setTimeout(r, ms));

async function jsonp(path, body, token) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${JSON.stringify(d)}`);
  return d;
}

function client(url, nom) {
  const ws = new WebSocket(url);
  const c = { ws, nom, msgs: [], ouvert: false, erreur: null };
  ws.on('open', () => { c.ouvert = true; });
  ws.on('error', (e) => { c.erreur = e.message; });
  ws.on('message', (d) => c.msgs.push(JSON.parse(d.toString())));
  c.envoie = (m) => ws.send(JSON.stringify(m));
  c.dernier = (t) => [...c.msgs].reverse().find((m) => m.t === t);
  return c;
}

const email = `test${Date.now()}@exemple.fr`;
const { token } = await jsonp('/api/auth/signup', { email, password: 'motdepasse1', name: 'Chachou' });

const questions = [
  { question: 'Capitale de la France ?', options: ['Paris', 'Lyon', 'Nice', 'Brest'], correct: 0, explanation: 'Paris.' },
  { question: 'Combien de pattes a une araignée ?', options: ['6', '8', '10', '12'], correct: 1, explanation: 'Huit.' },
];
const { pin, hostKey } = await jsonp('/api/rooms', { questions, title: 'Test animateur joueur' }, token);
console.log(`\n--- Partie ${pin} ---`);

// L'animateur se connecte SANS rien cliquer.
const hote = client(`${WSB}/api/rooms/${pin}/ws?role=host&key=${hostKey}&name=Chachou`, 'Chachou');
await dors(600);
const sophie = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Sophie`, 'Sophie');
const camille = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Camille`, 'Camille');
await dors(900);

const lobby = hote.dernier('lobby');
dit(lobby?.hostName === 'Chachou', `animateur inscrit automatiquement comme joueur (hostName=${lobby?.hostName})`);
dit(lobby?.players?.length === 3, `3 joueurs dans le salon : ${JSON.stringify(lobby?.players)}`);
dit(sophie.dernier('lobby')?.players?.includes('Chachou'), 'les joueurs voient l’animateur dans la liste');

// Un joueur ne peut pas voler le pseudo de l'animateur.
const usurpateur = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=chachou`, 'usurpateur');
await dors(700);
dit(!!usurpateur.erreur && !usurpateur.ouvert, `pseudo de l’animateur réservé (${usurpateur.erreur || 'connexion acceptée !'})`);
dit(hote.dernier('lobby')?.players?.length === 3, 'la liste reste à 3 joueurs après la tentative');

// --- Question 1 : tout le monde répond, y compris l'animateur ---
hote.envoie({ t: 'start' });
await dors(500);
const q1 = hote.dernier('question');
dit(q1?.seconds === 15, `chrono de ${q1?.seconds}s`);
dit(!!sophie.dernier('question') && !!camille.dernier('question'), 'question reçue par les joueurs');

const t0 = Date.now();
sophie.envoie({ t: 'answer', i: 0 });          // juste, rapide
await dors(1200);
dit(!camille.dernier('reveal'), 'la réponse de Sophie ne coupe pas la question');
await dors(3500);                              // au-delà des 2s de lecture offertes
hote.envoie({ t: 'answer', i: 0 });            // l'animateur répond juste, plus lentement
await dors(600);
dit(!!hote.dernier('answered'), 'la réponse de l’animateur est acceptée');
const compte = hote.dernier('answerCount');
dit(compte?.total === 3, `décompte sur 3 participants (${compte?.answered}/${compte?.total})`);

await dors(1500);
camille.envoie({ t: 'answer', i: 1 });         // faux, tardif
await dors(500);
dit(!camille.dernier('reveal'), `Camille peut encore répondre après ${((Date.now() - t0) / 1000).toFixed(1)}s`);
dit(hote.dernier('answerCount')?.answered === 3, 'les 3 réponses sont comptées');
dit(!hote.dernier('reveal'), 'aucune révélation automatique même quand tout le monde a répondu');

// On laisse le chrono aller au bout : le serveur doit révéler seul.
await dors(12000);
const rev = hote.dernier('reveal');
dit(!!rev, `révélation automatique par le serveur après ${((Date.now() - t0) / 1000).toFixed(1)}s`);
dit(!!sophie.dernier('reveal') && !!camille.dernier('reveal'), 'révélation reçue par les joueurs');
dit(Array.isArray(rev?.options) && rev.options.length === 4, 'la révélation embarque les propositions');

const cl = rev?.leaderboard || [];
const moiHote = cl.find((p) => p.name === 'Chachou');
dit(!!moiHote, 'l’animateur figure au classement');
dit(moiHote?.score > 0, `l’animateur marque des points (${moiHote?.score})`);
const s = cl.find((p) => p.name === 'Sophie');
dit(s?.score > moiHote?.score, `Sophie (${s?.score}) devance l’animateur (${moiHote?.score}) : elle a répondu plus vite`);
dit(Math.abs(s.score - moiHote.score) < 300, 'l’écart de vitesse reste modéré (savoir 700 / vitesse 300)');
dit(cl.find((p) => p.name === 'Camille')?.score === 0, 'Camille (fausse réponse) reste à 0');
console.log('   classement :', cl.map((p) => `${p.name} ${p.score}`).join(' · '));

// --- Rechargement de la page animateur pendant la révélation ---
hote.ws.close();
await dors(400);
const hote2 = client(`${WSB}/api/rooms/${pin}/ws?role=host&key=${hostKey}&name=Chachou`, 'Chachou');
await dors(900);
dit(hote2.dernier('lobby')?.hostName === 'Chachou', 'après rechargement, l’animateur retrouve son statut de joueur');
dit(!!hote2.dernier('reveal'), 'après rechargement, il retombe sur l’écran de révélation en cours');
dit(hote2.dernier('reveal')?.leaderboard?.find((p) => p.name === 'Chachou')?.score > 0, 'son score est conservé');

// --- Question 2 : l'animateur se met en retrait ---
hote2.envoie({ t: 'next' });
await dors(600);
dit(!!hote2.dernier('question') && hote2.dernier('question').idx === 1, 'question 2 lancée');
const scoreAvant = hote2.dernier('reveal')?.leaderboard?.find((p) => p.name === 'Chachou')?.score;
sophie.envoie({ t: 'answer', i: 1 });
camille.envoie({ t: 'answer', i: 1 });
hote2.envoie({ t: 'answer', i: 1 });
await dors(700);
dit(hote2.dernier('answerCount')?.total === 3, 'l’animateur compte toujours parmi les 3');
hote2.envoie({ t: 'next' });
await dors(700);
const rev2 = hote2.dernier('reveal');
dit(rev2?.leaderboard?.find((p) => p.name === 'Chachou')?.score > scoreAvant, 'l’animateur marque aussi sur la question 2');

hote2.envoie({ t: 'next' });
await dors(700);
const pod = hote2.dernier('podium');
dit(!!pod, 'podium atteint');
dit(pod?.leaderboard?.length === 3, `podium à 3 participants : ${pod?.leaderboard?.map((p) => p.name).join(', ')}`);
dit(!!sophie.dernier('podium') && !!camille.dernier('podium'), 'podium reçu par tous');

for (const c of [hote2, sophie, camille]) c.ws.close();
console.log(`\n${ok.length} réussite(s), ${ko.length} échec(s)`);
if (ko.length) { ko.forEach((k) => console.log('  ✗ ' + k)); process.exit(1); }
