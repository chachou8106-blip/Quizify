import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../store';

export default function Nav() {
  const { user, logout, aiUsed, aiQuota } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-3xl">🎯</span>
          <span className="font-display text-2xl font-extrabold text-grape">Quizify</span>
        </Link>

        <div className="hidden items-center gap-5 sm:flex">
          <Link to="/create" className="font-bold text-slate-600 hover:text-grape">Créer</Link>
          <Link to="/join" className="font-bold text-slate-600 hover:text-grape">Rejoindre</Link>
          <Link to="/pricing" className="font-bold text-slate-600 hover:text-grape">Tarifs</Link>
          {user ? (
            <>
              <Link to="/quizzes" className="font-bold text-slate-600 hover:text-grape">Mes quiz</Link>
              <span className="rounded-full bg-grape/10 px-3 py-1 text-sm font-bold text-grape">
                {user.plan === 'premium' ? '👑 Premium' : user.plan === 'event' ? '🎉 Pass Événement' : `⚡ ${aiQuota - aiUsed}/${aiQuota} IA`}
              </span>
              <button onClick={() => { logout(); navigate('/'); }} className="font-bold text-slate-400 hover:text-cherry">Déconnexion</button>
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
        <div className="flex flex-col gap-1 border-t border-slate-100 bg-white px-4 py-3 sm:hidden">
          {[['Créer un quiz', '/create'], ['Rejoindre une partie', '/join'], ['Quiz anniversaire 🎂', '/birthday'], ['Tarifs', '/pricing'], ...(user ? [['Mes quiz', '/quizzes']] : [])].map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-bold text-slate-700 hover:bg-grape/10">{label}</Link>
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
