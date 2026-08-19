import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

// 🎬 Studio : transforme un quiz en vidéo verticale (9:16) prête pour YouTube Shorts / TikTok / Reels.
// Rendu sur canvas + enregistrement MediaRecorder, avec l'audio des blind tests mixé dans la vidéo.

const W = 1080, H = 1920;
const COLORS = ['#EF4444', '#06B6D4', '#FBBF24', '#10B981'];
const SHAPES = ['▲', '◆', '●', '■'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBase(ctx, title) {
  // Fond nuit + halos
  ctx.fillStyle = '#0E0A26';
  ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(150, 100, 0, 150, 100, 900);
  g1.addColorStop(0, 'rgba(124,58,237,.4)'); g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(950, 1800, 0, 950, 1800, 800);
  g2.addColorStop(0, 'rgba(236,72,153,.3)'); g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
  // En-tête marque
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '800 64px "Baloo 2", sans-serif';
  ctx.fillText('🎯 Quizzalo', W / 2, 150);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '700 40px Nunito, sans-serif';
  const lines = wrapText(ctx, title, W - 200);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 225 + i * 50));
}

function drawQuestion(ctx, q, idx, total, progress, revealed) {
  drawBase(ctx, `Question ${idx + 1} / ${total}`);
  // Question
  ctx.fillStyle = '#fff';
  ctx.font = '800 76px "Baloo 2", sans-serif';
  const qLines = wrapText(ctx, q.question, W - 160);
  const qTop = 420;
  qLines.slice(0, 5).forEach((l, i) => ctx.fillText(l, W / 2, qTop + i * 92));
  // Barre de temps
  const barY = 330;
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  roundRect(ctx, 120, barY, W - 240, 26, 13); ctx.fill();
  const grad = ctx.createLinearGradient(120, 0, W - 120, 0);
  grad.addColorStop(0, '#7C3AED'); grad.addColorStop(1, '#EC4899');
  ctx.fillStyle = grad;
  roundRect(ctx, 120, barY, Math.max(26, (W - 240) * (1 - progress)), 26, 13); ctx.fill();
  // Options
  const optTop = 950, optH = 190, gap = 40;
  q.options.forEach((o, i) => {
    const y = optTop + i * (optH + gap);
    const isCorrect = revealed && i === q.correct;
    ctx.globalAlpha = revealed && !isCorrect ? 0.35 : 1;
    ctx.fillStyle = isCorrect ? '#10B981' : COLORS[i % 4];
    roundRect(ctx, 90, y, W - 180, optH, 45); ctx.fill();
    if (isCorrect) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
      roundRect(ctx, 90, y, W - 180, optH, 45); ctx.stroke();
    }
    ctx.fillStyle = i === 2 && !isCorrect ? '#1E293B' : '#fff';
    ctx.font = '800 58px "Baloo 2", sans-serif';
    ctx.textAlign = 'left';
    const label = wrapText(ctx, `${SHAPES[i % 4]}  ${o}`, W - 320)[0] || '';
    ctx.fillText(label, 150, y + optH / 2 + 20);
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1;
  });
  if (revealed) {
    ctx.fillStyle = '#FBBF24';
    ctx.font = '800 66px "Baloo 2", sans-serif';
    ctx.fillText('✅ Réponse !', W / 2, 880);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '700 46px Nunito, sans-serif';
    ctx.fillText('⏳ À toi de jouer…', W / 2, 880);
  }
}

