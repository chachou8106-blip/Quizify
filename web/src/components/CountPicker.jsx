// Nombre de questions : choix libre (1–20) ou aléatoire 🎲
export default function CountPicker({ value, onChange, max = 20 }) {
  const presets = [5, 10, 20, 30, 40, 50].filter((n) => n <= max);
  const random = () => onChange(5 + Math.floor(Math.random() * Math.min(11, max - 4)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number" min={1} max={max} value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(1, parseInt(e.target.value) || 1)))}
        className="input !w-24 text-center font-display text-xl font-extrabold"
      />
      {presets.map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`chip ${value === n ? 'border-grape-light bg-grape/30 text-white' : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40'}`}>
          {n}
        </button>
      ))}
      <button type="button" onClick={random} className="chip border-sunny/50 bg-sunny/15 text-sunny hover:border-sunny" title="Nombre aléatoire">
        🎲 Aléatoire
      </button>
    </div>
  );
}
