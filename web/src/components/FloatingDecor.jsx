// Décor : emojis qui flottent doucement un peu partout, derrière le contenu.
const DECOR = [
  { e: '🎈', top: '10%', left: '5%', size: 'text-4xl', delay: '0s' },
  { e: '🎊', top: '18%', right: '7%', size: 'text-3xl', delay: '1.2s' },
  { e: '🎧', top: '33%', right: '3%', size: 'text-2xl', delay: '2.1s' },
  { e: '🎵', top: '45%', left: '3%', size: 'text-3xl', delay: '0.6s' },
  { e: '❓', top: '58%', right: '6%', size: 'text-4xl', delay: '1.7s' },
  { e: '🏆', top: '68%', left: '7%', size: 'text-2xl', delay: '2.6s' },
  { e: '✨', top: '80%', left: '12%', size: 'text-2xl', delay: '0.9s' },
  { e: '🎯', top: '88%', right: '10%', size: 'text-3xl', delay: '1.4s' },
];

export default function FloatingDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {DECOR.map((d, i) => (
        <span
          key={i}
          className={`absolute animate-floaty opacity-30 ${d.size}`}
          style={{ top: d.top, left: d.left, right: d.right, animationDelay: d.delay }}
        >
          {d.e}
        </span>
      ))}
    </div>
  );
}
