import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Home() {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  const join = (e) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pin)) navigate(`/join/${pin}`);
  };

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="pt-6 text-center">
        <div className="mx-auto mb-4 w-fit animate-floaty text-7xl">🎯✨</div>
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          Crée des quiz <span className="text-grape">magiques</span> avec l'IA,<br className="hidden sm:block" /> joue en direct avec tes amis
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-slate-500">
          N'importe quel sujet. En quelques secondes. Tout le monde joue depuis son téléphone avec un simple code — sans télécharger d'appli.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/create" className="btn-primary text-xl">🤖 Créer un quiz IA</Link>
          <Link to="/blindtest" className="btn-sunny text-xl">🎧 Blind test musical</Link>
          <Link to="/birthday" className="btn-pink text-xl">🎂 Quiz anniversaire</Link>
        </div>
      </section>

      {/* Join box */}
      <section className="card mx-auto max-w-md border-4 border-sunny text-center">
        <h2 className="font-display text-2xl font-extrabold">🎮 Rejoindre une partie</h2>
        <p className="mt-1 font-semibold text-slate-500">Entre le code affiché par l'animateur</p>
        <form onSubmit={join} className="mt-4 flex gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="123 456"
            className="input text-center font-display text-3xl font-extrabold tracking-[0.3em]"
          />
          <button className="btn-sunny" disabled={pin.length !== 6}>GO !</button>
        </form>
      </section>

      {/* Features */}
      <section className="grid gap-5 sm:grid-cols-3">
        {[
          ['🎧', 'Blind test avec de la VRAIE musique', 'Extraits de 30 secondes de tes artistes préférés : qui reconnaît le morceau en premier ?'],
          ['🤖', 'IA sur tous les sujets', "18 catégories, devinettes emoji, « Qui suis-je ? »… L'IA écrit les questions ET les explications."],
          ['📱', 'Mode fête en direct', 'Un code PIN, tout le monde joue sur son téléphone, classement en temps réel façon jeu télévisé.'],
        ].map(([emoji, title, desc]) => (
          <div key={title} className="card text-center">
            <div className="text-5xl">{emoji}</div>
            <h3 className="mt-3 font-display text-xl font-extrabold">{title}</h3>
            <p className="mt-2 font-semibold text-slate-500">{desc}</p>
          </div>
        ))}
      </section>

      {/* Birthday CTA */}
      <section className="card bg-gradient-to-r from-bubble to-grape text-center text-white">
        <h2 className="font-display text-3xl font-extrabold">🎂 Un anniversaire à fêter ?</h2>
        <p className="mx-auto mt-2 max-w-lg text-lg font-semibold text-white/90">
          Raconte quelques anecdotes sur la star du jour, l'IA crée un quiz 100 % personnalisé. Qui la connaît le mieux ? Résultat garanti en fous rires.
        </p>
        <Link to="/birthday" className="btn-sunny mt-5">Créer le quiz anniversaire 🎉</Link>
      </section>
    </div>
  );
}
