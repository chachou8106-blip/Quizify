import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';
import AudioClip from '../components/AudioClip';

const THEMES = [
  { label: 'Années 80', emoji: '📼', color: '#7C3AED' },
  { label: 'Années 90', emoji: '💿', color: '#EC4899' },
  { label: 'Hits 2000', emoji: '📀', color: '#06B6D4' },
  { label: 'Hits du moment', emoji: '🔥', color: '#EF4444' },
  { label: 'Variété française', emoji: '🇫🇷', color: '#3B82F6' },
  { label: 'Disney', emoji: '🏰', color: '#8B5CF6' },
  { label: 'Rap français', emoji: '🎤', color: '#334155' },
  { label: 'Rock', emoji: '🎸', color: '#B45309' },
  { label: 'Disco funk', emoji: '🪩', color: '#EAB308' },
  { label: 'Musiques de films', emoji: '🎬', color: '#10B981' },
  { label: 'Latino', emoji: '💃', color: '#F97316' },
  { label: 'Slows & love songs', emoji: '💘', color: '#F43F5E' },
];

export default function BlindTest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [custom, setCustom] = useState('');
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [saved, setSaved] = useState(null);

  const toggle = (label) => {
    setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  };

  const themeQuery = () => [...selected, ...custom.split(',').map((s) => s.trim()).filter(Boolean)].join(', ');

  const generate = async () => {
    const q = themeQuery();
    if (!q) { setError('Choisis au moins un thème ou tape un artiste 🎶'); return; }
    setLoading(true); setError(''); setSaved(null);
    try {
      const d = await api(`/api/music/blindtest?q=${encodeURIComponent(q)}&count=${count}`);
      setQuestions(d.questions);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!user) { navigate('/signup?next=/blindtest'); return; }
    setLoading(true); setError('');
    try {
      const d = await api('/api/quizzes', {
        method: 'POST',
        body: { title: `🎧 Blind test : ${themeQuery().slice(0, 60)}`, category: 'blindtest', questions },
      });
      setSaved(d.quiz);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="animate-floaty text-6xl">🎧</div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Blind Test musical</h1>
        <p className="mt-2 font-semibold text-slate-500">De la <b>vraie musique</b> : extraits de 15 secondes, 4 propositions — qui reconnaît le morceau en premier ?</p>
      </div>

      {/* Étape 1 — Thèmes */}
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-grape px-3 py-0.5 text-white">1</span>Tes ambiances <span className="text-base font-bold text-slate-400">(plusieurs possibles)</span></h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEMES.map((t) => {
            const on = selected.includes(t.label);
            return (
              <button
                key={t.label}
                onClick={() => toggle(t.label)}
                className={`rounded-2xl border-2 p-3 text-left transition-all ${on ? 'shadow-card' : 'border-slate-200 bg-white'}`}
                style={on ? { borderColor: t.color, backgroundColor: t.color + '18' } : {}}
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="font-display text-sm font-extrabold leading-tight">{t.label}</div>
              </button>
            );
          })}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-extrabold text-slate-500">Ou tes artistes / albums précis (sépare par des virgules)</label>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ex : Queen, Céline Dion, Daft Punk" className="input" />
        </div>
      </div>

      {/* Étape 2 — Réglages */}
      <div className="card space-y-4">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-bubble px-3 py-0.5 text-white">2</span>La playlist</h2>
        <div>
          <label className="mb-1.5 block text-sm font-extrabold text-slate-500">Nombre de morceaux</label>
          <select value={count} onChange={(e) => setCount(+e.target.value)} className="input sm:w-40">
            {[5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {error && <p className="font-bold text-cherry">{error}</p>}
        <button onClick={generate} disabled={loading} className="btn-primary w-full text-xl">
          {loading ? '🎶 Recherche des morceaux…' : '🎶 Créer le blind test'}
        </button>
        <p className="text-center text-sm font-semibold text-slate-400">Gratuit et illimité — ne compte pas dans ton quota IA ✨</p>
      </div>

      {questions && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold">Aperçu ({questions.length} morceaux)</h2>
            <button onClick={generate} disabled={loading} className="btn-ghost !px-4 !py-2 !text-sm">🔄 Autres morceaux</button>
          </div>
          <ol className="space-y-3">
            {questions.map((question, i) => (
              <li key={i} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  {question.artwork && <img src={question.artwork} alt="" className="h-14 w-14 rounded-xl" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{i + 1}. {question.options[question.correct]}</p>
                    <AudioClip src={question.audioUrl} className="mt-1 w-full" />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {!saved ? (
            <button onClick={save} disabled={loading} className="btn-pink w-full text-xl">💾 Enregistrer ce blind test</button>
          ) : (
            <div className="space-y-3 rounded-2xl bg-sky2/10 p-4">
              <p className="font-display text-lg font-extrabold text-sky-600">✅ Prêt ! En mode live, la musique joue sur TON téléphone (mets le son à fond 🔊) :</p>
              <QuizActions quiz={saved} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
