import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';
import AudioClip from '../components/AudioClip';

const SUGGESTIONS = ['Années 80', 'Années 90', 'Hits 2000', 'Disney', 'Rap français', 'Rock', 'Variété française', 'Queen', 'Beyoncé', 'Johnny Hallyday'];

export default function BlindTest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [saved, setSaved] = useState(null);

  const addSuggestion = (s) => {
    setQ((cur) => (cur.trim() ? `${cur.trim()}, ${s}` : s));
  };

  const generate = async () => {
    if (!q.trim()) { setError('Indique au moins un artiste, un genre ou une époque 🎶'); return; }
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
        body: { title: `🎧 Blind test : ${q.slice(0, 60)}`, category: 'blindtest', questions },
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
        <p className="mt-2 font-semibold text-slate-500">De la <b>vraie musique</b> : extraits de 30 secondes, 4 propositions, qui reconnaît le morceau en premier ?</p>
      </div>

      <div className="card space-y-5">
        <div>
          <label className="mb-2 block font-display font-extrabold">Artistes, genres ou époques (sépare par des virgules)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ex : Queen, Années 80, Disney" className="input" />
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => addSuggestion(s)}
                className="chip border-sky2/40 bg-sky2/10 text-sky-700 hover:border-sky2">+ {s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block font-display font-extrabold">Nombre de morceaux</label>
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
