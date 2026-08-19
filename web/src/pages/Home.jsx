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
      <section className="relative pt-6 text-center">
        <span className="deco left-2 top-2 animate-floaty text-4xl" style={{ animationDelay: '0.3s' }}>🎈</span>
        <span className="deco right-4 top-10 animate-floaty text-3xl" style={{ animationDelay: '0.9s' }}>🎊</span>
        <span className="deco left-8 bottom-2 animate-floaty text-3xl" style={{ animationDelay: '1.4s' }}>🎵</span>
        <span className="deco right-10 bottom-8 animate-floaty text-4xl" style={{ animationDelay: '0.6s' }}>❓</span>
        <img src="/logo.svg" alt="Quizify" className="mx-auto mb-4 h-20 w-20 animate-floaty" />
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          La fête commence<br className="hidden sm:block" /> par une <span className="bg-gradient-to-r from-grape to-bubble bg-clip-text text-transparent">question</span> ✨
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-white/60">
          Quiz IA sur n'importe quel sujet, blind tests avec de la vraie musique, parties en direct sur les téléphones de tes invités. Sans appli à installer.
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
        <p className="mt-1 font-semibold text-white/60">Entre le code affiché par l'animateur</p>
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
          ['🎧', 'Blind test avec de la VRAIE musique', 'Extraits de 15 secondes de tes artistes préférés : qui reconnaît le morceau en premier ?'],
          ['🤖', 'IA sur tous les sujets', "26 catégories ou sujet 100 % libre, 11 styles de jeu (emoji, intrus, citations…). L'IA écrit les questions ET les explications."],
          ['📱', 'Mode fête en direct', 'Un code PIN, tout le monde joue sur son téléphone : points à la vitesse, séries 🔥, podium à confettis.'],
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
        <h2 className="text-center font-display text-3xl font-extrabold">Comment ça marche ?</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            ['bg-grape', '1', 'Crée en 30 secondes', 'Un sujet, un style de jeu, et l\'IA (ou la vraie musique) fait le reste.'],
            ['bg-bubble', '2', 'Partage le code PIN', 'Tes invités le tapent sur leur téléphone. Aucun compte, aucune appli à installer.'],
            ['bg-sky2', '3', 'Que le meilleur gagne !', 'Réponses chronométrées, bonus de série, classement en direct et podium à confettis.'],
          ].map(([color, n, title, desc]) => (
            <div key={n} className="card text-center">
              <span className={`${color} mx-auto flex h-12 w-12 items-center justify-center rounded-full font-display text-2xl font-extrabold text-white`}>{n}</span>
              <h3 className="mt-3 font-display text-xl font-extrabold">{title}</h3>
              <p className="mt-2 font-semibold text-white/60">{desc}</p>
            </div>
          ))}
        </div>
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
