// Vérification de l'écran animateur dans un vrai navigateur.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('/home/claude/.npm-global/lib/node_modules/playwright/index.js');

const BASE = process.env.BASE || 'http://localhost:8799';
const ok = []; const ko = [];
const dit = (b, t) => { (b ? ok : ko).push(t); console.log(`${b ? '✅' : '❌'} ${t}`); };

async function jsonp(path, body, token) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d));
  return d;
}

const email = `ui-${Date.now()}@exemple.fr`;
const { token } = await jsonp('/api/auth/signup', { email, password: 'motdepasse1', name: 'Chachou' });
const questions = [
  { question: 'Capitale de la France ?', options: ['Paris', 'Lyon', 'Nice', 'Brest'], correct: 0, explanation: 'Paris.' },
];
const { pin, hostKey } = await jsonp('/api/rooms', { questions, title: 'Test UI' }, token);

const nav = await chromium.launch();
const ctx = await nav.newContext();
const erreurs = [];

const anim = await ctx.newPage();
anim.on('pageerror', (e) => erreurs.push('animateur: ' + e.message));
// Le bac à sable bloque les domaines externes (polices, publicité) : ce n'est
// pas un défaut de l'application, on ne le compte pas comme une erreur.
anim.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(m.text())) erreurs.push('animateur console: ' + m.text()); });
await anim.goto(`${BASE}/`);
await anim.evaluate(([t, p, k]) => { localStorage.setItem('qzf-token', t); sessionStorage.setItem(`host-${p}`, k); }, [token, pin, hostKey]);
await anim.goto(`${BASE}/host/${pin}`);
await anim.waitForTimeout(2500);

let txt = await anim.textContent('body');
dit(/Tu joues aussi/.test(txt), 'l’écran annonce que l’animateur joue, sans rien cliquer');
dit(/Chachou/.test(txt), 'son nom de compte est repris');
dit(/j’anime sans jouer|j'anime sans jouer/.test(txt), 'le retrait reste possible en un clic');

// Une joueuse rejoint.
const joueuse = await ctx.newPage();
joueuse.on('pageerror', (e) => erreurs.push('joueuse: ' + e.message));
await joueuse.goto(`${BASE}/join/${pin}`);
await joueuse.fill('input[placeholder="Ton pseudo"]', 'Sophie');
await joueuse.click('button:has-text("C\'est parti")');
await joueuse.waitForTimeout(1500);
dit(/Tu es dans la partie/.test(await joueuse.textContent('body')), 'la joueuse est entrée');
dit(/2 joueur/.test(await anim.textContent('body')), 'le salon compte 2 participants (animateur inclus)');

await anim.click('button:has-text("Lancer la partie")');
await anim.waitForTimeout(1200);
txt = await anim.textContent('body');
dit(/Capitale de la France/.test(txt), 'la question s’affiche chez l’animateur');
const boutons = await anim.locator('button:has-text("Paris")').count();
dit(boutons === 1, 'les propositions sont cliquables pour l’animateur');

await anim.click('button:has-text("Paris")');
await anim.waitForTimeout(800);
dit(/0 \/ 2|1 \/ 2/.test(await anim.textContent('body')), 'le décompte est sur 2');

await joueuse.click('button:has-text("Paris")');
await anim.waitForTimeout(900);
dit(/2 \/ 2/.test(await anim.textContent('body')), 'les 2 réponses sont comptées');
dit(!/bonne réponse était/.test(await anim.textContent('body')), 'la question n’est pas coupée d’office');

await anim.click('button:has-text("Révéler")');
await anim.waitForTimeout(1200);
txt = await anim.textContent('body');
dit(/bonne réponse était/.test(txt), 'écran de révélation');
dit(/Toi : \+\d+ points/.test(txt), `l’animateur voit son propre gain (${(txt.match(/Toi : \+\d+ points/) || [])[0]})`);
dit(/Chachou/.test(txt) && /Sophie/.test(txt), 'les deux figurent au classement');

dit(erreurs.length === 0, `aucune erreur JavaScript ${erreurs.length ? '→ ' + erreurs.join(' | ') : ''}`);

await anim.screenshot({ path: '/tmp/animateur-revelation.png', fullPage: true });
await nav.close();
console.log(`\n${ok.length} réussite(s), ${ko.length} échec(s)`);
if (ko.length) process.exit(1);
