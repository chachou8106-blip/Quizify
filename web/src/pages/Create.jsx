import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';

export default function Create() {
  const { user, ready, refresh } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState({});
  const [category, setCategory] = useState('culture');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('multipleChoice');
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    api('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready && !user) navigate('/signup?next=/create');
  }, [ready, user, navigate]);

  const generate = async () => {
    if (!topic.trim()) { setError('Décris le sujet de ton quiz ✍️'); return; }
    setLoading(true); setError(''); setSaved(null);
    try {
      const d = await api('/api/ai/generate', {
        method: 'POST',
        body: { topic, category, type, count, difficulty, language: 'fr' },
      });
      setQuestions(d.questions);
      refresh();
    } catch (e) {
      if (e.code === 'quota') {
        setError('quota');
      } else setError(e.message);
    } finally { setLoading(false); }
  };

  const save = async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/quizzes', {
        method: 'POST',
        body: { title: topic.slice(0, 80), category, difficulty, questions },
      });
      setSaved(d.quiz);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!ready || !user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">🤖 Créer un quiz avec l'IA</h1>

      <div className="card space-y-5">
        <div>
          <label className="mb-2 block font-display font-extrabold">Catégorie</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categories).filter(([id]) => id !== 'birthday').map(([id, cat]) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                className="chip"
                style={category === id
                  ? { backgroundColor: cat.color, borderColor: cat.color, color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#E2E8F0', color: '#475569' }}
              >
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-display font-extrabold">Sujet du quiz</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={'Ex : "Les années 80", "Harry Potter", "La coupe du monde de foot"… ou colle un texte entier, l\'IA fera les questions dessus.'}
            className="input h-28 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block font-display font-extrabold">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              <option value="multipleChoice">QCM (4 options)</option>
              <option value="trueFalse">Vrai / Faux</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block font-display font-extrabold">Questions</label>
            <select value={count} onChange={(e) => setCount(+e.target.value)} className="input">
              {[5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block font-display font-extrabold">Difficulté</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
              <option value="easy">😊 Facile</option>
              <option value="medium">🤔 Moyen</option>
              <option value="hard">🔥 Difficile</option>
            </select>
          </div>
        </div>

        {error === 'quota' ? (
          <div className="rounded-2xl bg-sunny-light p-4 text-center font-bold">
            ⚡ Tu as utilisé tes 3 générations gratuites du mois.{' '}
            <Link to="/pricing" className="text-grape underline">Passe en Premium</Link> pour générer sans limite !
          </div>
        ) : error && <p className="font-bold text-cherry">{error}</p>}

        <button onClick={generate} disabled={loading} className="btn-primary w-full text-xl">
          {loading ? '✨ L\'IA réfléchit…' : '✨ Générer le quiz'}
        </button>
      </div>

      {questions && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold">Aperçu ({questions.length} questions)</h2>
            <button onClick={generate} disabled={loading} className="btn-ghost !px-4 !py-2 !text-sm">🔄 Régénérer</button>
          </div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{i + 1}. {q.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((o, j) => (
                    <span key={j} className={`rounded-full px-3 py-1 text-sm font-bold ${j === q.correct ? 'bg-minty-light text-emerald-900' : 'bg-white text-slate-500'}`}>{o}</span>
                  ))}
                </div>
                {q.explanation && <p className="mt-2 text-sm font-semibold text-slate-400">💡 {q.explanation}</p>}
              </li>
            ))}
          </ol>
          {!saved ? (
            <button onClick={save} disabled={loading} className="btn-pink w-full text-xl">💾 Enregistrer ce quiz</button>
          ) : (
            <div className="space-y-3 rounded-2xl bg-grape/5 p-4">
              <p className="font-display text-lg font-extrabold text-grape">✅ Quiz enregistré ! Et maintenant :</p>
              <QuizActions quiz={saved} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
