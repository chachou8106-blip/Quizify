// Troisième volet : collision de prénoms entre l'animateur et un joueur.
import WebSocket from 'ws';
const BASE = process.env.BASE || 'http://localhost:8799';
const WSB = BASE.replace('http', 'ws');
const ok = []; const ko = [];
const dit = (b, t) => { (b ? ok : ko).push(t); console.log(`${b ? '✅' : '❌'} ${t}`); };
const dors = (ms) => new Promise((r) => setTimeout(r, ms));
async function jsonp(path, body, token) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
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

const { token } = await jsonp('/api/auth/signup', { email: `t3-${Date.now()}@exemple.fr`, password: 'motdepasse1', name: 'Chachou' });
const questions = [{ question: 'Capitale du Portugal ?', options: ['Lisbonne', 'Porto', 'Faro', 'Braga'], correct: 0, explanation: 'Lisbonne.' }];
const { pin, hostKey } = await jsonp('/api/rooms', { questions, title: 'Collision' }, token);

// Une joueuse prend « Chachou » AVANT que la page animateur ne se connecte.
const joueuse = client(`${WSB}/api/rooms/${pin}/ws?role=player&name=Chachou`);
await dors(700);
dit(joueuse.ouvert, 'la joueuse « Chachou » entre dans le salon');

const h = client(`${WSB}/api/rooms/${pin}/ws?role=host&key=${hostKey}&name=Chachou`);
await dors(800);
const lobby = h.dernier('lobby');
dit(lobby?.hostName && lobby.hostName !== 'Chachou', `l’animateur reçoit un nom distinct : « ${lobby?.hostName} »`);
dit(lobby?.players?.length === 2, `deux fiches séparées : ${JSON.stringify(lobby?.players)}`);

h.envoie({ t: 'start' });
await dors(400);
joueuse.envoie({ t: 'answer', i: 1 });   // faux
h.envoie({ t: 'answer', i: 0 });         // juste
await dors(600);
h.envoie({ t: 'next' });
await dors(600);
const cl = h.dernier('reveal')?.leaderboard || [];
const laJoueuse = cl.find((p) => p.name === 'Chachou');
const lAnimateur = cl.find((p) => p.name === lobby.hostName);
dit(laJoueuse?.score === 0, 'la joueuse garde son propre score (0)');
dit(lAnimateur?.score > 0, `l’animateur a le sien (${lAnimateur?.score})`);

for (const c of [h, joueuse]) c.ws.close();
console.log(`\n${ok.length} réussite(s), ${ko.length} échec(s)`);
if (ko.length) process.exit(1);
