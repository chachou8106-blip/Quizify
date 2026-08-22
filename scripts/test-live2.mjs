// Deuxième volet : l'animateur se met en retrait, puis « Le juste prix » avec
// l'animateur parmi les joueurs.

import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://localhost:8799';
const WSB = BASE.replace('http', 'ws');
const ok = []; const ko = [];
const dit = (b, t) => { (b ? ok : ko).push(t); console.log(`${b ? '✅' : '❌'} ${t}`); };
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
function client(url) {
  const ws = new WebSocket(url);
  const c = { ws, msgs: [], ouvert: false, erreur: null };
  ws.on('open', () => { c.ouvert = true; });
  ws.on('error', (e) => { c.erreur = e.message; });
  ws.on('message', (d) => c.msgs.push(JSON.parse(d.toString())));
  c.envoie = (m) => ws.send(JSON.stringify(m));
  c.dernier = (t) => [...c.msgs].reverse().find((m) => m.t === t);
  return c;
}

const { token } = await jsonp('/api/auth/signup', { email: `t2-${Date.now()}@exemple.fr`, password: 'motdepasse1', name: 'Chachou' });

// --- A. Mise en retrait de l'animateur ---
{
  const questions = [{ question: 'Capitale de l’Italie ?', options: ['Rome', 'Milan', 'Turin', 'Naples'], correct: 0, explanation: 'Rome.' }];
  const { pin, hostKey } = await jsonp('/api/rooms', { questions, title: 'Retrait' }, token);
  const h = client(`${WSB}/api/rooms/${pin}/ws?role=host&key=${hostKey}&name=Chachou`);
  await dors(500);
  const p = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Sophie`);
  await dors(700);
  dit(h.dernier('lobby')?.players?.length === 2, 'départ : animateur + 1 joueuse');

  h.envoie({ t: 'hostLeave' });
  await dors(600);
  dit(!!h.dernier('hostLeft'), 'la mise en retrait est confirmée');
  dit(h.dernier('lobby')?.hostName === null, 'l’animateur n’est plus un joueur');
  dit(h.dernier('lobby')?.players?.length === 1, `il ne reste que la joueuse : ${JSON.stringify(h.dernier('lobby')?.players)}`);

  // Un joueur peut désormais prendre ce prénom (il est libéré).
  const c2 = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Chachou`);
  await dors(700);
  dit(c2.ouvert, 'le prénom libéré redevient disponible');

  h.envoie({ t: 'start' });
  await dors(500);
  p.envoie({ t: 'answer', i: 0 });
  await dors(600);
  dit(!h.dernier('reveal'), 'en retrait, la réponse d’une seule joueuse ne coupe toujours pas la question');
  h.envoie({ t: 'answer', i: 0 });
  await dors(500);
  h.envoie({ t: 'next' });
  await dors(600);
  const cl = h.dernier('reveal')?.leaderboard || [];
  dit(!cl.some((x) => x.name === 'Chachou' && x.score > 0), 'l’animateur en retrait ne marque aucun point');
  for (const c of [h, p, c2]) c.ws.close();
}

// --- B. Le juste prix, animateur inclus ---
{
  const questions = [{ question: 'Combien de marches compte la tour Eiffel jusqu’au sommet ?', options: ['1665'], correct: 0, explanation: '1 665 marches.' }];
  const { pin, hostKey } = await jsonp('/api/rooms', { questions, title: 'Juste prix' }, token);
  const h = client(`${WSB}/api/rooms/${pin}/ws?role=host&key=${hostKey}&name=Chachou`);
  await dors(500);
  const s = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Sophie`);
  const c = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Camille`);
  await dors(800);
  h.envoie({ t: 'start' });
  await dors(500);
  s.envoie({ t: 'answer', i: 1200 });
  c.envoie({ t: 'answer', i: 3000 });
  h.envoie({ t: 'answer', i: 1665 });     // l'animateur tombe pile
  await dors(800);
  const rep = h.dernier('answered');
  dit(rep?.guess === 1665, `la proposition chiffrée de l’animateur est enregistrée (${rep?.guess})`);
  dit(h.dernier('answerCount')?.total === 3, 'les 3 participants sont comptés');
  h.envoie({ t: 'next' });
  await dors(700);
  const r = h.dernier('reveal');
  const props = r?.propositions || [];
  dit(props[0]?.name === 'Chachou' && props[0]?.exact === true, `l’animateur gagne la manche au plus proche (${props[0]?.name}, exact=${props[0]?.exact})`);
  dit(props[0]?.points === 1250, `barème appliqué à l’animateur comme aux autres : ${props[0]?.points} pts`);
  dit(props.length === 3, `les 3 propositions sont classées : ${props.map((x) => `${x.name}=${x.guess}`).join(', ')}`);
  dit(!!s.dernier('reveal')?.propositions?.find((x) => x.name === 'Chachou'), 'les joueurs voient la proposition de l’animateur');
  for (const x of [h, s, c]) x.ws.close();
}

console.log(`\n${ok.length} réussite(s), ${ko.length} échec(s)`);
if (ko.length) process.exit(1);
