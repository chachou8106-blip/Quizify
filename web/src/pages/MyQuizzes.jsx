import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

export default function MyQuizzes() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && !user) navigate('/login?next=/quizzes');
    if (user) api('/api/quizzes').then((d) => setQuizzes(d.quizzes)).catch((e) => setError(e.message));
  }, [ready, user, navigate]);

  const hostLive = async (id) => {
    try {
      const room = await api('/api/rooms', { method: 'POST', body: { quizId: id } });
      sessionStorage.setItem(`host-${room.pin}`, room.hostKey);
      navigate(`/host/${room.pin}`);
    } catch (e) { setError(e.message); }
  };

  const del = async (id) => {
    if (!confirm('Supprimer ce quiz ?')) return;
    await api(`/api/quizzes/${id}`, { method: 'DELETE' });
    setQuizzes((qs) => qs.filter((q) => q.id !== id));
  };

  const copy = (code) => {
    navigator.clipboard?.writeText(`${location.origin}/s/${code}`);
  };

  if (!ready || !user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">📚 Mes quiz</h1>
        <Link to="/create" className="btn-primary !px-4 !py-2 !text-base">+ Nouveau</Link>
      </div>
      {error && <p className="font-bold text-cherry">{error}</p>}
      {quizzes && quizzes.length === 0 && (
        <div className="card text-center">
          <div className="text-6xl">🌱</div>
          <p className="mt-3 text-xl font-bold text-slate-500">Aucun quiz pour l'instant.</p>
          <Link to="/create" className="btn-primary mt-4">Créer mon premier quiz ✨</Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(quizzes || []).map((q) => (
          <div key={q.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl font-extrabold">{q.emoji} {q.title}</h3>
              <button onClick={() => del(q.id)} className="text-slate-300 hover:text-cherry" title="Supprimer">🗑</button>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-400">{q.questionCount} questions · {q.plays} partie(s) jouée(s)</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/play/${q.id}`} className="btn-ghost !px-3 !py-1.5 !text-sm">▶️ Solo</Link>
              <button onClick={() => hostLive(q.id)} className="btn-pink !px-3 !py-1.5 !text-sm">🎉 Live</button>
              <button onClick={() => copy(q.share_code)} className="btn-sunny !px-3 !py-1.5 !text-sm">🔗 Lien</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
