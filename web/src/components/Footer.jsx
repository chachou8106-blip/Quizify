import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/60 bg-white/70 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span className="font-display text-xl font-extrabold bg-gradient-to-r from-grape to-bubble bg-clip-text text-transparent">Quizify</span>
        </div>
        <p className="mt-1 font-semibold text-slate-400">La fête commence par une question ✨</p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-slate-500">
          <Link to="/create" className="hover:text-grape">Créer un quiz</Link>
          <Link to="/blindtest" className="hover:text-grape">Blind test</Link>
          <Link to="/birthday" className="hover:text-grape">Anniversaire</Link>
          <Link to="/join" className="hover:text-grape">Rejoindre</Link>
          <Link to="/pricing" className="hover:text-grape">Tarifs</Link>
        </div>
      </div>
    </footer>
  );
}
