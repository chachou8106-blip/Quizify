import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { wsUrl } from '../api';
import { bandeauConnexion, useLiveSocket } from '../socket';
import { Link } from 'react-router-dom';
import ShareButtons from '../components/ShareButtons';

const SHAPES = ['🔺', '🔷', '🟡', '🟢'];
const COLORS = ['bg-cherry', 'bg-sky2', 'bg-sunny text-white', 'bg-minty'];

export default function Join() {
  const { pin: pinParam } = useParams();
  const [pin, setPin] = useState(pinParam || '');
  const [name, setName] = useState(localStorage.getItem('qzf-nick') || '');
  const [state, setState] = useState('form'); // form | lobby | question | answered | reveal | podium
  const [error, setError] = useState('');
  const [game, setGame] = useState({});
  const [q, setQ] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [proposition, setProposition] = useState('');
  const [reveal, setReveal] = useState(null);
  const [podium, setPodium] = useState(null);
  const [reward, setReward] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // Pseudo et code figés au moment où l'on rejoint : ils servent d'adresse de
  // reconnexion. Tant qu'ils ne changent pas, la connexion se rétablit seule.
  const [entree, setEntree] = useState(pinParam && localStorage.getItem('qzf-nick') ? { pin: pinParam, nom: localStorage.getItem('qzf-nick') } : null);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const url = useMemo(
    () => (entree ? wsUrl(entree.pin, { role: 'player', name: entree.nom }) : null),
    [entree],
  );

  const surMessage = useCallback((m) => {
    if (m.t === 'lobby') { setGame(m); if (m.phase === 'lobby') setState('lobby'); }
    if (m.t === 'question') {
      setQ(m); setMyAnswer(null); setReveal(null); setProposition(''); setState('question');
      clearInterval(timerRef.current);
      const tick = () => setSecondsLeft(Math.max(0, Math.ceil((m.endsAt - Date.now()) / 1000)));
      tick();
      timerRef.current = setInterval(tick, 250);
    }
    if (m.t === 'answered') { setMyAnswer(m.i ?? m.guess); setState('answered'); }
    if (m.t === 'reveal') { clearInterval(timerRef.current); setReveal(m); setState('reveal'); }
    if (m.t === 'reward') setReward(m);
    if (m.t === 'podium') {
      clearInterval(timerRef.current);
      if (m.title) setGame((g) => ({ ...g, title: m.title }));
      setPodium(m.leaderboard); setState('podium');
      const rang = m.leaderboard.findIndex((p) => p.name === (entree?.nom || ''));
      if (rang >= 0 && rang < 3) confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
    }
  }, [entree]);

  const { etat, envoyer } = useLiveSocket(url, surMessage, !!entree);

  useEffect(() => {
    if (!entree) return;
    if (etat === 'ouvert') { setError(''); setState((s) => (s === 'form' ? 'lobby' : s)); }
    // Le navigateur ne transmet pas le motif d'un refus : on énumère les trois
    // causes possibles plutôt que de laisser chercher.
    if (etat === 'echec') {
      setError('Impossible de rejoindre : vérifie le code, essaie un autre pseudo (il est peut-être déjà pris), ou la partie est complète.');
      setState('form');
      setEntree(null);
    }
  }, [etat, entree]);

  const connect = (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(pin) || !name.trim()) { setError('Code à 6 chiffres et pseudo requis'); return; }
    localStorage.setItem('qzf-nick', name.trim());
    setError('');
    setEntree({ pin, nom: name.trim() });
  };

  const answer = (i) => {
    if (myAnswer !== null || state !== 'question') return;
    envoyer({ t: 'answer', i });
    setMyAnswer(i);
    setState('answered');
    navigator.vibrate?.(40);
  };

  // « Le juste prix » : on envoie le nombre proposé, pas un indice d'option.
  const envoyerNombre = (e) => {
    e?.preventDefault();
    if (myAnswer !== null || state !== 'question') return;
    const valeur = Number(String(proposition).replace(',', '.'));
    if (!Number.isFinite(valeur) || proposition === '') return;
    envoyer({ t: 'answer', i: valeur });
    setMyAnswer(valeur);
    setState('answered');
    navigator.vibrate?.(40);
  };

  const alerte = bandeauConnexion(etat);
  const bandeau = entree && alerte && etat !== 'echec' && (
    <div className="rounded-2xl border-2 border-sunny/60 bg-sunny/15 px-4 py-2 text-center font-display font-extrabold text-sunny">
      {alerte.texte}
    </div>
  );

  if (state === 'form') {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="animate-floaty text-6xl">🎮</div>
        <h1 className="font-display text-3xl font-extrabold">Rejoindre la partie</h1>
        <form onSubmit={connect} className="card space-y-4">
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" placeholder="Code PIN" className="input text-center font-display text-3xl font-extrabold tracking-[0.3em]" />
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="Ton pseudo" className="input text-center text-xl font-bold" />
          {error && <p className="font-bold text-cherry">{error}</p>}
          <button className="btn-primary w-full text-xl">C'est parti ! 🚀</button>
        </form>
      </div>
    );
  }

  if (state === 'lobby') {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        {bandeau}
        <div className="animate-pulseBig text-6xl">🕺💃</div>
        <h1 className="font-display text-3xl font-extrabold">Tu es dans la partie !</h1>
        <div className="card">
          <p className="text-xl font-bold text-white/60">« {game.title} »</p>
          <p className="mt-2 font-semibold text-white/50">En attente du lancement par l'animateur…</p>
          <p className="mt-4 font-display text-2xl font-extrabold text-grape-light">{game.players?.length || 1} joueur(s) 🎉</p>
        </div>
      </div>
    );
  }

  if (state === 'question' && q) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        {bandeau}
        <div className="flex items-center justify-between font-display font-extrabold">
          <span className="rounded-full bg-grape px-4 py-1 text-white">{q.idx + 1} / {q.total}</span>
          <span className={`rounded-full px-4 py-1 text-white ${secondsLeft <= 5 ? 'animate-pulseBig bg-cherry' : 'bg-slate-700'}`}>⏱ {secondsLeft}s</span>
        </div>
        <div className="card"><h2 className="text-center font-display text-xl font-extrabold">{q.question}</h2></div>
        {q.options?.length === 1 ? (
          // Le juste prix : aucune proposition affichée, chacun avance son chiffre.
          <form onSubmit={envoyerNombre} className="card space-y-3 border-2 border-sunny/60">
            <p className="text-center font-bold text-white/60">💰 Propose ton chiffre — le plus proche gagne</p>
            <input
              value={proposition}
              onChange={(e) => setProposition(e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 15))}
              inputMode="decimal"
              autoFocus
              placeholder="Ton nombre"
              className="input text-center font-display text-3xl font-extrabold"
            />
            <button className="btn-sunny w-full text-xl" disabled={proposition === ''}>Je propose ! 💰</button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => answer(i)}
                className={`${COLORS[i % 4]} min-h-28 rounded-3xl p-4 font-display text-lg font-extrabold text-white shadow-pop transition-transform active:translate-y-1 active:shadow-none`}>
                <div className="text-2xl">{SHAPES[i % 4]}</div>
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (state === 'answered') {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-16 text-center">
        {bandeau}
        <div className="animate-wiggle text-7xl">🤞</div>
        <h1 className="font-display text-3xl font-extrabold">Réponse envoyée !</h1>
        <p className="text-lg font-semibold text-white/60">On attend les autres…</p>
      </div>
    );
  }

  if (state === 'reveal' && reveal) {
    const mine = reveal.leaderboard.find((p) => p.name === (entree?.nom || name.trim()));
    const rank = reveal.leaderboard.findIndex((p) => p.name === (entree?.nom || name.trim())) + 1;
    // « Le juste prix » : il n'y a ni bonne ni mauvaise réponse, seulement un écart.
    const chiffre = reveal.bonneValeur !== null && reveal.bonneValeur !== undefined;
    const maLigne = chiffre ? reveal.propositions?.find((x) => x.name === (entree?.nom || name.trim())) : null;
    const monRang = chiffre ? (reveal.propositions || []).findIndex((x) => x.name === (entree?.nom || name.trim())) : -1;
    const good = chiffre ? monRang === 0 : myAnswer === reveal.correct;
    if (good) { navigator.vibrate?.([50, 40, 50]); }

    if (chiffre) {
      return (
        <div className="mx-auto max-w-md space-y-5 pt-8 text-center">
          <div className="text-7xl">{maLigne?.exact ? '🎯' : monRang === 0 ? '🏆' : '💰'}</div>
          <h1 className="font-display text-3xl font-extrabold">
            {maLigne?.exact ? 'Pile poil !' : monRang === 0 ? 'Le plus proche, bravo !' : `+${maLigne?.points || 0} points`}
          </h1>
          <div className="card space-y-2">
            <p className="font-display text-2xl font-extrabold text-sunny">
              Réponse : {reveal.bonneValeur.toLocaleString('fr-FR')}
            </p>
            {maLigne && (
              <p className="font-semibold text-white/60">
                Toi : {maLigne.guess.toLocaleString('fr-FR')} — écart de {maLigne.ecart.toLocaleString('fr-FR')}
              </p>
            )}
          </div>
          {reveal.explanation && <p className="card font-semibold">💡 {reveal.explanation}</p>}
          {mine && <p className="text-xl font-bold text-white/60">Tu es {rank === 1 ? '🥇 1er' : rank === 2 ? '🥈 2e' : rank === 3 ? '🥉 3e' : `${rank}e`} avec {mine.score} pts</p>}
          <p className="font-semibold text-white/50">{reveal.isLast ? 'Résultats finaux dans un instant…' : 'Prochaine question bientôt…'}</p>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-md space-y-5 pt-8 text-center">
        <div className="text-7xl">{good ? '✅' : '❌'}</div>
        <h1 className="font-display text-3xl font-extrabold">{good ? `+${mine?.delta || 0} points !` : 'Raté !'}</h1>
        {good && (mine?.streak || 0) >= 2 && (
          <p className="font-display text-xl font-extrabold text-orange-500">🔥 Série de {mine.streak} bonnes réponses !</p>
        )}
        {reveal.explanation && <p className="card font-semibold">💡 {reveal.explanation}</p>}
        {mine && <p className="text-xl font-bold text-white/60">Tu es {rank === 1 ? '🥇 1er' : rank === 2 ? '🥈 2e' : rank === 3 ? '🥉 3e' : `${rank}e`} avec {mine.score} pts</p>}
        <p className="font-semibold text-white/50">{reveal.isLast ? 'Résultats finaux dans un instant…' : 'Prochaine question bientôt…'}</p>
      </div>
    );
  }

  if (state === 'podium' && podium) {
    const rank = podium.findIndex((p) => p.name === (entree?.nom || name.trim())) + 1;
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-7xl">🏁</div>
        <h1 className="font-display text-3xl font-extrabold">
          {rank === 1 ? '🏆 CHAMPION·NE !' : rank > 0 ? `Tu finis ${rank}e !` : 'Partie terminée !'}
        </h1>
        <div className="card space-y-2 text-left">
          {podium.slice(0, 10).map((p, i) => (
            <div key={p.name} className={`flex items-center justify-between rounded-xl px-4 py-2 font-bold ${p.name === (entree?.nom || name.trim()) ? 'bg-grape/10 text-grape-light' : ''}`}>
              <span>{['🥇', '🥈', '🥉'][i] || `${i + 1}.`} {p.name}</span>
              <span>{p.score} pts</span>
            </div>
          ))}
        </div>

        {reward && (
          <div className="card border-4 border-sunny bg-sunny/15/40">
            <p className="font-display text-xl font-extrabold">🎁 Champion·ne, tu gagnes {reward.credits} quiz gratuits !</p>
            <p className="mt-1 font-semibold text-white/60">Crée ton compte (30 s) pour les récupérer et organiser TA revanche.</p>
            <Link to={`/reward/${reward.code}`} className="btn-primary mt-3">🎁 Récupérer mon cadeau</Link>
          </div>
        )}

        <ShareButtons title={game.title} leaderboard={podium} />
        <Link to="/create" className="block font-bold text-grape-light underline">✨ Et si le prochain quiz, c'était le tien ?</Link>
      </div>
    );
  }

  return null;
}
