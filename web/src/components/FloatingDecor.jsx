// Décor : des emojis qui baladent sur toute la hauteur de CHAQUE page, avec une
// vraie aura violette pour qu'ils restent lisibles sur le fond nuit.
//
// Deux détails qui comptent :
// • le calque s'arrête sous le menu et au-dessus du pied de page, sinon les
//   emojis des extrémités disparaissaient derrière eux ;
// • l'aura n'est pas une simple ombre portée (trop discrète sur un emoji, qui
//   est une image en couleur) mais un vrai halo posé derrière le glyphe.

const DECOR = [
  { e: '🎈', top: '3%',  left: '2%',  size: 'text-3xl sm:text-5xl', anim: 'animate-driftA', delay: '0s' },
  { e: '🎊', top: '8%',  right: '3%', size: 'text-2xl sm:text-4xl', anim: 'animate-driftB', delay: '1.4s' },
  { e: '🎵', top: '15%', left: '6%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftC', delay: '0.7s' },
  { e: '🎧', top: '21%', right: '6%', size: 'text-3xl sm:text-5xl', anim: 'animate-driftA', delay: '2.2s' },
  { e: '⭐', top: '28%', left: '2%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftB', delay: '3.1s' },
  { e: '❓', top: '35%', right: '2%', size: 'text-3xl sm:text-5xl', anim: 'animate-driftC', delay: '1.1s' },
  { e: '🎉', top: '42%', left: '5%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftA', delay: '2.6s' },
  { e: '🏆', top: '49%', right: '5%', size: 'text-3xl sm:text-5xl', anim: 'animate-driftB', delay: '0.4s' },
  { e: '✨', top: '56%', left: '2%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftC', delay: '3.4s' },
  { e: '🎯', top: '63%', right: '3%', size: 'text-2xl sm:text-4xl', anim: 'animate-driftA', delay: '1.8s' },
  { e: '🎤', top: '70%', left: '6%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftB', delay: '2.9s' },
  { e: '💡', top: '77%', right: '6%', size: 'text-3xl sm:text-5xl', anim: 'animate-driftC', delay: '0.9s' },
  { e: '🎲', top: '84%', left: '3%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftA', delay: '3.7s' },
  { e: '🥳', top: '91%', right: '2%', size: 'text-3xl sm:text-5xl', anim: 'animate-driftB', delay: '1.6s' },
  { e: '🎬', top: '97%', left: '5%',  size: 'text-2xl sm:text-4xl', anim: 'animate-driftC', delay: '2.4s' },
];

export default function FloatingDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-20 bottom-28 z-0 overflow-hidden"
    >
      {DECOR.map((d, i) => (
        <span
          key={i}
          className={`absolute ${d.anim}`}
          style={{ top: d.top, left: d.left, right: d.right, animationDelay: d.delay }}
        >
          {/* Le halo violet, posé derrière le glyphe. */}
          <span
            className="absolute left-1/2 top-1/2 h-16 w-16 sm:h-24 sm:w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.75) 0%, rgba(236,72,153,0.35) 45%, transparent 72%)' }}
          />
          <span
            className={`relative block select-none opacity-95 ${d.size}`}
            style={{ filter: 'drop-shadow(0 0 10px rgba(190,140,255,0.9)) drop-shadow(0 0 24px rgba(236,72,153,0.5))' }}
          >
            {d.e}
          </span>
        </span>
      ))}
    </div>
  );
}
