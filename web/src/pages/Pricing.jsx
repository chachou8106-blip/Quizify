import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, GUMROAD_LINKS } from '../api';
import { useAuth } from '../store';

export default function Pricing() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const activate = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/signup?next=/pricing'); return; }
    setLoading(true); setMsg(null);
    try {
      const d = await api('/api/billing/activate', { method: 'POST', body: { licenseKey: key } });
      setMsg({ ok: true, text: d.plan === 'premium' ? '👑 Premium activé, bienvenue !' : '🎉 Pass Événement activé pour 48h !' });
      refresh();
    } catch (e2) {
      setMsg({ ok: false, text: e2.message });
    } finally { setLoading(false); }
  };

  const plans = [
    {
      name: 'Gratuit', price: '0 €', emoji: '🌱', border: 'border-white/15',
      features: ['3 quiz IA par mois', 'Parties live jusqu\'à 10 joueurs', 'Partage par lien illimité', 'Quiz jouables en solo sans limite'],
      cta: user ? null : { label: 'Créer mon compte', to: '/signup' },
    },
    {
      name: 'Premium', price: '4,99 €/mois', emoji: '👑', border: 'border-grape', badge: 'Le plus populaire',
      features: ['Quiz IA illimités', 'Parties live jusqu\'à 100 joueurs', 'Toutes les catégories & difficultés', 'Support prioritaire'],
      cta: { label: 'S\'abonner via Gumroad', href: GUMROAD_LINKS.premium },
    },
    {
      name: 'Pass Événement', price: '14,99 € / 48h', emoji: '🎉', border: 'border-bubble',
      features: ['Tout Premium pendant 48h', 'Parfait anniversaires & soirées', 'Jusqu\'à 100 joueurs', 'Sans abonnement, sans engagement'],
      cta: { label: 'Acheter un pass', href: GUMROAD_LINKS.event },
    },
  ];

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold">Des tarifs simples et joyeux 🎈</h1>
        <p className="mt-2 text-lg font-semibold text-white/60">Les joueurs ne paient jamais. Seul l'animateur choisit son plan.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={`card relative border-4 ${p.border} flex flex-col`}>
            {p.badge && <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-grape px-4 py-1 font-display text-sm font-extrabold text-white">{p.badge}</span>}
            <div className="text-center">
              <div className="text-5xl">{p.emoji}</div>
              <h2 className="mt-2 font-display text-2xl font-extrabold">{p.name}</h2>
              <p className="font-display text-3xl font-extrabold text-grape-light">{p.price}</p>
            </div>
            <ul className="mt-5 flex-1 space-y-2">
              {p.features.map((f) => <li key={f} className="font-semibold text-white/75">✅ {f}</li>)}
            </ul>
            {p.cta && (p.cta.to
              ? <Link to={p.cta.to} className="btn-primary mt-5 w-full">{p.cta.label}</Link>
              : <a href={p.cta.href} target="_blank" rel="noreferrer" className="btn-pink mt-5 w-full">{p.cta.label}</a>)}
          </div>
        ))}
      </div>

      <div className="card mx-auto max-w-lg text-center">
        <h2 className="font-display text-2xl font-extrabold">🔑 Déjà acheté ?</h2>
        <p className="mt-1 font-semibold text-white/60">Colle la clé de licence reçue par email après ton achat Gumroad :</p>
        <form onSubmit={activate} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXXXXXX-XXXXXXXX-…" className="input flex-1 text-center font-mono" />
          <button disabled={loading || !key.trim()} className="btn-primary">{loading ? '⏳' : 'Activer'}</button>
        </form>
        {msg && <p className={`mt-3 font-bold ${msg.ok ? 'text-minty' : 'text-cherry'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
