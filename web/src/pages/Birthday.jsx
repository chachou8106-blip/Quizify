import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';

export default function Birthday() {
  const { user, ready, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [facts, setFacts] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (ready && !user) navigate('/signup?next=/birthday');
  }, [ready, user, navigate]);

  const generate = async () => {
    if (!name.trim() || facts.trim().length < 30) {
      setError('Donne le prénom et au moins quelques anecdotes (plus tu en donnes, plus le quiz est drôle) 🎈');
      return;
    }
    setLoading(true); setError(''); setSaved(null);
    try {
      const d = await api('/api/ai/generate', {
        method: 'POST',
        body: {
          category: 'birthday',
          type: 'multipleChoice',
          count,
          difficulty: 'medium',
          language: 'fr',
          personalFacts: `La personne fêtée s'appelle ${name}.\n${facts}`,
        },
      });
      setQuestions(d.questions);
      refresh();
    } catch (e) {
      setError(e.code === 'quota' ? 'quota' : e.message);
    } finally { setLoading(false); }
  };

  const save = async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/quizzes', {
        method: 'POST',
        body: { title: `🎂 Quiz de ${name}`, category: 'birthday', questions },
      });
      setSaved(d.quiz);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!ready || !user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="animate-wiggle text-6xl">🎂</div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Le quiz anniversaire</h1>
        <p className="mt-2 font-semibold text-slate-500">Qui connaît le mieux la star du jour ? Raconte des anecdotes, l'IA écrit le quiz — et invente des mauvaises réponses très plausibles 😈</p>
      </div>

      <div className="card space-y-5">
        <div>
          <h2 className="mb-2 font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-grape px-3 py-0.5 text-white">1</span>Prénom de la star 🎉</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Léa" className="input" />
        </div>
        <div>
          <h2 className="mb-2 font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-bubble px-3 py-0.5 text-white">2</span>Anecdotes, goûts, souvenirs, manies…</h2>
          <textarea
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            placeholder={"Une info par ligne, par exemple :\n- Son plat préféré est les lasagnes\n- Elle a raté son permis 3 fois\n- Son premier concert : Beyoncé en 2016\n- Elle déteste les araignées\n- Son surnom en famille est « Choupette »"}
            className="input h-48 resize-none"
          />
        </div>
        <div>
          <h2 className="mb-2 font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-sky2 px-3 py-0.5 text-white">3</span>Nombre de questions</h2>
          <select value={count} onChange={(e) => setCount(+e.target.value)} className="input sm:w-40">
            {[5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {error === 'quota' ? (
          <div className="rounded-2xl bg-sunny-light p-4 text-center font-bold">
            ⚡ Générations gratuites du mois épuisées. <Link to="/pricing" className="text-grape underline">Le Pass Événement (14,99 €)</Link> débloque tout pour ta fête !
          </div>
        ) : error && <p className="font-bold text-cherry">{error}</p>}

        <button onClick={generate} disabled={loading} className="btn-pink w-full text-xl">
          {loading ? '🎁 Préparation de la surprise…' : '🎁 Générer le quiz surprise'}
        </button>
      </div>

      {questions && (
        <div className="card space-y-4">
          <h2 className="font-display text-2xl font-extrabold">Aperçu — vérifie que tout est juste 👀</h2>
          <p className="font-semibold text-slate-400">💡 Ici tu vois les réponses pour vérifier les anecdotes — normal, c'est TON quiz sur elle. En partie live, active « 🙋 Je joue aussi » pour participer quand même !</p>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{i + 1}. {q.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((o, j) => (
                    <span key={j} className={`rounded-full px-3 py-1 text-sm font-bold ${j === q.correct ? 'bg-minty-light text-emerald-900' : 'bg-white text-slate-500'}`}>{o}</span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex gap-3">
            <button onClick={generate} disabled={loading} className="btn-ghost">🔄 Régénérer</button>
            {!saved && <button onClick={save} disabled={loading} className="btn-primary flex-1">💾 Enregistrer</button>}
          </div>
          {saved && (
            <div className="space-y-3 rounded-2xl bg-bubble/10 p-4">
              <p className="font-display text-lg font-extrabold text-bubble">🎉 Prêt pour la fête ! Le jour J :</p>
              <QuizActions quiz={saved} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
