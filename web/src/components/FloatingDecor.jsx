// Décor : des emojis qui baladent doucement sur TOUTE la hauteur de la page,
// derrière le contenu. Positionnés en absolu (et non en fixe) pour qu'ils
// défilent avec la page au lieu de rester collés à l'écran.
const DECOR = [
  { e: '🎈', top: '4%',  left: '4%',   size: 'text-5xl', anim: 'animate-driftA', delay: '0s' },
  { e: '🎊', top: '9%',  right: '5%',  size: 'text-4xl', anim: 'animate-driftB', delay: '1.4s' },
  { e: '🎵', top: '17%', left: '9%',   size: 'text-3xl', anim: 'animate-driftC', delay: '0.7s' },
  { e: '🎧', top: '23%', right: '8%',  size: 'text-4xl', anim: 'animate-driftA', delay: '2.2s' },
  { e: '⭐', top: '31%', left: '3%',   size: 'text-3xl', anim: 'animate-driftB', delay: '3.1s' },
  { e: '❓', top: '38%', right: '4%',  size: 'text-5xl', anim: 'animate-driftC', delay: '1.1s' },
  { e: '🎉', top: '46%', left: '7%',   size: 'text-4xl', anim: 'animate-driftA', delay: '2.6s' },
  { e: '🏆', top: '54%', right: '7%',  size: 'text-4xl', anim: 'animate-driftB', delay: '0.4s' },
  { e: '✨', top: '62%', left: '5%',   size: 'text-3xl', anim: 'animate-driftC', delay: '3.4s' },
  { e: '🎯', top: '69%', right: '5%',  size: 'text-4xl', anim: 'animate-driftA', delay: '1.8s' },
  { e: '🎤', top: '77%', left: '8%',   size: 'text-3xl', anim: 'animate-driftB', delay: '2.9s' },
  { e: '💡', top: '84%', right: '9%',  size: 'text-4xl', anim: 'animate-driftC', delay: '0.9s' },
  { e: '🎲', top: '91%', left: '4%',   size: 'text-4xl', anim: 'animate-driftA', delay: '3.7s' },
  { e: '🥳', top: '96%', right: '6%',  size: 'text-4xl', anim: 'animate-driftB', delay: '1.6s' },
];

export default function FloatingDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {DECOR.map((d, i) => (
        <span
          key={i}
          // La lueur est indispensable : sans elle, un emoji sombre disparaît
          // complètement sur le fond nuit de l'application.
          className={`absolute select-none opacity-70 drop-shadow-[0_0_14px_rgba(190,140,255,0.55)] ${d.size} ${d.anim}`}
          style={{ top: d.top, left: d.left, right: d.right, animationDelay: d.delay }}
        >
          {d.e}
        </span>
      ))}
    </div>
  );
}
