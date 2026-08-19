import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// Shared actions after a quiz is saved: play solo, host live, copy link.
export default function QuizActions({ quiz }) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const shareLink = `${location.origin}/s/${quiz.share_code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copie ce lien :', shareLink);
    }
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
      <button onClick={copy} className="btn-ghost">{copied ? '✅ Copié !' : '🔗 Copier le lien'}</button>
      {error && <p className="w-full font-bold text-cherry">{error}</p>}
    </div>
  );
}
