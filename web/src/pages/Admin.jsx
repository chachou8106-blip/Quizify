import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store';

const ONGLETS = [
  ['apercu', "Vue d'ensemble", '📊'],
  ['quiz', 'Tous les quiz', '🎯'],
  ['joueurs', 'Joueurs & quotas', '👥'],
  ['banque', 'Banque de questions', '🗂️'],
  ['videos', 'Vidéos', '🎬'],
  ['argent', 'Revenus & audience', '💰'],
  ['erreurs', 'Erreurs', '🚨'],
  ['reglages', 'Réglages', '🔑'],
];

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n ?? 0);
const date = (s) => (s ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Tuile({ emoji, label, valeur, sous, accent = 'bg-white/5' }) {
  return (
    <div className={`rounded-2xl border border-white/10 p-4 ${accent}`}>
      <div className="text-2xl">{emoji}</div>
      <div className="mt-1 font-display text-3xl font-extrabold leading-none">{valeur}</div>
      <div className="mt-1 text-sm font-extrabold text-white/70">{label}</div>
      {sous && <div className="text-xs font-semibold text-white/45">{sous}</div>}
    </div>
  );
}

// Un bloc d'intégration : soit de vrais chiffres, soit une explication franche.
function BlocIntegration({ titre, emoji, data, children }) {
  return (
    <div className="card">
      <h3 className="font-display text-xl font-extrabold">{emoji} {titre}</h3>
      {data === null ? (
        <p className="mt-2 font-semibold text-white/45">Chargement…</p>
      ) : data.connecte ? (
        children
      ) : (
        <div className="mt-2 rounded-xl bg-sunny/10 p-3">
          <p className="font-bold text-sunny">Pas encore connecté</p>
          <p className="text-sm font-semibold text-white/60">{data.quoiFaire || data.erreur}</p>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState('apercu');
  const [d, setD] = useState({});
  const [chargement, setChargement] = useState(false);
  const [msg, setMsg] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (ready && !user) navigate('/login?next=/admin');
  }, [ready, user, navigate]);

  const charger = useCallback(async (quoi) => {
    setChargement(true);
    try {
      // On récupère d'abord, on range ensuite : la fonction passée à setD ne peut pas attendre.
      const poser = (cle, valeur) => setD((x) => ({ ...x, [cle]: valeur }));
      if (quoi === 'apercu') poser('apercu', await api('/api/admin/overview'));
      if (quoi === 'quiz') poser('quiz', await api(`/api/admin/quizzes?q=${encodeURIComponent(recherche)}&page=${page}`));
      if (quoi === 'joueurs') poser('joueurs', await api('/api/admin/users'));
      if (quoi === 'banque') poser('banque', await api('/api/admin/bank'));
      if (quoi === 'videos') poser('videos', await api('/api/admin/videos'));
      if (quoi === 'erreurs') poser('erreurs', await api('/api/admin/errors'));
      if (quoi === 'reglages') poser('reglages', await api('/api/admin/settings'));
      if (quoi === 'argent') {
        // Chaque source est indépendante : une panne n'en cache pas trois autres.
        const [g, y, cf, gh] = await Promise.all([
          api('/api/admin/gumroad').catch((e) => ({ connecte: false, erreur: e.message })),
          api('/api/admin/youtube').catch((e) => ({ connecte: false, erreur: e.message })),
          api('/api/admin/cloudflare').catch((e) => ({ connecte: false, erreur: e.message })),
          api('/api/admin/github').catch((e) => ({ connecte: false, erreur: e.message })),
        ]);
        setD((x) => ({ ...x, gumroad: g, youtube: y, cloudflare: cf, github: gh }));
      }
    } catch (e) {
      setMsg(e.status === 403 ? "Accès réservé au compte propriétaire." : e.message);
    } finally { setChargement(false); }
  }, [recherche, page]);

  useEffect(() => { if (user) charger(onglet); }, [onglet, user, charger]);

  const agir = async (fn, succes) => {
    try { await fn(); setMsg(succes); charger(onglet); }
    catch (e) { setMsg(e.message); }
  };

  if (!ready || !user) return null;

  if (msg === "Accès réservé au compte propriétaire.") {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Accès réservé</h1>
        <p className="mt-2 font-semibold text-white/60">Cette console n'est ouverte qu'au compte propriétaire.</p>
        <Link to="/" className="btn-primary mt-5 inline-block">Retour à l'accueil</Link>
      </div>
    );
  }

  const a = d.apercu;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">🛠️ Console</h1>
          <p className="font-semibold text-white/50">Pilotage complet de Quizzalo</p>
        </div>
        <button onClick={() => charger(onglet)} disabled={chargement} className="btn-ghost !px-4 !py-2 !text-sm">
          {chargement ? '⏳' : '🔄'} Actualiser
        </button>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-2xl bg-grape/20 p-3 font-bold">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-white/50">✕</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ONGLETS.map(([id, label, emoji]) => (
          <button
            key={id}
            onClick={() => { setOnglet(id); setDetail(null); }}
            className={`rounded-xl px-3 py-2 text-sm font-extrabold transition-all ${
              onglet === id ? 'bg-grape text-white shadow-card' : 'bg-white/8 text-white/60 hover:bg-white/15'}`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* ---------------- Vue d'ensemble ---------------- */}
      {onglet === 'apercu' && a && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tuile emoji="👥" label="Joueurs" valeur={fmt(a.joueurs)} sous={`${fmt(a.joueursPayants)} payant(s)`} />
            <Tuile emoji="🎯" label="Quiz créés" valeur={fmt(a.quiz)} />
            <Tuile emoji="🗂️" label="Questions en banque" valeur={fmt(a.banque)} />
            <Tuile emoji="🎮" label="Parties jouées" valeur={fmt(a.parties)} />
            <Tuile emoji="✨" label="Créations ce mois" valeur={fmt(a.generationsCeMois)} />
            <Tuile
              emoji={a.erreurs24h > 0 ? '🚨' : '✅'}
              label="Erreurs 24 h"
              valeur={fmt(a.erreurs24h)}
              accent={a.erreurs24h > 0 ? 'bg-cherry/15' : 'bg-minty/10'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-display text-xl font-extrabold">Quiz par catégorie</h3>
              {a.parCategorie.length === 0 ? (
                <p className="mt-2 font-semibold text-white/45">Aucun quiz pour le moment.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {a.parCategorie.slice(0, 12).map((r) => {
                    const max = a.parCategorie[0].n || 1;
                    return (
                      <div key={r.category} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-sm font-bold text-white/70">{r.category}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-grape to-bubble" style={{ width: `${(r.n / max) * 100}%` }} />
                        </div>
                        <span className="w-10 text-right text-sm font-extrabold">{fmt(r.n)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-display text-xl font-extrabold">Derniers quiz créés</h3>
              <div className="mt-3 space-y-2">
                {a.derniersQuiz.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{q.emoji} {q.title}</div>
                      <div className="text-xs font-semibold text-white/45">{q.auteur || 'inconnu'} · {date(q.created_at)}</div>
                    </div>
                    {q.share_code && <Link to={`/s/${q.share_code}`} className="shrink-0 text-sm font-bold text-grape-light underline">ouvrir</Link>}
                  </div>
                ))}
                {a.derniersQuiz.length === 0 && <p className="font-semibold text-white/45">Rien encore.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Tous les quiz ---------------- */}
      {onglet === 'quiz' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(0), charger('quiz'))}
              placeholder="Chercher un titre, un nom ou un e-mail…"
              className="input"
            />
            <button onClick={() => { setPage(0); charger('quiz'); }} className="btn-sunny whitespace-nowrap">Chercher</button>
          </div>

          {d.quiz && (
            <>
              <p className="font-bold text-white/60">{fmt(d.quiz.total)} quiz au total — tous joueurs confondus</p>
              <div className="space-y-2">
                {d.quiz.quiz.map((q) => (
                  <div key={q.id} className="card !p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-lg font-extrabold">{q.emoji} {q.title}</div>
                        <div className="text-xs font-semibold text-white/45">
                          {q.auteur || 'inconnu'} ({q.email || '—'}) · {q.category} · {q.nbQuestions} questions · {q.plays} partie(s) · {date(q.created_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={async () => setDetail((await api(`/api/admin/quiz/${q.id}`)).quiz)}
                          className="btn-ghost !px-3 !py-1.5 !text-xs"
                        >👁️ Voir</button>
                        {q.share_code && <Link to={`/s/${q.share_code}`} className="btn-ghost !px-3 !py-1.5 !text-xs">▶️ Jouer</Link>}
                        <button
                          onClick={() => confirm(`Supprimer « ${q.title} » ?`) && agir(
                            () => api(`/api/admin/quiz/${q.id}`, { method: 'DELETE' }), 'Quiz supprimé.'
                          )}
                          className="btn-ghost !px-3 !py-1.5 !text-xs !text-cherry"
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
                {d.quiz.quiz.length === 0 && <p className="card font-semibold text-white/45">Aucun quiz ne correspond.</p>}
              </div>

              {d.quiz.total > d.quiz.perPage && (
                <div className="flex items-center justify-center gap-3">
                  <button disabled={page === 0} onClick={() => { setPage(page - 1); }} className="btn-ghost !px-3 !py-1.5 !text-sm">← Précédent</button>
                  <span className="font-bold text-white/60">page {page + 1} / {Math.ceil(d.quiz.total / d.quiz.perPage)}</span>
                  <button disabled={(page + 1) * d.quiz.perPage >= d.quiz.total} onClick={() => { setPage(page + 1); }} className="btn-ghost !px-3 !py-1.5 !text-sm">Suivant →</button>
                </div>
              )}
            </>
          )}

          {detail && (
            <div className="card border-2 border-grape/50">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-extrabold">{detail.emoji} {detail.title}</h3>
                <button onClick={() => setDetail(null)} className="text-white/50">✕</button>
              </div>
              <p className="text-xs font-semibold text-white/45">par {detail.auteur} ({detail.email})</p>
              <ol className="mt-3 space-y-2">
                {detail.questions.map((q, i) => (
                  <li key={i} className="rounded-xl bg-white/5 p-3">
                    <p className="font-bold">{i + 1}. {q.question}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {q.options.map((o, j) => (
                        <span key={j} className={`rounded-full px-2 py-0.5 text-xs font-bold ${j === q.correct ? 'bg-minty-light text-emerald-900' : 'bg-white/10 text-white/55'}`}>{o}</span>
                      ))}
                    </div>
                    {q.explanation && <p className="mt-1 text-xs font-semibold text-white/45">💡 {q.explanation}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Joueurs & quotas ---------------- */}
      {onglet === 'joueurs' && d.joueurs && (
        <div className="space-y-2">
          {d.joueurs.joueurs.map((u) => (
            <div key={u.id} className="card !p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-extrabold">
                    {u.name} {u.is_admin ? <span className="rounded-full bg-grape px-2 py-0.5 text-xs">propriétaire</span> : null}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${u.plan === 'free' ? 'bg-white/15 text-white/70' : 'bg-sunny/25 text-sunny'}`}>
                      {u.plan === 'free' ? 'gratuit' : u.plan}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white/45">
                    {u.email} · {u.quiz} quiz · {u.generationsCeMois} création(s) ce mois · {u.bonus_ai} crédit(s) bonus · inscrit le {date(u.created_at)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {u.plan === 'free' ? (
                    <button onClick={() => agir(() => api(`/api/admin/user/${u.id}`, { method: 'POST', body: { plan: 'premium' } }), 'Passé en Premium.')}
                      className="btn-ghost !px-3 !py-1.5 !text-xs">👑 Premium</button>
                  ) : !u.is_admin && (
                    <button onClick={() => agir(() => api(`/api/admin/user/${u.id}`, { method: 'POST', body: { plan: 'free' } }), 'Repassé en gratuit.')}
                      className="btn-ghost !px-3 !py-1.5 !text-xs">↩︎ Gratuit</button>
                  )}
                  <button onClick={() => agir(() => api(`/api/admin/user/${u.id}`, { method: 'POST', body: { bonus: 10 } }), '10 créations offertes.')}
                    className="btn-ghost !px-3 !py-1.5 !text-xs">+10 créations</button>
                  <button onClick={() => agir(() => api(`/api/admin/user/${u.id}`, { method: 'POST', body: { resetQuota: true } }), 'Quota du mois remis à zéro.')}
                    className="btn-ghost !px-3 !py-1.5 !text-xs">♻️ Quota</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Banque ---------------- */}
      {onglet === 'banque' && d.banque && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tuile emoji="🗂️" label="Questions en banque" valeur={fmt(d.banque.total)} />
            <Tuile emoji="♻️" label="Réutilisations" valeur={fmt(d.banque.reutilisations)} sous="questions servies sans rien produire" />
            <Tuile emoji="📚" label="Catégories" valeur={fmt(d.banque.parCategorie.length)} />
            <Tuile emoji="🎲" label="Styles de jeu" valeur={fmt(d.banque.parType.length)} />
          </div>
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-extrabold">Publier la banque sur GitHub</h3>
              <button
                onClick={() => agir(() => api('/api/admin/export', { method: 'POST' }), "Export lancé — un fichier par catégorie dans le dossier banque/.")}
                className="btn-sunny !px-4 !py-2 !text-sm"
              >📤 Exporter maintenant</button>
            </div>
            <p className="text-sm font-semibold text-white/50">L'export part aussi tout seul chaque nuit. Un seul commit, un fichier par catégorie.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="font-display text-lg font-extrabold">Par catégorie</h3>
              <div className="mt-2 space-y-1">
                {d.banque.parCategorie.map((r) => (
                  <div key={r.category} className="flex justify-between text-sm font-bold">
                    <span className="text-white/70">{r.category}</span>
                    <span>{fmt(r.n)} <span className="text-white/40">({fmt(r.avecSource)} sourcées)</span></span>
                  </div>
                ))}
                {d.banque.parCategorie.length === 0 && <p className="font-semibold text-white/45">Banque encore vide.</p>}
              </div>
            </div>
            <div className="card">
              <h3 className="font-display text-lg font-extrabold">Sujets les plus fournis</h3>
              <div className="mt-2 space-y-1">
                {d.banque.topSujets.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm font-bold">
                    <span className="truncate text-white/70">{r.topic_label || '—'}</span>
                    <span>{fmt(r.n)}</span>
                  </div>
                ))}
                {d.banque.topSujets.length === 0 && <p className="font-semibold text-white/45">Rien encore.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Vidéos ---------------- */}
      {onglet === 'videos' && d.videos && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-display text-xl font-extrabold">Suivi des vidéos</h3>
            <p className="text-sm font-semibold text-white/50">
              Les vidéos se fabriquent dans le <Link to="/studio" className="text-grape-light underline">Studio</Link>.
              Note-les ici pour suivre ce qui reste à publier.
            </p>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = e.target.titre.value.trim();
                if (!t) return;
                agir(() => api('/api/admin/videos', { method: 'POST', body: { title: t } }), 'Vidéo ajoutée au suivi.');
                e.target.reset();
              }}
            >
              <input name="titre" placeholder="Titre de la vidéo…" className="input flex-1" />
              <button className="btn-sunny whitespace-nowrap">+ Ajouter</button>
            </form>
          </div>
          <div className="space-y-2">
            {d.videos.videos.map((v) => (
              <div key={v.id} className="card !p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{v.title}</div>
                    <div className="text-xs font-semibold text-white/45">
                      {v.platform} · {v.status === 'publie' ? `publiée le ${date(v.published_at)}` : 'à publier'}
                      {v.url && <> · <a href={v.url} target="_blank" rel="noreferrer" className="text-grape-light underline">lien</a></>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {v.status !== 'publie' && (
                      <button
                        onClick={() => {
                          const url = prompt('Lien de la vidéo publiée (facultatif) :') || null;
                          agir(() => api(`/api/admin/video/${v.id}`, { method: 'POST', body: { status: 'publie', url } }), 'Marquée comme publiée.');
                        }}
                        className="btn-ghost !px-3 !py-1.5 !text-xs"
                      >✅ Publiée</button>
                    )}
                    <button onClick={() => agir(() => api(`/api/admin/video/${v.id}`, { method: 'DELETE' }), 'Retirée du suivi.')}
                      className="btn-ghost !px-3 !py-1.5 !text-xs !text-cherry">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
            {d.videos.videos.length === 0 && <p className="card font-semibold text-white/45">Aucune vidéo suivie pour l'instant.</p>}
          </div>
        </div>
      )}

      {/* ---------------- Revenus & audience ---------------- */}
      {onglet === 'argent' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BlocIntegration titre="Gumroad" emoji="💰" data={d.gumroad ?? null}>
            {d.gumroad?.connecte && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Tuile emoji="💶" label="Revenu total" valeur={`${d.gumroad.revenuTotal} €`} />
                  <Tuile emoji="📅" label="Ce mois-ci" valeur={`${d.gumroad.revenuCeMois} €`} sous={`${fmt(d.gumroad.ventesCeMois)} vente(s)`} />
                </div>
                <div className="mt-3 space-y-1">
                  {d.gumroad.parProduit.map((p) => (
                    <div key={p.nom} className="flex justify-between text-sm font-bold">
                      <span className="truncate text-white/70">{p.nom}</span>
                      <span>{p.revenu} € <span className="text-white/40">({p.ventes})</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </BlocIntegration>

          <BlocIntegration titre="YouTube" emoji="📺" data={d.youtube ?? null}>
            {d.youtube?.connecte && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Tuile emoji="👁️" label="Vues" valeur={fmt(d.youtube.vues)} />
                <Tuile emoji="🔔" label="Abonnés" valeur={fmt(d.youtube.abonnes)} />
                <Tuile emoji="🎬" label="Vidéos" valeur={fmt(d.youtube.videos)} />
              </div>
            )}
          </BlocIntegration>

          <BlocIntegration titre="Cloudflare" emoji="☁️" data={d.cloudflare ?? null}>
            {d.cloudflare?.connecte && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Tuile emoji="📈" label="Requêtes" valeur={fmt(d.cloudflare.requetes)} sous={d.cloudflare.periode} />
                <Tuile emoji="⚠️" label="Erreurs" valeur={fmt(d.cloudflare.erreurs)} sous={d.cloudflare.periode} />
              </div>
            )}
          </BlocIntegration>

          <BlocIntegration titre="GitHub" emoji="🐙" data={d.github ?? null}>
            {d.github?.connecte && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-bold text-white/60">{d.github.depot}</p>
                {d.github.commits.map((cm) => (
                  <div key={cm.sha} className="rounded-xl bg-white/5 px-3 py-1.5">
                    <div className="truncate text-sm font-bold">{cm.message}</div>
                    <div className="text-xs font-semibold text-white/40">{cm.sha} · {date(cm.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </BlocIntegration>
        </div>
      )}

      {/* ---------------- Erreurs ---------------- */}
      {onglet === 'erreurs' && d.erreurs && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {d.erreurs.parType.map((t) => (
                <span key={t.kind} className="rounded-full bg-cherry/20 px-3 py-1 text-sm font-extrabold text-cherry">
                  {t.kind} : {t.n}
                </span>
              ))}
              {d.erreurs.parType.length === 0 && (
                <span className="rounded-full bg-minty/20 px-3 py-1 text-sm font-extrabold text-minty">Aucune erreur sur 7 jours ✅</span>
              )}
            </div>
            {d.erreurs.erreurs.length > 0 && (
              <button onClick={() => confirm('Vider le journal ?') && agir(() => api('/api/admin/errors', { method: 'DELETE' }), 'Journal vidé.')}
                className="btn-ghost !px-3 !py-1.5 !text-xs">🧹 Vider</button>
            )}
          </div>
          <div className="space-y-2">
            {d.erreurs.erreurs.map((e) => (
              <div key={e.id} className="card !p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="rounded-full bg-cherry/20 px-2 py-0.5 text-xs font-extrabold text-cherry">{e.kind}</span>
                    <p className="mt-1 font-bold">{e.message}</p>
                    {e.detail && <p className="text-xs font-semibold text-white/45">{e.detail}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-white/40">{date(e.created_at)}</span>
                </div>
              </div>
            ))}
            {d.erreurs.erreurs.length === 0 && <p className="card font-semibold text-white/45">Rien à signaler.</p>}
          </div>
        </div>
      )}

      {/* ---------------- Réglages ---------------- */}
      {onglet === 'reglages' && d.reglages && (
        <div className="space-y-3">
          <p className="card font-semibold text-white/60">
            Colle ici les clés au fur et à mesure que tu crées les comptes.
            Chaque bloc de l'onglet « Revenus & audience » s'allume tout seul dès que sa clé est renseignée — aucune intervention de ma part n'est nécessaire.
          </p>
          {d.reglages.identifiants.map((cred) => (
            <div key={cred.key} className="card !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-extrabold">
                    {cred.label} {cred.rempli
                      ? <span className="ml-1 rounded-full bg-minty/25 px-2 py-0.5 text-xs text-minty">rempli</span>
                      : <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs text-white/60">vide</span>}
                  </h3>
                  <p className="text-xs font-semibold text-white/45">{cred.help}</p>
                  {cred.apercu && <p className="mt-0.5 font-mono text-xs text-white/40">{cred.apercu}</p>}
                </div>
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = e.target.valeur.value.trim();
                  agir(() => api('/api/admin/settings', { method: 'POST', body: { key: cred.key, value: v } }),
                    v ? `${cred.label} enregistré.` : `${cred.label} effacé.`);
                  e.target.reset();
                }}
              >
                <input name="valeur" type="password" placeholder="Coller la valeur…" className="input flex-1" autoComplete="off" />
                <button className="btn-sunny whitespace-nowrap !px-4 !py-2 !text-sm">Enregistrer</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
