import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { wsUrl } from '../api';
import { copier } from '../copie';
import AudioClip from '../components/AudioClip';
import ShareButtons from '../components/ShareButtons';
import { useAuth } from '../store';

const SHAPES = ['🔺', '🔷', '🟡', '🟢'];
const COLORS = ['bg-cherry', 'bg-sky2', 'bg-sunny text-white', 'bg-minty'];

export default function Host() {
  const { pin } = useParams();
  const { user, ready } = useAuth();
  const hostKey = sessionStorage.getItem(`host-${pin}`);
  const [state, setState] = useState('lobby');
  // L'animateur joue par défaut : c'est le cas le plus fréquent en soirée, et
  // cela lui garantit exactement le même traitement qu'aux autres joueurs.
  const [hostPlays, setHostPlays] = useState(true);
  const [monNom, setMonNom] = useState('Animateur');
  const [myAnswer, setMyAnswer] = useState(null);
  const [monNombre, setMonNombre] = useState('');
  const [copie, setCopie] = useState(null); // null | 'ok' | 'echec'
  const [game, setGame] = useState({ players: [] });
  const [q, setQ] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [podium, setPodium] = useState(null);
  const [answered, setAnswered] = useState({ answered: 0, total: 0 });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const phaseRef = useRef('lobby');

  useEffect(() => {
    // On attend de connaître le nom du compte : le serveur inscrit l'animateur
    // comme joueur dès la connexion, avec le nom passé ici.
    if (!hostKey || !ready) return;
    const nom = (user?.name || 'Animateur').trim().slice(0, 20) || 'Animateur';
    setMonNom(nom);
    const ws = new WebSocket(wsUrl(pin, { role: 'host', key: hostKey, name: nom }));
    wsRef.current = ws;
    ws.onerror = () => setError('Connexion impossible');
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'lobby') {
        setGame(m);
        // Statut restauré depuis le serveur : un rechargement de page ne fait
        // plus perdre sa place de joueur à l'animateur.
        setHostPlays(!!m.hostName);
        if (m.hostName) setMonNom(m.hostName);
        if (m.phase === 'lobby') setState('lobby');
      }
      if (m.t === 'hostJoined') { setHostPlays(true); setMonNom(m.name); }
      if (m.t === 'hostLeft') setHostPlays(false);
      if (m.t === 'answered') setMyAnswer(m.i ?? m.guess);
      if (m.t === 'question') {
        setQ(m); setReveal(null); setAnswered({ answered: 0, total: 0 }); setMyAnswer(null); setState('question');
        phaseRef.current = 'question';
        clearInterval(timerRef.current);
        const tick = () => {
          const left = Math.max(0, Math.ceil((m.endsAt - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left === 0) {
            clearInterval(timerRef.current);
            if (phaseRef.current === 'question') wsRef.current?.send(JSON.stringify({ t: 'next' }));
          }
        };
        tick();
        timerRef.current = setInterval(tick, 250);
      }
      if (m.t === 'answerCount') setAnswered(m);
      if (m.t === 'reveal') { phaseRef.current = 'reveal'; clearInterval(timerRef.current); setReveal(m); setState('reveal'); }
      if (m.t === 'podium') {
        phaseRef.current = 'podium';
        clearInterval(timerRef.current);
        setPodium(m.leaderboard); setState('podium');
        confetti({ particleCount: 250, spread: 100, origin: { y: 0.5 } });
      }
    };
    return () => { ws.close(); clearInterval(timerRef.current); };
  }, [pin, hostKey, ready, user?.name]);

  const send = (t) => wsRef.current?.send(JSON.stringify({ t }));

  if (!hostKey) {
    return (
      <div className="text-center">
        <p className="font-bold text-cherry">Clé d'animateur introuvable pour cette partie.</p>
        <Link to="/quizzes" className="btn-primary mt-4">Relancer une partie depuis mes quiz</Link>
      </div>
    );
  }

  const joinUrl = `${location.origin}/join/${pin}`;

  if (state === 'lobby') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <h1 className="font-display text-3xl font-extrabold">« {game.title || '…'} »</h1>
        <div className="card border-4 border-grape">
          <p className="font-display text-xl font-extrabold text-white/60">Rejoignez sur <span className="text-grape-light">{location.host}/join</span> avec le code :</p>
          <p className="my-4 font-display text-7xl font-extrabold tracking-widest text-grape-light">{pin.slice(0, 3)} {pin.slice(3)}</p>

          {/* Le lien est TOUJOURS affiché en clair et sélectionnable : même si la
              copie échoue (navigateur intégré, contexte non sécurisé), l'animateur
              peut le lire et le recopier. Il ne reste jamais sans solution. */}
          <input
            readOnly
            value={joinUrl}
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.target.select()}
            className="input mt-2 w-full text-center text-sm font-bold"
          />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={async () => setCopie((await copier(joinUrl)) ? 'ok' : 'echec')}
              className="btn-ghost !py-2 !text-sm"
            >
              {copie === 'ok' ? '✅ Lien copié !' : '🔗 Copier le lien'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Rejoins le quiz ! ${joinUrl}`)}`}
              target="_blank" rel="noreferrer"
              className="btn-ghost !py-2 !text-sm"
            >
              💬 Envoyer sur WhatsApp
            </a>
          </div>
          {copie === 'echec' && (
            <p className="mt-2 text-sm font-bold text-sunny">
              Ton navigateur bloque la copie — sélectionne le lien ci-dessus et copie-le à la main.
            </p>
          )}
        </div>
        <div className="card">
          <h2 className="font-display text-xl font-extrabold">{game.players?.length || 0} joueur(s) connecté(s) {game.maxPlayers ? `(max ${game.maxPlayers})` : ''}</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(game.players || []).map((p) => (
              <span key={p} className="animate-floaty rounded-full bg-bubble/15 px-4 py-2 font-bold text-bubble">{p}</span>
            ))}
            {(game.players || []).length === 0 && <p className="font-semibold text-white/50">En attente des joueurs… 👀</p>}
          </div>
        </div>
        {error && <p className="font-bold text-cherry">{error}</p>}
        <div className={`card !py-4 ${hostPlays ? 'border-2 border-minty/60' : ''}`}>
          <p className="font-display text-lg font-extrabold">
            {hostPlays ? `🙋 Tu joues aussi, sous le nom « ${monNom} »` : '🎙️ Tu animes seulement, sans jouer'}
          </p>
          <p className="mt-1 text-sm font-semibold text-white/55">
            {hostPlays
              ? 'Tu réponds depuis cet écran, avec le même chrono et les mêmes points que les autres.'
              : 'Tu ne réponds pas et tu n’apparais pas au classement.'}
          </p>
          <button
            onClick={() => wsRef.current?.send(JSON.stringify(hostPlays ? { t: 'hostLeave' } : { t: 'hostJoin', name: monNom }))}
            className="btn-ghost mt-3 !px-4 !py-2 !text-sm"
          >
            {hostPlays ? '🎙️ Finalement, j’anime sans jouer' : '🙋 Finalement, je joue aussi'}
          </button>
        </div>
        <button onClick={() => send('start')} disabled={(game.players || []).length === 0}
          className="btn-primary w-full text-2xl disabled:opacity-40">🚀 Lancer la partie !</button>
      </div>
    );
  }

  if (state === 'question' && q) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between font-display text-xl font-extrabold">
          <span className="rounded-full bg-grape px-4 py-1 text-white">Question {q.idx + 1} / {q.total}</span>
          <span className={`rounded-full px-5 py-1 text-white ${secondsLeft <= 5 ? 'animate-pulseBig bg-cherry' : 'bg-slate-700'}`}>⏱ {secondsLeft}s</span>
        </div>
        <div className="card text-center">
          <h2 className="font-display text-3xl font-extrabold">{q.question}</h2>
          {q.audioUrl && (
            <AudioClip key={q.idx} autoPlay src={q.audioUrl} className="mx-auto mt-4 w-full max-w-md" />
          )}
        </div>
        {q.options?.length === 1 ? (
          <div className="card border-2 border-sunny/60 text-center">
            <p className="font-display text-2xl font-extrabold text-sunny">💰 Le juste prix</p>
            <p className="mt-1 font-semibold text-white/60">
              Chacun propose un nombre sur son téléphone — le plus proche remporte la mise.
            </p>
            {hostPlays && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(String(monNombre).replace(',', '.'));
                  if (!Number.isFinite(v) || monNombre === '') return;
                  wsRef.current?.send(JSON.stringify({ t: 'answer', i: v }));
                  navigator.vibrate?.(40);
                }}
                className="mx-auto mt-4 flex max-w-sm gap-2"
              >
                <input
                  value={monNombre}
                  onChange={(e) => setMonNombre(e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 15))}
                  inputMode="decimal"
                  placeholder="Ton nombre"
                  disabled={myAnswer !== null}
                  className="input text-center font-display text-2xl font-extrabold"
                />
                <button className="btn-sunny whitespace-nowrap" disabled={myAnswer !== null || monNombre === ''}>
                  {myAnswer !== null ? '✅ Envoyé' : 'Je propose'}
                </button>
              </form>
            )}
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.options.map((o, i) => (
            hostPlays ? (
              <button
                key={i}
                disabled={myAnswer !== null}
                onClick={() => { wsRef.current?.send(JSON.stringify({ t: 'answer', i })); navigator.vibrate?.(40); }}
                className={`${COLORS[i % 4]} rounded-3xl p-4 text-left font-display text-xl font-extrabold text-white shadow-pop transition-all active:translate-y-1 active:shadow-none ${myAnswer !== null && myAnswer !== i ? 'opacity-40' : ''} ${myAnswer === i ? 'ring-4 ring-slate-800' : ''}`}
              >
                <span className="mr-2 text-3xl">{SHAPES[i % 4]}</span>{o}
              </button>
            ) : (
              <div key={i} className="card flex items-center gap-3 !py-4 font-display text-xl font-extrabold">
                <span className="text-3xl">{SHAPES[i % 4]}</span> {o}
              </div>
            )
          ))}
        </div>
        )}
        <div className="card flex items-center justify-between">
          <p className="font-display text-xl font-extrabold">✋ {answered.answered} / {answered.total || game.players?.length || 0} réponses</p>
          <button onClick={() => send('next')} className="btn-sunny">Révéler ⏭</button>
        </div>
      </div>
    );
  }

  if (state === 'reveal' && reveal) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h2 className="text-center font-display text-2xl font-extrabold">✅ La bonne réponse était :</h2>
        {reveal.propositions ? (
          <div className="space-y-3">
            <div className="card border-4 border-sunny text-center">
              <p className="font-display text-4xl font-extrabold text-sunny">
                {Number(reveal.bonneValeur).toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="card space-y-2">
              {reveal.propositions.length === 0 && (
                <p className="text-center font-semibold text-white/50">Personne n'a proposé de nombre.</p>
              )}
              {reveal.propositions.map((x, r) => (
                <div key={x.name} className={`flex items-center justify-between rounded-2xl px-4 py-2 font-bold ${r === 0 ? 'bg-minty/20 text-minty' : 'bg-white/5 text-white/70'}`}>
                  <span>{r === 0 ? '🏆' : `${r + 1}.`} {x.name}{x.exact ? ' 🎯' : ''}</span>
                  <span>{x.guess.toLocaleString('fr-FR')} <span className="text-white/40">(écart {x.ecart.toLocaleString('fr-FR')})</span></span>
                  <span className="text-sunny">+{x.points}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(reveal.options || q?.options || []).map((o, i) => (
            <div key={i} className={`card flex items-center justify-between !py-4 font-display text-xl font-extrabold ${i === reveal.correct ? 'border-4 border-minty' : 'opacity-50'}`}>
              <span>{SHAPES[i % 4]} {o}</span>
              <span className="text-white/50">{reveal.counts[i]} vote(s)</span>
            </div>
          ))}
        </div>
        )}
        {reveal.explanation && <p className="card bg-sunny/15 font-bold">💡 {reveal.explanation}</p>}
        {/* L'animateur qui joue voit son propre résultat, exactement comme un joueur. */}
        {hostPlays && (() => {
          const moi = reveal.leaderboard.find((p) => p.name === monNom);
          if (!moi) return null;
          const chiffre = reveal.bonneValeur !== null && reveal.bonneValeur !== undefined;
          const bon = chiffre ? (reveal.propositions?.[0]?.name === monNom) : myAnswer === reveal.correct;
          return (
            <div className={`card !py-4 text-center ${moi.delta > 0 ? 'border-2 border-minty/60' : ''}`}>
              <p className="font-display text-xl font-extrabold">
                {moi.delta > 0 ? `${bon ? '✅' : '💰'} Toi : +${moi.delta} points` : '❌ Toi : raté cette fois'}
              </p>
              {moi.streak >= 2 && <p className="font-display font-extrabold text-orange-500">🔥 Série de {moi.streak}</p>}
            </div>
          );
        })()}
        <div className="card">
          <h3 className="mb-3 font-display text-xl font-extrabold">🏆 Classement</h3>
          {reveal.leaderboard.slice(0, 5).map((p, i) => (
            <div key={p.name} className="flex items-center justify-between border-b border-white/10 py-2 font-bold last:border-0">
              <span>{['🥇', '🥈', '🥉'][i] || `${i + 1}.`} {p.name}</span>
              <span>{p.score} pts {p.delta > 0 && <span className="text-minty">(+{p.delta})</span>}</span>
            </div>
          ))}
        </div>
        <button onClick={() => send('next')} className="btn-primary w-full text-2xl">
          {reveal.isLast ? '🏁 Podium final !' : 'Question suivante →'}
        </button>
      </div>
    );
  }

  if (state === 'podium' && podium) {
    const [first, second, third] = podium;
    return (
      <div className="mx-auto max-w-2xl space-y-8 text-center">
        <h1 className="font-display text-4xl font-extrabold">🏆 PODIUM 🏆</h1>
        <div className="flex items-end justify-center gap-3">
          {second && (
            <div className="flex-1 rounded-t-3xl bg-slate-300 p-4 pt-6 text-slate-900">
              <div className="text-4xl">🥈</div>
              <p className="font-display text-xl font-extrabold">{second.name}</p>
              <p className="font-bold text-white/75">{second.score} pts</p>
            </div>
          )}
          {first && (
            <div className="flex-1 rounded-t-3xl bg-sunny p-4 pb-10 pt-8 text-slate-900">
              <div className="animate-wiggle text-6xl">👑</div>
              <p className="font-display text-2xl font-extrabold">{first.name}</p>
              <p className="font-bold text-white/85">{first.score} pts</p>
            </div>
          )}
          {third && (
            <div className="flex-1 rounded-t-3xl bg-orange-300 p-4 pt-4 text-slate-900">
              <div className="text-4xl">🥉</div>
              <p className="font-display text-xl font-extrabold">{third.name}</p>
              <p className="font-bold text-white/75">{third.score} pts</p>
            </div>
          )}
        </div>
        {podium.length > 3 && (
          <div className="card text-left">
            {podium.slice(3, 10).map((p, i) => (
              <div key={p.name} className="flex justify-between border-b border-white/10 py-1.5 font-bold last:border-0">
                <span>{i + 4}. {p.name}</span><span>{p.score} pts</span>
              </div>
            ))}
          </div>
        )}
        <ShareButtons title={game.title} leaderboard={podium} />
        <Link to="/quizzes" className="btn-primary">Rejouer avec un autre quiz 🎯</Link>
      </div>
    );
  }

  return <p className="text-center text-2xl">⏳ Connexion…</p>;
}
