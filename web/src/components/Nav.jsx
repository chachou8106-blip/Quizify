import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../store';

export default function Nav() {
  const { user, logout, aiUsed, aiQuota, aiBonus } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#14102e]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img src="/logo.svg" alt="Quizify" className="h-9 w-9" />
          <span className="font-display text-2xl font-extrabold bg-gradient-to-r from-grape to-bubble bg-clip-text text-transparent">Quizify</span>
        </Link>

        <div className="hidden items-center gap-5 sm:flex">
          <Link to="/create" className="font-bold text-white/75 hover:text-grape-light">Créer</Link>
          <Link to="/blindtest" className="font-bold text-white/75 hover:text-grape-light">Blind test</Link>
          <Link to="/explore" className="font-bold text-white/75 hover:text-grape-light">Découvrir</Link>
          <Link to="/join" className="font-bold text-white/75 hover:text-grape-light">Rejoindre</Link>
          <Link to="/pricing" className="font-bold text-white/75 hover:text-grape-light">Tarifs</Link>
          {user ? (
            <>
              <Link to="/quizzes" className="font-bold text-white/75 hover:text-grape-light">Mes quiz</Link>
              <span className="rounded-full bg-grape/10 px-3 py-1 text-sm font-bold text-grape-light">
                {user.plan === 'premium' ? '👑 Premium' : user.plan === 'event' ? '🎉 Pass Événement' : `⚡ ${Math.max(0, aiQuota - aiUsed) + aiBonus} IA`}
              </span>
              <button onClick={() => { logout(); navigate('/'); }} className="font-bold text-white/50 hover:text-cherry">Déconnexion</button>
            </>
          ) : (
            <Link to="/signup" className="btn-primary !px-4 !py-2 !text-base">Inscription gratuite</Link>
          )}
        </div>

        <button className="text-3xl sm:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? '✖️' : '🍔'}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t border-white/10 bg-[#161130] px-4 py-3 sm:hidden">
          {[['Créer un quiz', '/create'], ['Blind test musical 🎧', '/blindtest'], ['Découvrir 🧭', '/explore'], ['Rejoindre une partie', '/join'], ['Quiz anniversaire 🎂', '/birthday'], ['Tarifs', '/pricing'], ...(user ? [['Mes quiz', '/quizzes']] : [])].map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-bold text-white/85 hover:bg-grape/10">{label}</Link>
          ))}
          {user ? (
            <button onClick={() => { logout(); setOpen(false); navigate('/'); }} className="rounded-xl px-3 py-2.5 text-left font-bold text-cherry">Déconnexion ({user.name})</button>
          ) : (
            <Link to="/signup" onClick={() => setOpen(false)} className="rounded-xl bg-grape px-3 py-2.5 text-center font-bold text-white">Inscription gratuite</Link>
          )}
        </div>
      )}
    </nav>
  );
}
