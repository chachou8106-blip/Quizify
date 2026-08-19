import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';
import AudioClip from '../components/AudioClip';
import CountPicker from '../components/CountPicker';

const THEMES = [
  { label: 'Hits du moment', emoji: '🔥', color: '#EF4444' },
  { label: 'Années 2010', emoji: '📱', color: '#6366F1' },
  { label: 'Hits 2000', emoji: '📀', color: '#06B6D4' },
  { label: 'Années 90', emoji: '💿', color: '#EC4899' },
  { label: 'Années 80', emoji: '📼', color: '#7C3AED' },
  { label: 'Années 70', emoji: '🕺', color: '#F59E0B' },
  { label: 'Années 60 yéyé', emoji: '🎙️', color: '#B45309' },
  { label: 'Variété française', emoji: '🇫🇷', color: '#3B82F6' },
  { label: 'Chanson française (Brel, Piaf…)', emoji: '🥖', color: '#A16207' },
  { label: 'Rap français', emoji: '🎤', color: '#334155' },
  { label: 'Rap US', emoji: '🧢', color: '#0F766E' },
  { label: 'R&B Soul', emoji: '🎷', color: '#9333EA' },
  { label: 'Pop internationale', emoji: '🌍', color: '#0EA5E9' },
  { label: 'Rock', emoji: '🎸', color: '#B91C1C' },
  { label: 'Rock français', emoji: '⚡', color: '#7C2D12' },
  { label: 'Métal', emoji: '🤘', color: '#1E293B' },
  { label: 'Électro house', emoji: '🎛️', color: '#22D3EE' },
  { label: 'Techno', emoji: '🌀', color: '#4338CA' },
  { label: 'Disco funk', emoji: '🪩', color: '#EAB308' },
  { label: 'Reggae', emoji: '🦁', color: '#16A34A' },
  { label: 'Latino reggaeton', emoji: '💃', color: '#F97316' },
  { label: 'Afrobeat', emoji: '🥁', color: '#CA8A04' },
  { label: 'Zouk & Antilles', emoji: '🏝️', color: '#0D9488' },
  { label: 'K-pop', emoji: '🇰🇷', color: '#DB2777' },
  { label: 'Jazz', emoji: '🎺', color: '#78350F' },
  { label: 'Musique classique', emoji: '🎻', color: '#64748B' },
  { label: 'Country', emoji: '🤠', color: '#92400E' },
  { label: 'Disney', emoji: '🏰', color: '#8B5CF6' },
  { label: 'Musiques de films', emoji: '🎬', color: '#10B981' },
  { label: 'Génériques de séries', emoji: '📺', color: '#0891B2' },
  { label: 'Musiques de jeux vidéo', emoji: '🎮', color: '#7C3AED' },
  { label: 'Slows & love songs', emoji: '💘', color: '#F43F5E' },
  { label: 'Tubes de mariage', emoji: '💍', color: '#E11D48' },
  { label: 'Tubes de l\'été', emoji: '☀️', color: '#FBBF24' },
  { label: 'Chansons de Noël', emoji: '🎄', color: '#15803D' },
  { label: 'Comptines & enfants', emoji: '🧸', color: '#FB7185' },
  { label: 'Karaoké culte', emoji: '🎙️', color: '#D946EF' },
  { label: 'Eurovision', emoji: '🏆', color: '#2563EB' },
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
  const [hideAnswers, setHideAnswers] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);

  const toggle = (label) => {
    setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  };

  const themeQuery = () => [...selected, ...custom.split(',').map((s) => s.trim()).filter(Boolean)].join(', ');

  const generate = async () => {
    const artists = custom.split(',').map((s) => s.trim()).filter(Boolean).join(',');
    if (!selected.length && !artists) { setError('Choisis au moins un thème ou tape un artiste 🎶'); return; }
    setLoading(true); setError(''); setSaved(null);
    try {
      const d = await api(`/api/music/blindtest?themes=${encodeURIComponent(selected.join(','))}&artists=${encodeURIComponent(artists)}&count=${count}`);
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
        <p className="mt-2 font-semibold text-white/60">De la <b>vraie musique</b> : extraits de 15 secondes, 4 propositions — qui reconnaît le morceau en premier ?</p>
      </div>

      {/* Étape 1 — Thèmes */}
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-grape px-3 py-0.5 text-white">1</span>Tes ambiances <span className="text-base font-bold text-white/50">(plusieurs possibles)</span></h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(showAllThemes ? THEMES : THEMES.slice(0, 8)).map((t) => {
            const on = selected.includes(t.label);
            return (
              <button
                key={t.label}
                onClick={() => toggle(t.label)}
                className={`rounded-2xl border-2 p-3 text-left transition-all ${on ? 'tile-on' : 'border-white/15 bg-white/5 hover:border-white/35'}`}
                style={on ? { borderColor: t.color, backgroundColor: t.color + '30' } : {}}
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="font-display text-sm font-extrabold leading-tight">{t.label}</div>
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowAllThemes(!showAllThemes)} className="w-full rounded-xl py-2 font-bold text-grape-light hover:bg-white/5">
          {showAllThemes ? '▲ Réduire' : `▼ Voir les ${THEMES.length - 8} autres ambiances`}
        </button>
        {selected.length > 0 && (
          <p className="text-sm font-bold text-white/60">✅ {selected.length} ambiance(s) : {selected.join(' · ')}</p>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-extrabold text-white/60">Ou tes artistes / albums précis (sépare par des virgules)</label>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ex : Queen, Céline Dion, Daft Punk" className="input" />
        </div>
      </div>

      {/* Étape 2 — Réglages */}
      <div className="card space-y-4">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-bubble px-3 py-0.5 text-white">2</span>La playlist</h2>
        <div>
          <label className="mb-1.5 block text-sm font-extrabold text-white/60">Nombre de morceaux</label>
          <CountPicker value={count} onChange={setCount} max={50} />
        </div>
        {error && <p className="font-bold text-cherry">{error}</p>}
        <button onClick={generate} disabled={loading} className="btn-primary w-full text-xl">
          {loading ? '🎶 Recherche des morceaux…' : '🎶 Créer le blind test'}
        </button>
        <p className="text-center text-sm font-semibold text-white/50">Gratuit et illimité — ne compte pas dans ton quota IA ✨</p>
      </div>

      {questions && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">Aperçu ({questions.length} morceaux)</h2>
            <div className="flex gap-2">
              <button onClick={() => setHideAnswers(!hideAnswers)} className="btn-ghost !px-4 !py-2 !text-sm">
                {hideAnswers ? '👀 Tout voir' : '🙈 Masquer (je joue aussi)'}
              </button>
              <button onClick={generate} disabled={loading} className="btn-ghost !px-4 !py-2 !text-sm">🔄 Autres morceaux</button>
            </div>
          </div>
          {hideAnswers ? (
            <div className="rounded-2xl bg-white/5 p-6 text-center">
              <div className="text-4xl">🙈🎶</div>
              <p className="mt-2 font-display text-lg font-extrabold">{questions.length} morceaux surprise prêts !</p>
              <p className="font-semibold text-white/50">Les titres et extraits sont cachés pour que tu puisses jouer toi aussi.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {questions.map((question, i) => (
                <li key={i} className="rounded-2xl bg-white/5 p-4">
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
          )}
          {!saved ? (
            <button onClick={save} disabled={loading} className="btn-pink w-full text-xl">💾 Enregistrer ce blind test</button>
          ) : (
            <div className="space-y-3 rounded-2xl bg-sky2/10 p-4">
              <p className="font-display text-lg font-extrabold text-sky2-light">✅ Prêt ! En mode live, la musique joue sur TON téléphone (mets le son à fond 🔊) :</p>
              <QuizActions quiz={saved} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
