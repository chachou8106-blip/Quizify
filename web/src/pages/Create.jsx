import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';
import CountPicker from '../components/CountPicker';

const TYPES = [
  { value: 'mixed', label: '🎲 Mix surprise', hint: 'Tous les styles mélangés' },
  { value: 'multipleChoice', label: '❓ QCM', hint: '4 options classiques' },
  { value: 'trueFalse', label: '⚖️ Vrai / Faux', hint: 'Simple et rapide' },
  { value: 'emoji', label: '😀 Devinette Emoji', hint: 'Devine avec des emojis' },
  { value: 'riddle', label: '🕵️ Qui suis-je ?', hint: '3 indices progressifs' },
  { value: 'chrono', label: '🕰️ Lequel en premier ?', hint: 'Chronologie' },
  { value: 'intru', label: '🔍 Trouve l\'intrus', hint: 'Un ne colle pas…' },
  { value: 'quote', label: '💬 Qui a dit ça ?', hint: 'Citations célèbres' },
  { value: 'year', label: '📅 En quelle année ?', hint: 'Dates marquantes' },
  { value: 'anagram', label: '🔤 Anagrammes', hint: 'Lettres mélangées' },
  { value: 'math', label: '🧮 Calcul mental', hint: 'Réponses calculées, 100 % justes — idéal devoirs' },
];

export default function Create() {
  const { user, ready, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [categories, setCategories] = useState({});
  const [category, setCategory] = useState(params.get('cat') || 'free');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState(params.get('type') || 'mixed');
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState('medium');
  const [showAllCats, setShowAllCats] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [saved, setSaved] = useState(null);
  const [hideAnswers, setHideAnswers] = useState(false);

  useEffect(() => {
    api('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready && !user) navigate('/signup?next=/create');
  }, [ready, user, navigate]);

  const catEntries = Object.entries(categories).filter(([id]) => id !== 'birthday' && id !== 'blindtest');
  const visibleCats = showAllCats ? catEntries : catEntries.slice(0, 7);

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
      setError(e.code === 'quota' ? 'quota' : e.message);
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

  const selectedType = TYPES.find((t) => t.value === type);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">🤖 Crée ton quiz</h1>
        <p className="mt-1 font-semibold text-white/60">N'importe quel sujet, prêt en 30 secondes.</p>
      </div>

      {/* Étape 1 — Sujet */}
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-grape px-3 py-0.5 text-white">1</span>Ton sujet</h2>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={'"Les années 80", "Harry Potter", "Le mariage de Julie et Tom", "Notre voyage en Italie"… ou colle un texte entier : l\'IA fera les questions dessus.'}
          className="input h-24 resize-none"
        />
      </div>

      {/* Étape 2 — Catégorie (optionnelle) */}
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-bubble px-3 py-0.5 text-white">2</span>Catégorie <span className="text-base font-bold text-white/50">(optionnelle)</span></h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => setCategory('free')}
            className={`rounded-2xl border-2 p-3 text-left transition-all ${category === 'free' ? 'border-grape bg-grape/10 shadow-card' : 'border-white/15 bg-white/10 hover:border-grape/50'}`}
          >
            <div className="text-2xl">✨</div>
            <div className="font-display text-sm font-extrabold">Sujet libre</div>
            <div className="text-xs font-semibold text-white/50">Sans catégorie</div>
          </button>
          {visibleCats.map(([id, cat]) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={`rounded-2xl border-2 p-3 text-left transition-all ${category === id ? 'shadow-card' : 'border-white/15 bg-white/10'}`}
              style={category === id ? { borderColor: cat.color, backgroundColor: cat.color + '18' } : {}}
            >
              <div className="text-2xl">{cat.emoji}</div>
              <div className="font-display text-sm font-extrabold leading-tight">{cat.name}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setShowAllCats(!showAllCats)} className="w-full rounded-xl py-2 font-bold text-grape-light hover:bg-white/5">
          {showAllCats ? '▲ Réduire' : `▼ Voir les ${catEntries.length - 7} autres catégories`}
        </button>
      </div>

      {/* Étape 3 — Réglages */}
      <div className="card space-y-4">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-sky2 px-3 py-0.5 text-white">3</span>Le style de jeu</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm font-extrabold text-white/60">Type de quiz</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {selectedType && <p className="mt-1 text-xs font-bold text-white/50">{selectedType.hint}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-extrabold text-white/60">Questions</label>
            <CountPicker value={count} onChange={setCount} max={40} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-extrabold text-white/60">Difficulté</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
              <option value="easy">😊 Facile</option>
              <option value="medium">🤔 Moyen</option>
              <option value="hard">🔥 Difficile</option>
            </select>
          </div>
        </div>

        {error === 'quota' ? (
          <div className="rounded-2xl bg-sunny/15 p-4 text-center font-bold">
            ⚡ Tu as utilisé tes 3 générations gratuites du mois.{' '}
            <Link to="/pricing" className="text-grape-light underline">Passe en Premium</Link> pour générer sans limite !
          </div>
        ) : error && <p className="font-bold text-cherry">{error}</p>}

        <button onClick={generate} disabled={loading} className="btn-primary w-full text-xl">
          {loading ? '✨ L\'IA réfléchit…' : '✨ Générer le quiz'}
        </button>
      </div>

      {questions && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">Aperçu ({questions.length} questions)</h2>
            <div className="flex gap-2">
              <button onClick={() => setHideAnswers(!hideAnswers)} className="btn-ghost !px-4 !py-2 !text-sm">
                {hideAnswers ? '👀 Voir les réponses' : '🙈 Masquer (je joue aussi)'}
              </button>
              <button onClick={generate} disabled={loading} className="btn-ghost !px-4 !py-2 !text-sm">🔄 Régénérer</button>
            </div>
          </div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="rounded-2xl bg-white/5 p-4">
                <p className="font-bold">{i + 1}. {q.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((o, j) => (
                    <span key={j} className={`rounded-full px-3 py-1 text-sm font-bold ${!hideAnswers && j === q.correct ? 'bg-minty-light text-emerald-900' : 'bg-white/10 text-white/60'}`}>{o}</span>
                  ))}
                </div>
                {!hideAnswers && q.explanation && <p className="mt-2 text-sm font-semibold text-white/50">💡 {q.explanation}</p>}
              </li>
            ))}
          </ol>
          {!saved ? (
            <button onClick={save} disabled={loading} className="btn-pink w-full text-xl">💾 Enregistrer ce quiz</button>
          ) : (
            <div className="space-y-3 rounded-2xl bg-grape/5 p-4">
              <p className="font-display text-lg font-extrabold text-grape-light">✅ Quiz enregistré ! Et maintenant :</p>
              <QuizActions quiz={saved} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
