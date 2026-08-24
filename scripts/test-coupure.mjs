// Reproduit la panne vécue : l'animateur envoie le lien, quitte l'application,
// revient — et le bouton « Lancer la partie » ne répond plus.
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

const { token } = await jsonp('/api/auth/signup', { email: `cut-${Date.now()}@exemple.fr`, password: 'motdepasse1', name: 'Chachou' });
const questions = [
  { question: 'Capitale de la France ?', options: ['Paris', 'Lyon', 'Nice', 'Brest'], correct: 0, explanation: 'Paris.' },
  { question: 'Couleur du ciel ?', options: ['Bleu', 'Vert', 'Rouge', 'Noir'], correct: 0, explanation: 'Bleu.' },
];
const { pin, hostKey } = await jsonp('/api/rooms', { questions, title: 'Test coupure' }, token);

const nav = await chromium.launch();
const ctxAnim = await nav.newContext();
const ctxJoueur = await nav.newContext();
const erreurs = [];

// On garde la main sur les WebSocket ouverts par la page, pour pouvoir en
// couper une exactement comme le ferait un réseau mobile : sans prévenir.
const espion = () => {
  const Natif = window.WebSocket;
  window.__sockets = [];
  const Piege = function (...a) { const s = new Natif(...a); window.__sockets.push(s); return s; };
  Piege.prototype = Natif.prototype;
  Piege.CONNECTING = 0; Piege.OPEN = 1; Piege.CLOSING = 2; Piege.CLOSED = 3;
  window.WebSocket = Piege;
};
await ctxAnim.addInitScript(espion);
await ctxJoueur.addInitScript(espion);

const anim = await ctxAnim.newPage();
anim.on('pageerror', (e) => erreurs.push('animateur: ' + e.message));
anim.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) erreurs.push('animateur console: ' + m.text()); });
await anim.goto(`${BASE}/`);
await anim.evaluate(([t, p, k]) => { localStorage.setItem('qzf-token', t); sessionStorage.setItem(`host-${p}`, k); }, [token, pin, hostKey]);
await anim.goto(`${BASE}/host/${pin}`);
await anim.waitForTimeout(2000);
dit(/Tu joues aussi/.test(await anim.textContent('body')), 'écran d’animation prêt');

const joueur = await ctxJoueur.newPage();
joueur.on('pageerror', (e) => erreurs.push('joueur: ' + e.message));
await joueur.goto(`${BASE}/join/${pin}`);
await joueur.fill('input[placeholder="Ton pseudo"]', 'Sophie');
await joueur.click('button:has-text("C\'est parti")');
await joueur.waitForTimeout(1200);
dit(/2 joueur/.test(await anim.textContent('body')), 'le joueur est visible : 2 participants');

// --- L'animateur quitte l'application pour envoyer le lien : le téléphone
// ferme la connexion sans que la page en sache rien ---
await ctxAnim.setOffline(true);
await anim.evaluate(() => window.__sockets.at(-1)?.close());
await anim.waitForTimeout(1500);
let txt = await anim.textContent('body');
dit(/Connexion perdue|Reconnexion/.test(txt), 'la coupure est signalée à l’écran (avant : rien du tout)');
dit(/Reconnexion en cours/.test(txt), 'le bouton dit pourquoi il n’est pas actif');

dit(await anim.locator('button:has-text("Reconnexion en cours")').isDisabled(), 'le bouton est franchement désactivé, pas silencieusement inerte');

// --- Retour de l'animateur ---
await ctxAnim.setOffline(false);
await anim.waitForTimeout(6000);
txt = await anim.textContent('body');
dit(!/Connexion perdue/.test(txt), 'la connexion se rétablit toute seule');
dit(/2 joueur/.test(txt), 'les joueurs sont toujours là après la reconnexion');
dit(/Lancer la partie/.test(txt), 'le bouton de lancement redevient actif');

await anim.click('button:has-text("Lancer la partie")');
await anim.waitForTimeout(1500);
dit(/Capitale de la France/.test(await anim.textContent('body')), 'la partie se lance après la reconnexion');
dit(/Capitale de la France/.test(await joueur.textContent('body')), 'le joueur reçoit bien la question');

// --- Coupure côté joueur pendant la question ---
await ctxJoueur.setOffline(true);
await joueur.evaluate(() => window.__sockets.at(-1)?.close());
await joueur.waitForTimeout(1500);
await ctxJoueur.setOffline(false);
await joueur.waitForTimeout(5000);
txt = await joueur.textContent('body');
dit(/Capitale de la France/.test(txt) || /Réponse envoyée/.test(txt), 'le joueur retrouve la question en cours après sa coupure');
await joueur.click('button:has-text("Paris")').catch(() => {});
await anim.waitForTimeout(1000);
dit(/1 \/ 2|2 \/ 2/.test(await anim.textContent('body')), 'sa réponse est bien comptée');

dit(erreurs.length === 0, `aucune erreur JavaScript ${erreurs.length ? '→ ' + erreurs.join(' | ') : ''}`);
await nav.close();
console.log(`\n${ok.length} réussite(s), ${ko.length} échec(s)`);
if (ko.length) process.exit(1);
