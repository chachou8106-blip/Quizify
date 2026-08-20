import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../api';
import AudioClip from '../components/AudioClip';

// Solo play — for /play/:id (own quiz) and /s/:code (shared link).
export default function Player({ mode }) {
  const { id, code } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const path = mode === 'own' ? `/api/quizzes/${id}` : `/api/shared/${code}`;
    api(path).then((d) => setQuiz(d.quiz)).catch((e) => setError(e.message));
  }, [mode, id, code]);

  useEffect(() => {
    if (done && score >= (quiz?.questions.length || 0) * 0.6) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }, [done]); // eslint-disable-line

  if (error) return <p className="text-center font-bold text-cherry">{error}</p>;
  if (!quiz) return <p className="text-center text-2xl">⏳ Chargement…</p>;

  const q = quiz.questions[idx];
  const total = quiz.questions.length;

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) {
      setScore((s) => s + 1);
      confetti({ particleCount: 45, spread: 65, origin: { y: 0.75 }, scalar: 0.8 });
      navigator.vibrate?.(60);
    } else {
      navigator.vibrate?.([40, 60, 40]);
    }
  };

  const next = () => {
    if (idx + 1 >= total) setDone(true);
    else { setIdx(idx + 1); setPicked(null); }
  };

  if (done) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-7xl">{pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'}</div>
        <h1 className="font-display text-4xl font-extrabold">{score} / {total}</h1>
        <p className="text-xl font-bold text-white/60">
          {pct >= 80 ? 'Incroyable, tu es imbattable !' : pct >= 50 ? 'Bien joué !' : 'Pas mal, retente ta chance !'}
        </p>
        {quiz.sources?.length > 0 && (
          <div className="card text-left">
            <p className="font-display font-extrabold text-minty">📖 Sources vérifiées</p>
            <ul className="mt-2 space-y-1">
              {quiz.sources.map((s2) => (
                <li key={s2.url}><a href={s2.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-white/70 underline hover:text-white">{s2.title}</a></li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-center gap-3">
          <button onClick={() => { setIdx(0); setPicked(null); setScore(0); setDone(false); }} className="btn-primary">🔄 Rejouer</button>
          <Link to="/create" className="btn-ghost">✨ Créer mon quiz</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between font-display font-extrabold">
        <span className="text-white/50">{quiz.emoji} {quiz.title} {quiz.verified ? <span className="ml-1 rounded-full bg-minty/25 px-2 py-0.5 text-xs text-minty">✅ vérifié</span> : null}</span>
        <span className="rounded-full bg-grape px-4 py-1 text-white">{idx + 1} / {total}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-grape to-bubble transition-all" style={{ width: `${((idx + (picked !== null ? 1 : 0)) / total) * 100}%` }} />
      </div>

      <div className="card">
        <h2 className="font-display text-2xl font-extrabold">{q.question}</h2>
        {q.audioUrl && (
          <AudioClip key={idx} autoPlay src={q.audioUrl} className="mt-4 w-full" />
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {q.options.map((o, i) => {
            let cls = 'border-white/15 bg-white/10 hover:border-grape';
            if (picked !== null) {
              if (i === q.correct) cls = 'border-minty bg-minty/25';
              else if (i === picked) cls = 'border-cherry bg-cherry/25';
              else cls = 'border-white/10 bg-white/5 opacity-60';
            }
            return (
              <button key={i} onClick={() => pick(i)} disabled={picked !== null}
                className={`rounded-2xl border-2 p-4 text-left font-bold transition-all ${cls}`}>
                {['🔺', '🔷', '🟡', '🟢'][i] || '▪️'} {o}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="mt-5 space-y-3">
            <p className="font-display text-xl font-extrabold">
              {picked === q.correct ? '✅ Bonne réponse !' : `❌ Raté ! C'était : ${q.options[q.correct]}`}
            </p>
            {q.explanation && <p className="rounded-2xl bg-sunny/15 p-3 font-semibold">💡 {q.explanation}</p>}
            <button onClick={next} className="btn-primary w-full">{idx + 1 >= total ? '🏁 Voir mon score' : 'Question suivante →'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
