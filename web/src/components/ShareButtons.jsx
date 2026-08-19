// Boutons de partage du podium : partage natif (ouvre WhatsApp & les contacts du téléphone) + lien WhatsApp direct.
export function podiumText(title, leaderboard) {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = (leaderboard || []).slice(0, 3).map((p, i) => `${medals[i]} ${p.name} — ${p.score} pts`).join('\n');
  return `🏆 Podium Quizzalo — « ${title || 'Quiz'} »\n${lines}\n\nÀ ton tour ! Crée ton quiz en 30 secondes 👉 ${location.origin} ✨`;
}

export default function ShareButtons({ title, leaderboard }) {
  const text = podiumText(title, leaderboard);
  const canNative = typeof navigator !== 'undefined' && !!navigator.share;

  const nativeShare = async () => {
    try { await navigator.share({ text }); } catch { /* annulé */ }
  };

  return (
    <div className="flex flex-wrap justify-center gap-3">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank" rel="noreferrer"
        className="btn bg-[#25D366] text-white shadow-pop hover:brightness-110"
      >
        💬 Partager sur WhatsApp
      </a>
      {canNative && (
        <button onClick={nativeShare} className="btn-ghost">📤 Autres applis</button>
      )}
    </div>
  );
}
