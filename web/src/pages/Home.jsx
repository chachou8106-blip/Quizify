import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AdSlot from '../components/AdSlot';

export default function Home() {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  const join = (e) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pin)) navigate(`/join/${pin}`);
  };

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-4 text-center">
        <img src="/logo.svg" alt="Quizzalo" className="mx-auto mb-5 h-24 w-24 animate-floaty drop-shadow-2xl" />
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">
          La fête commence<br className="hidden sm:block" /> par une <span className="neon-text">question</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg font-semibold text-white/65">
          Des quiz sur tout ce que tu veux, des blind tests avec de la vraie musique,
          et des parties endiablées où chacun joue depuis son téléphone.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link to="/create" className="btn-primary text-xl">Créer un quiz</Link>
          <Link to="/blindtest" className="btn-sunny text-xl">🎧 Blind test</Link>
          <Link to="/birthday" className="btn-pink text-xl">🎂 Anniversaire</Link>
        </div>
      </section>

      {/* Rejoindre */}
      <section className="card mx-auto max-w-md border-2 border-sunny/60 text-center">
        <h2 className="font-display text-2xl font-extrabold">🎮 Une partie t'attend&nbsp;?</h2>
        <p className="mt-1 font-semibold text-white/60">Entre le code affiché par l'animateur</p>
        <form onSubmit={join} className="mt-4 flex gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="123 456"
            className="input text-center font-display text-3xl font-extrabold tracking-[0.3em]"
          />
          <button className="btn-sunny whitespace-nowrap" disabled={pin.length !== 6}>GO&nbsp;!</button>
        </form>
      </section>

      {/* Points forts */}
      <section className="grid gap-5 sm:grid-cols-3">
        {[
          ['🎧', 'De la vraie musique', 'Tes artistes, tes années, tes ambiances. Qui reconnaît le morceau en premier ?'],
          ['🧠', 'Des réponses justes', 'Chaque question est passée au crible avant d\'arriver dans ton quiz.'],
          ['📱', 'Zéro appli à installer', 'Un code, un téléphone, et tout le monde joue. Même mamie.'],
        ].map(([emoji, title, desc]) => (
          <div key={title} className="card text-center">
            <div className="text-5xl">{emoji}</div>
            <h3 className="mt-3 font-display text-xl font-extrabold">{title}</h3>
            <p className="mt-2 font-semibold text-white/60">{desc}</p>
          </div>
        ))}
      </section>

      {/* Comment ça marche */}
      <section>
        <h2 className="text-center font-display text-3xl font-extrabold">Comment ça marche&nbsp;?</h2>
        <div className="mt-7 grid gap-5 sm:grid-cols-3">
          {[
            ['bg-grape', '1', 'Choisis ton sujet', 'Les années 80, les dinosaures, ta sœur… absolument tout fonctionne.'],
            ['bg-bubble', '2', 'Partage le code', 'Tes invités le tapent sur leur téléphone. Aucun compte à créer.'],
            ['bg-sky2', '3', 'Que le meilleur gagne', 'Chrono, séries de bonnes réponses, classement en direct et podium à confettis.'],
          ].map(([color, n, title, desc]) => (
            <div key={n} className="card text-center">
              <span className={`${color} mx-auto flex h-12 w-12 items-center justify-center rounded-full font-display text-2xl font-extrabold text-white`}>{n}</span>
              <h3 className="mt-3 font-display text-xl font-extrabold">{title}</h3>
              <p className="mt-2 font-semibold text-white/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <AdSlot slot="home" />

      {/* Anniversaire */}
      <section className="card border-2 border-bubble/40 bg-gradient-to-br from-bubble/25 to-grape/25 text-center">
        <div className="text-5xl">🎂</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold">Un anniversaire à fêter&nbsp;?</h2>
        <p className="mx-auto mt-2 max-w-lg text-lg font-semibold text-white/75">
          Raconte quelques anecdotes sur la star du jour et découvre qui la connaît vraiment le mieux.
          Fous rires garantis.
        </p>
        <Link to="/birthday" className="btn-sunny mt-6">Créer le quiz surprise</Link>
      </section>
    </div>
  );
}
