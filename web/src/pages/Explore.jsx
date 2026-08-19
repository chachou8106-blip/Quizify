import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Tout Quizify rangé par catégorie — le hub d'exploration (et la vitrine des futurs packs).
export default function Explore() {
  const [categories, setCategories] = useState({});

  useEffect(() => {
    api('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const entries = Object.entries(categories).filter(([id]) => id !== 'birthday' && id !== 'blindtest');

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold">Explorer par <span className="neon-text">catégorie</span></h1>
        <p className="mt-2 font-semibold text-white/60">Choisis un univers, l'IA prépare le quiz. Un tap et c'est parti.</p>
      </div>

      {/* Expériences signature */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/blindtest" className="card group border-2 !border-sky2/40 text-center transition-all hover:!border-sky2 hover:bg-white/10">
          <div className="text-5xl transition-transform group-hover:scale-110">🎧</div>
          <h2 className="mt-2 font-display text-xl font-extrabold">Blind Test</h2>
          <p className="text-sm font-semibold text-white/60">Vraie musique, extraits 15 s</p>
        </Link>
        <Link to="/birthday" className="card group border-2 !border-bubble/40 text-center transition-all hover:!border-bubble hover:bg-white/10">
          <div className="text-5xl transition-transform group-hover:scale-110">🎂</div>
          <h2 className="mt-2 font-display text-xl font-extrabold">Anniversaire</h2>
          <p className="text-sm font-semibold text-white/60">Le quiz 100 % personnalisé</p>
        </Link>
        <Link to="/create?type=math" className="card group border-2 !border-minty/40 text-center transition-all hover:!border-minty hover:bg-white/10">
          <div className="text-5xl transition-transform group-hover:scale-110">🧮</div>
          <h2 className="mt-2 font-display text-xl font-extrabold">Calcul mental</h2>
          <p className="text-sm font-semibold text-white/60">100 % juste — idéal devoirs</p>
        </Link>
      </div>

      {/* Toutes les catégories */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {entries.map(([id, cat]) => (
          <Link
            key={id}
            to={`/create?cat=${id}`}
            className="tile group text-center !p-5"
            style={{ borderColor: cat.color + '55' }}
          >
            <div className="text-4xl transition-transform group-hover:scale-125">{cat.emoji}</div>
            <div className="mt-2 font-display font-extrabold leading-tight">{cat.name}</div>
            <div className="mt-1 text-xs font-bold" style={{ color: cat.color }}>Jouer →</div>
          </Link>
        ))}
      </div>

      <div className="card bg-gradient-to-r from-grape/40 to-bubble/40 text-center">
        <h2 className="font-display text-2xl font-extrabold">💡 Une envie précise ?</h2>
        <p className="mt-1 font-semibold text-white/70">Le sujet libre accepte absolument tout : « le mariage de Julie », « les volcans », « notre road-trip 2024 »…</p>
        <Link to="/create" className="btn-sunny mt-4">✨ Sujet libre</Link>
      </div>
    </div>
  );
}
