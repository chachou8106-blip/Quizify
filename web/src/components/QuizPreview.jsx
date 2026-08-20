import { useState } from 'react';

// Aperçu d'un quiz pour l'animateur.
//
// Les réponses sont MASQUÉES par défaut : dans la vraie vie, on regarde son quiz
// devant les invités, et l'ancien comportement (tout affiché, à masquer soi-même)
// gâchait la partie avant qu'elle commence. On révèle question par question d'un
// clic, ou tout d'un coup quand on veut relire.
export default function QuizPreview({ questions }) {
  const [reveles, setReveles] = useState(() => new Set());
  const tout = reveles.size === questions.length;

  const basculer = (i) => {
    setReveles((prev) => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  };

  const toutBasculer = () => {
    setReveles(tout ? new Set() : new Set(questions.map((_, i) => i)));
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-white/50">
          🙈 Réponses masquées — touche une question pour la dévoiler
        </p>
        <button onClick={toutBasculer} className="btn-ghost !px-4 !py-2 !text-sm">
          {tout ? '🙈 Tout remasquer' : '👀 Tout afficher'}
        </button>
      </div>

      <ol className="space-y-3">
        {questions.map((q, i) => {
          const vu = reveles.has(i);
          return (
            <li key={i} className="rounded-2xl bg-white/5 p-4">
              <button
                onClick={() => basculer(i)}
                className="flex w-full items-start gap-2 text-left font-bold"
              >
                <span className="shrink-0">{i + 1}.</span>
                <span className="flex-1">{q.question}</span>
                <span className="shrink-0 text-sm opacity-60">{vu ? '🙈' : '👀'}</span>
              </button>

              {q.options?.length === 1 ? (
                <p className="mt-2 font-bold">
                  {vu
                    ? <span className="rounded-full bg-minty-light px-3 py-1 text-sm text-emerald-900">💰 {Number(q.options[0]).toLocaleString('fr-FR')}</span>
                    : <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/60">💰 réponse chiffrée</span>}
                </p>
              ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {q.options.map((o, j) => (
                  <span
                    key={j}
                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                      vu && j === q.correct
                        ? 'bg-minty-light text-emerald-900'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {o}
                  </span>
                ))}
              </div>
              )}

              {vu && q.explanation && (
                <p className="mt-2 text-sm font-semibold text-white/50">💡 {q.explanation}</p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
