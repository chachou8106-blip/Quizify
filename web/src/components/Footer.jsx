import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#14102e]/85 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span className="font-display text-xl font-extrabold bg-gradient-to-r from-grape to-bubble bg-clip-text text-transparent">Quizify</span>
        </div>
        <p className="mt-1 font-semibold text-white/50">La fête commence par une question ✨</p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-white/60">
          <Link to="/create" className="hover:text-grape-light">Créer un quiz</Link>
          <Link to="/blindtest" className="hover:text-grape-light">Blind test</Link>
          <Link to="/birthday" className="hover:text-grape-light">Anniversaire</Link>
          <Link to="/join" className="hover:text-grape-light">Rejoindre</Link>
          <Link to="/pricing" className="hover:text-grape-light">Tarifs</Link>
        </div>
      </div>
    </footer>
  );
}
