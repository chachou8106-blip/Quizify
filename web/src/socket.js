import { useCallback, useEffect, useRef, useState } from 'react';

// Connexion temps réel qui se rétablit toute seule.
//
// Pourquoi ce fichier existe. Sur un téléphone, la moindre bascule
// d'application ferme la connexion : envoyer le lien de la partie par WhatsApp,
// verrouiller l'écran trente secondes, passer du wifi à la 4G. Le navigateur ne
// prévient de rien, et surtout `ws.send()` sur une connexion fermée ne fait
// RIEN — silencieusement, sans erreur. C'est exactement ce qui rendait le
// bouton « Lancer la partie » inerte alors que tout semblait normal à l'écran.
//
// Ici : reconnexion automatique, réveil immédiat au retour sur la page, et
// aucun message perdu — ce qui n'a pas pu partir est envoyé dès le retour.

const ETAT = { connexion: 'connexion', ouvert: 'ouvert', coupe: 'coupe', echec: 'echec' };

export function useLiveSocket(url, onMessage, actif = true) {
  const [etat, setEtat] = useState(ETAT.connexion);
  const socket = useRef(null);
  const file = useRef([]);
  const essais = useRef(0);
  const dejaOuvert = useRef(false);
  const minuteur = useRef(null);
  const battement = useRef(null);
  const fini = useRef(false);
  const rappel = useRef(onMessage);
  rappel.current = onMessage;

  const vider = useCallback(() => {
    const s = socket.current;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const maintenant = Date.now();
    const restants = [];
    for (const item of file.current) {
      // Une réponse vieille de plus de huit secondes n'a plus de sens : la
      // question est passée. On ne la renvoie pas.
      if (maintenant - item.le > 8000) continue;
      try { s.send(JSON.stringify(item.msg)); } catch { restants.push(item); }
    }
    file.current = restants;
  }, []);

  const connecter = useCallback(() => {
    if (!actif || !url || fini.current) return;
    const actuel = socket.current;
    if (actuel && (actuel.readyState === WebSocket.CONNECTING || actuel.readyState === WebSocket.OPEN)) return;
    clearTimeout(minuteur.current);

    const s = new WebSocket(url);
    socket.current = s;
    setEtat((e) => (e === ETAT.ouvert ? ETAT.coupe : e));

    // Une connexion qui reste « en cours » indéfiniment (réseau mobile qui ne
    // répond plus) doit être abandonnée, sinon plus rien ne se reconnecte.
    const abandon = setTimeout(() => {
      if (s.readyState === WebSocket.CONNECTING) { try { s.close(); } catch {} }
    }, 9000);

    s.onopen = () => {
      clearTimeout(abandon);
      essais.current = 0;
      dejaOuvert.current = true;
      setEtat(ETAT.ouvert);
      vider();
    };
    s.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'pong') return;
      rappel.current(m);
    };
    s.onerror = () => { try { s.close(); } catch {} };
    s.onclose = () => {
      clearTimeout(abandon);
      if (fini.current) return;
      // Si la toute première connexion n'a jamais abouti, c'est un refus
      // (mauvais code, pseudo déjà pris, partie pleine) : insister ne sert à
      // rien et masquerait le vrai message.
      if (!dejaOuvert.current && essais.current >= 3) { setEtat(ETAT.echec); return; }
      setEtat(ETAT.coupe);
      const attente = Math.min(400 * 2 ** essais.current++, 5000);
      minuteur.current = setTimeout(connecter, attente);
    };
  }, [url, actif, vider]);

  useEffect(() => {
    fini.current = false;
    dejaOuvert.current = false;
    essais.current = 0;
    connecter();

    const reveil = () => {
      if (document.visibilityState === 'hidden') return;
      const s = socket.current;
      if (!s || s.readyState === WebSocket.CLOSED || s.readyState === WebSocket.CLOSING) {
        essais.current = 0;
        connecter();
      }
    };
    document.addEventListener('visibilitychange', reveil);
    window.addEventListener('online', reveil);
    window.addEventListener('focus', reveil);
    window.addEventListener('pageshow', reveil);

    // Battement de cœur : certains réseaux mobiles coupent les connexions
    // restées silencieuses une minute. Un signe de vie toutes les 25 secondes
    // suffit à traverser un salon d'attente de plusieurs minutes.
    battement.current = setInterval(() => {
      const s = socket.current;
      if (s && s.readyState === WebSocket.OPEN) { try { s.send('{"t":"ping"}'); } catch {} }
      else reveil();
    }, 25000);

    return () => {
      fini.current = true;
      document.removeEventListener('visibilitychange', reveil);
      window.removeEventListener('online', reveil);
      window.removeEventListener('focus', reveil);
      window.removeEventListener('pageshow', reveil);
      clearInterval(battement.current);
      clearTimeout(minuteur.current);
      try { socket.current?.close(); } catch {}
    };
  }, [connecter]);

  // Renvoie true si le message est parti tout de suite.
  const envoyer = useCallback((msg) => {
    const s = socket.current;
    if (s && s.readyState === WebSocket.OPEN) {
      try { s.send(JSON.stringify(msg)); return true; } catch { /* on met en file */ }
    }
    file.current.push({ msg, le: Date.now() });
    essais.current = 0;
    connecter();
    return false;
  }, [connecter]);

  const reconnecter = useCallback(() => { essais.current = 0; dejaOuvert.current = false; connecter(); }, [connecter]);

  return { etat, envoyer, reconnecter };
}

// Bandeau discret, affiché seulement quand quelque chose ne va pas.
export function bandeauConnexion(etat) {
  if (etat === 'ouvert') return null;
  if (etat === 'echec') return { texte: 'Connexion impossible', ton: 'cherry' };
  if (etat === 'coupe') return { texte: '📶 Connexion perdue — reprise en cours…', ton: 'sunny' };
  return { texte: '⏳ Connexion…', ton: 'sunny' };
}
