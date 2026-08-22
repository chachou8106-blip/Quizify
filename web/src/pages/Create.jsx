import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';
import QuizActions from '../components/QuizActions';
import CountPicker from '../components/CountPicker';
import QuizPreview from '../components/QuizPreview';

const TYPES = [
  { value: 'multipleChoice', label: 'QCM — 4 réponses au choix', hint: 'Le grand classique, parfait pour tout le monde.' },
  { value: 'year', label: '📅 En quelle année ?', hint: 'On devine la bonne date.' },
  { value: 'quote', label: '💬 Qui a dit ça ?', hint: 'Une phrase célèbre, à qui appartient-elle ?' },
  { value: 'chrono', label: '🕰️ Lequel en premier ?', hint: 'Remets les événements dans l\'ordre.' },
  { value: 'intru', label: '🔍 Trouve l\'intrus', hint: 'Quatre propositions, une n\'a rien à faire là.' },
  { value: 'price', label: '💰 Le juste prix', hint: 'Une réponse chiffrée : chacun propose un nombre, le plus proche gagne.' },
  { value: 'math', label: '🧮 Calcul mental', hint: 'Idéal pour faire travailler les enfants.' },
  { value: 'anagram', label: '🔤 Anagrammes', hint: 'Des lettres mélangées à remettre en ordre.' },
  { value: 'mixed', label: '🎲 Mix surprise', hint: 'Un peu de tous les styles.' },
  { value: 'trueFalse', label: '⚖️ Vrai / Faux', hint: 'Rapide et efficace.' },
  { value: 'emoji', label: '😄 Devinette Emoji', hint: 'Devine le mot caché derrière les emojis.' },
  { value: 'riddle', label: '🕵️ Qui suis-je ?', hint: 'Des indices, une réponse.' },
];

export default function Create() {
  const { user, ready, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [categories, setCategories] = useState({});
  const [category, setCategory] = useState(params.get('cat') || 'free');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState(params.get('type') || 'multipleChoice');
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState('medium');
  const [showAllCats, setShowAllCats] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [saved, setSaved] = useState(null);
  const [sources, setSources] = useState(null);
  const [titre, setTitre] = useState('');
  const [correction, setCorrection] = useState(null);
  const [alerte, setAlerte] = useState('');

  useEffect(() => {
    api('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready && !user) navigate('/signup?next=/create');
  }, [ready, user, navigate]);

  const catEntries = Object.entries(categories).filter(([id]) => id !== 'birthday' && id !== 'blindtest');
  const visibleCats = showAllCats ? catEntries : catEntries.slice(0, 7);

  // `force` = on passe outre la proposition de correction orthographique.
  const generate = async (sujet = topic, force = false) => {
    if (!String(sujet).trim()) { setError('Décris le sujet de ton quiz ✍️'); return; }
    setLoading(true); setError(''); setSaved(null); setCorrection(null); setAlerte('');
    try {
      const d = await api(`/api/ai/generate${force ? '?force=1' : ''}`, {
        method: 'POST',
        body: { topic: sujet, category, type, count, difficulty, language: 'fr' },
      });
      setQuestions(d.questions);
      setSources(d.sources || null);
      setTitre(d.titre || String(sujet).trim());
      setAlerte(d.alerte || '');
      refresh();
    } catch (e) {
      // Le sujet ressemble à une faute de frappe : on propose la correction
      // au lieu de fabriquer un quiz autour d'un mot qui n'existe pas.
      if (e.code === 'topic_suggestion' && e.data?.suggestion) {
        setCorrection({ propose: e.data.suggestion, saisi: e.data.saisi });
      } else {
        setError(e.code === 'quota' ? 'quota' : e.message);
      }
    } finally { setLoading(false); }
  };

  const save = async () => {
    setLoading(true); setError('');
    try {
      const d = await api('/api/quizzes', {
        method: 'POST',
        body: { title: (titre || topic).slice(0, 80), category, difficulty, questions, sources, verified: !!sources },
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
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">✨ Crée ton quiz</h1>
        <p className="mt-1 font-semibold text-white/60">N'importe quel sujet, prêt en 30 secondes.</p>
      </div>

      {/* Étape 1 — Sujet */}
      <div className="card space-y-3">
        <h2 className="font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-grape px-3 py-0.5 text-white">1</span>Ton sujet</h2>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={'"Les années 80", "Harry Potter", "Le mariage de Julie et Tom", "Notre voyage en Italie"… ou colle un texte entier, les questions seront faites dessus.'}
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

        {correction && (
          <div className="rounded-2xl border-2 border-sunny/60 bg-sunny/10 p-4">
            <p className="font-display text-lg font-extrabold">
              Tu voulais peut-être écrire « {correction.propose} » ?
            </p>
            <p className="mt-1 text-sm font-semibold text-white/65">
              « {correction.saisi} » ne correspond à rien de connu — le quiz risquerait de partir sur un tout autre sujet.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => { setTopic(correction.propose); generate(correction.propose, true); }}
                className="btn-primary !px-4 !py-2 !text-sm"
              >
                Oui, utilise « {correction.propose} »
              </button>
              <button
                onClick={() => generate(topic, true)}
                className="btn-ghost !px-4 !py-2 !text-sm"
              >
                Non, garde « {correction.saisi} »
              </button>
            </div>
          </div>
        )}

        <button onClick={() => generate()} disabled={loading} className="btn-primary w-full text-xl">
          {loading ? '✨ Préparation de ton quiz…' : '✨ Créer mon quiz'}
        </button>
      </div>

      {questions && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">Aperçu ({questions.length} question{questions.length > 1 ? 's' : ''})</h2>
            <div className="flex gap-2">
              <button onClick={() => generate()} disabled={loading} className="btn-ghost !px-4 !py-2 !text-sm">🔄 Régénérer</button>
            </div>
          </div>
          {alerte && (
            <div className="rounded-2xl border-2 border-sunny/60 bg-sunny/10 p-4">
              <p className="font-display font-extrabold text-sunny">⚠️ Moins de questions que prévu</p>
              <p className="mt-1 font-semibold text-white/70">{alerte}</p>
              <button onClick={() => generate(topic, true)} disabled={loading} className="btn-ghost mt-3 !px-4 !py-2 !text-sm">
                🔄 Relancer pour en obtenir plus
              </button>
            </div>
          )}
          {sources && sources.length > 0 && (
            <div className="rounded-2xl border-2 border-minty/40 bg-minty/10 p-4">
              <p className="font-display font-extrabold text-minty">📚 Pour aller plus loin</p>
              <p className="text-sm font-semibold text-white/55">Envie d'en savoir plus sur le sujet ? C'est par ici.</p>
              <ul className="mt-2 space-y-1">
                {sources.map((s2) => (
                  <li key={s2.url}>
                    <a href={s2.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-white/70 underline hover:text-white">→ {s2.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <QuizPreview questions={questions} />
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
