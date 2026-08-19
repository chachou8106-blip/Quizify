import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../api';
import { useAuth } from '../store';

export default function Reward() {
  const { code } = useParams();
  const { user, ready, refresh } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | claiming | done | error
  const [msg, setMsg] = useState('');
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) { navigate(`/signup?next=/reward/${code}`); return; }
    if (claimedRef.current) return;
    claimedRef.current = true;
    setStatus('claiming');
    api('/api/rewards/claim', { method: 'POST', body: { code } })
      .then((d) => {
        setStatus('done');
        setMsg(`${d.credits} quiz IA ajoutés à ton compte !`);
        confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
        refresh();
      })
      .catch((e) => { setStatus('error'); setMsg(e.message); });
  }, [ready, user, code, navigate, refresh]);

  if (!ready || !user) return null;

  return (
    <div className="mx-auto max-w-md space-y-6 pt-8 text-center">
      <div className="animate-wiggle text-7xl">🎁</div>
      <h1 className="font-display text-3xl font-extrabold">Ta récompense de champion·ne</h1>
      {status === 'claiming' && <p className="text-xl font-bold text-white/60">⏳ Vérification du code…</p>}
      {status === 'done' && (
        <div className="card border-4 border-minty">
          <p className="font-display text-2xl font-extrabold text-minty">✅ {msg}</p>
          <p className="mt-2 font-semibold text-white/60">Utilise-les pour créer tes propres quiz et prendre ta revanche.</p>
          <Link to="/create" className="btn-primary mt-4">✨ Créer mon premier quiz</Link>
        </div>
      )}
      {status === 'error' && (
        <div className="card border-4 border-cherry">
          <p className="font-bold text-cherry">{msg}</p>
          <Link to="/create" className="btn-ghost mt-4">Créer un quiz quand même</Link>
        </div>
      )}
    </div>
  );
}