function drawEnd(ctx) {
  drawBase(ctx, '');
  ctx.fillStyle = '#fff';
  ctx.font = '800 96px "Baloo 2", sans-serif';
  ctx.fillText('Combien de', W / 2, 700);
  ctx.fillText('bonnes réponses ? 💬', W / 2, 820);
  ctx.font = '800 72px "Baloo 2", sans-serif';
  ctx.fillStyle = '#FBBF24';
  ctx.fillText('Dis-le en commentaire !', W / 2, 1000);
  const grad = ctx.createLinearGradient(200, 0, W - 200, 0);
  grad.addColorStop(0, '#7C3AED'); grad.addColorStop(1, '#EC4899');
  ctx.fillStyle = grad;
  roundRect(ctx, 140, 1180, W - 280, 170, 60); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 56px "Baloo 2", sans-serif';
  ctx.fillText('🎮 Joue en vrai sur Quizzalo', W / 2, 1285);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '700 44px Nunito, sans-serif';
  ctx.fillText(location.host, W / 2, 1440);
}

export default function Studio() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [quizzes, setQuizzes] = useState([]);
  const [quizId, setQuizId] = useState('');
  const [nbQ, setNbQ] = useState(3);
  const [secondsPerQ, setSecondsPerQ] = useState(5);
  const [status, setStatus] = useState('idle'); // idle | rendering | done | error
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (ready && !user) navigate('/signup?next=/studio');
    if (user) api('/api/quizzes').then((d) => { setQuizzes(d.quizzes); const pre = params.get('id'); setQuizId(pre && d.quizzes.some((q) => q.id === pre) ? pre : (d.quizzes[0]?.id || '')); }).catch(() => {});
  }, [ready, user, navigate]);

  const render = async () => {
    setError(''); setVideoUrl(null); setStatus('rendering'); setProgress(0);
    abortRef.current = false;
    try {
      await document.fonts.load('800 76px "Baloo 2"');
      const { quiz } = await api(`/api/quizzes/${quizId}`);
      const questions = quiz.questions.slice(0, nbQ);
      const canvas = canvasRef.current;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Flux vidéo + audio (pour les blind tests)
      const stream = canvas.captureStream(30);
      const AC = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AC();
      const dest = audioCtx.createMediaStreamDestination();
      // piste silencieuse permanente pour garder l'audio actif
      const osc = audioCtx.createOscillator();
      const mute = audioCtx.createGain(); mute.gain.value = 0.0001;
      osc.connect(mute).connect(dest); osc.start();
      stream.addTrack(dest.stream.getAudioTracks()[0]);

      const mime = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
        .find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise((res) => { rec.onstop = res; });
      rec.start(500);

      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const totalSteps = questions.length * (secondsPerQ + 2.5) + 3;
      let elapsed = 0;
      const tickProgress = (dt) => { elapsed += dt; setProgress(Math.min(99, Math.round((elapsed / totalSteps) * 100))); };

      const playClip = async (url, seconds) => {
        try {
          const buf = await fetch(url).then((r) => r.arrayBuffer());
          const audio = await audioCtx.decodeAudioData(buf);
          const src = audioCtx.createBufferSource();
          src.buffer = audio;
          src.connect(dest);
          src.connect(audioCtx.destination); // feedback à l'écran
          src.start(0, 0, seconds);
          return src;
        } catch { return null; }
      };

      for (let i = 0; i < questions.length; i++) {
        if (abortRef.current) break;
        const q = questions[i];
        let clip = null;
        if (q.audioUrl) clip = await playClip(q.audioUrl, secondsPerQ);
        // Compte à rebours animé
        const start = performance.now();
        while (performance.now() - start < secondsPerQ * 1000) {
          if (abortRef.current) break;
          drawQuestion(ctx, q, i, questions.length, (performance.now() - start) / (secondsPerQ * 1000), false);
          await wait(33);
        }
        try { clip?.stop(); } catch {}
        tickProgress(secondsPerQ);
        // Révélation
        drawQuestion(ctx, q, i, questions.length, 1, true);
        await wait(2500);
        tickProgress(2.5);
      }
      drawEnd(ctx);
      await wait(3000);
      tickProgress(3);

      rec.stop();
      await stopped;
      osc.stop(); audioCtx.close();
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      setVideoUrl(URL.createObjectURL(blob));
      setProgress(100);
      setStatus('done');
    } catch (e) {
      setError(e.message || 'Erreur de rendu');
      setStatus('error');
    }
  };

  if (!ready || !user) return null;
  const selected = quizzes.find((q) => q.id === quizId);
  const ext = videoUrl && MediaRecorder.isTypeSupported?.('video/mp4') ? 'mp4' : 'webm';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="animate-floaty text-6xl">🎬</div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Studio <span className="neon-text">Shorts</span></h1>
        <p className="mt-2 font-semibold text-white/60">Transforme n'importe quel quiz en vidéo verticale prête pour <b>YouTube Shorts</b>, TikTok et Reels — générée ici, sur ton téléphone.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="mb-2 font-display text-xl font-extrabold"><span className="mr-2 rounded-full bg-grape px-3 py-0.5 text-white">1</span>Choisis un quiz</h2>
          {quizzes.length === 0 ? (
            <p className="font-semibold text-white/60">Aucun quiz enregistré. <Link to="/create" className="text-grape-light underline">Crée ton premier quiz</Link> ou <Link to="/blindtest" className="text-grape-light underline">un blind test</Link> !</p>
          ) : (
            <select value={quizId} onChange={(e) => setQuizId(e.target.value)} className="input">
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.emoji} {q.title} ({q.questionCount} questions)</option>)}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h2 className="mb-2 font-display text-lg font-extrabold"><span className="mr-2 rounded-full bg-bubble px-3 py-0.5 text-white">2</span>Questions</h2>
            <select value={nbQ} onChange={(e) => setNbQ(+e.target.value)} className="input">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n > 1 ? 'questions' : 'question'}</option>)}
            </select>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-extrabold"><span className="mr-2 rounded-full bg-sky2 px-3 py-0.5 text-white">3</span>Temps / question</h2>
            <select value={secondsPerQ} onChange={(e) => setSecondsPerQ(+e.target.value)} className="input">
              {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} s</option>)}
            </select>
          </div>
        </div>
        <p className="text-sm font-semibold text-white/50">💡 Format gagnant : 3 questions × 5 s ≈ un Short de 25 s. Les blind tests incluent la musique dans la vidéo 🎵</p>
        {error && <p className="font-bold text-cherry">{error}</p>}
        <button onClick={render} disabled={status === 'rendering' || !quizId} className="btn-primary w-full text-xl">
          {status === 'rendering' ? `🎥 Tournage en cours… ${progress}%` : '🎥 Générer la vidéo'}
        </button>
        {status === 'rendering' && (
          <p className="text-center text-sm font-semibold text-white/50">La vidéo se tourne en temps réel ({selected ? Math.min(nbQ, selected.questionCount) * (secondsPerQ + 2.5) + 3 : '~30'} s) — garde la page ouverte 🎬</p>
        )}
      </div>

      {/* Aperçu du tournage / résultat — canvas unique, toujours monté */}
      <div className={`card text-center ${status === 'idle' ? 'hidden' : ''}`}>
        <canvas ref={canvasRef} className={`mx-auto w-full max-w-[280px] rounded-2xl border border-white/15 ${status === 'done' || status === 'idle' ? 'hidden' : ''}`} style={{ aspectRatio: '9/16' }} />
        {status === 'done' && videoUrl && (
          <div className="space-y-4">
            <video src={videoUrl} controls playsInline className="mx-auto w-full max-w-[280px] rounded-2xl border border-white/15" style={{ aspectRatio: '9/16' }} />
            <a href={videoUrl} download={`quizzalo-short.${ext}`} className="btn-primary w-full text-xl">⬇️ Télécharger la vidéo</a>
            <p className="text-sm font-semibold text-white/50">Puis ouvre YouTube → ➕ → « Créer un Short » → importe la vidéo. Titre conseillé : « Seuls 1 % réussissent ce quiz {selected?.title || ''} 🤯 #quiz #shorts »</p>
          </div>
        )}
      </div>
    </div>
  );
}
