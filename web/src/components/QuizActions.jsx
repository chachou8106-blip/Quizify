import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { copier } from '../copie';

// Shared actions after a quiz is saved: play solo, host live, copy link.
export default function QuizActions({ quiz }) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const shareLink = `${location.origin}/s/${quiz.share_code}`;

  const copy = async () => {
    // Même correctif que sur la page animateur : si la copie est refusée par le
    // navigateur, on le DIT au lieu de laisser croire que ça a marché.
    const ok = await copier(shareLink);
    setCopied(ok ? 'ok' : 'echec');
    setTimeout(() => setCopied(false), 4000);
  };

  const hostLive = async () => {
    setStarting(true);
    setError('');
    try {
      const room = await api('/api/rooms', { method: 'POST', body: { quizId: quiz.id } });
      sessionStorage.setItem(`host-${room.pin}`, room.hostKey);
      navigate(`/host/${room.pin}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={() => navigate(`/play/${quiz.id}`)} className="btn-primary">▶️ Jouer en solo</button>
      <button onClick={hostLive} disabled={starting} className="btn-pink">{starting ? '⏳...' : '🎉 Lancer une partie live'}</button>
      <button onClick={copy} className="btn-ghost">{copied === 'ok' ? '✅ Copié !' : '🔗 Copier le lien'}</button>
      {copied === 'echec' && (
        <p className="w-full text-sm font-bold text-sunny">
          Ton navigateur bloque la copie. Le lien : <span className="select-all underline">{shareLink}</span>
        </p>
      )}
      {error && <p className="w-full font-bold text-cherry">{error}</p>}
    </div>
  );
}
