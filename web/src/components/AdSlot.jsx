import { useEffect, useState } from 'react';
import { useAuth } from '../store';

// Emplacement publicitaire AdSense — DORMANT tant que ADSENSE_CLIENT n'est pas rempli
// dans wrangler.toml. Jamais affiché aux comptes Premium/Événement (argument de vente).
let configCache = null;
async function getConfig() {
  if (configCache) return configCache;
  configCache = await fetch('/api/config').then((r) => r.json()).catch(() => ({}));
  return configCache;
}

export default function AdSlot({ slot = 'auto' }) {
  const { user } = useAuth();
  const [client, setClient] = useState(null);

  useEffect(() => { getConfig().then((c) => setClient(c.adsenseClient || null)); }, []);

  useEffect(() => {
    if (!client) return;
    if (!document.querySelector('script[data-adsense]')) {
      const s = document.createElement('script');
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.dataset.adsense = '1';
      document.head.appendChild(s);
    }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* pas encore chargé */ }
  }, [client]);

  // Pas de client configuré, ou utilisateur payant → aucune pub.
  if (!client || (user && user.plan !== 'free')) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest text-white/30">Publicité</p>
      <ins
        className="adsbygoogle block overflow-hidden rounded-2xl"
        style={{ display: 'block', minHeight: 100 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
