import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { wsUrl } from '../api';
import AudioClip from '../components/AudioClip';
import ShareButtons from '../components/ShareButtons';
import { useAuth } from '../store';

const SHAPES = ['🔺', '🔷', '🟡', '🟢'];
const COLORS = ['bg-cherry', 'bg-sky2', 'bg-sunny text-white', 'bg-minty'];

export default function Host() {
  const { pin } = useParams();
  const { user } = useAuth();
  const hostKey = sessionStorage.getItem(`host-${pin}`);
  const [state, setState] = useState('lobby');
  const [hostPlays, setHostPlays] = useState(false);
  const [myAnswer, setMyAnswer] = useState(null);
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
    if (!hostKey) return;
    const ws = new WebSocket(wsUrl(pin, { role: 'host', key: hostKey }));
    wsRef.current = ws;
    ws.onerror = () => setError('Connexion impossible');
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'lobby') { setGame(m); if (m.phase === 'lobby') setState('lobby'); }
      if (m.t === 'hostJoined') setHostPlays(true);
      if (m.t === 'answered') setMyAnswer(m.i);
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
  }, [pin, hostKey]);

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
          <button onClick={() => navigator.clipboard?.writeText(joinUrl)} className="btn-ghost !py-2 !text-sm">🔗 Copier le lien d'invitation</button>
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
        <button
          onClick={() => wsRef.current?.send(JSON.stringify({ t: 'hostJoin', name: user?.name || 'Animateur' }))}
          disabled={hostPlays}
          className={`w-full rounded-2xl border-2 py-3 font-display text-lg font-extrabold transition-all ${hostPlays ? 'border-minty bg-minty/25 text-emerald-900' : 'border-grape/40 bg-white/10 text-grape-light hover:border-grape'}`}
        >
          {hostPlays ? `✅ Tu joues aussi (${user?.name || 'Animateur'}) !` : '🙋 Je joue aussi !'}
        </button>
        <button onClick={() => send('start')} disabled={(game.players || []).length === 0 && !hostPlays}
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
        <div className="grid gap-3 sm:grid-cols-2">
          {(q?.options || []).map((o, i) => (
            <div key={i} className={`card flex items-center justify-between !py-4 font-display text-xl font-extrabold ${i === reveal.correct ? 'border-4 border-minty' : 'opacity-50'}`}>
              <span>{SHAPES[i % 4]} {o}</span>
              <span className="text-white/50">{reveal.counts[i]} vote(s)</span>
            </div>
          ))}
        </div>
        {reveal.explanation && <p className="card bg-sunny/15 font-bold">💡 {reveal.explanation}</p>}
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
