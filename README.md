# 🎯 Quizify — Générateur de quiz IA + parties live

Crée des quiz sur n'importe quel sujet avec l'IA et joue en direct avec tes amis : chacun rejoint avec un code PIN sur son téléphone, classement en temps réel, podium avec confettis. Inclut un mode **Quiz Anniversaire** 🎂 personnalisé à partir d'anecdotes.

## Architecture (100 % Cloudflare)

- **Worker unique** (`src/index.js`, framework Hono) : API + frontend statique
- **Workers AI** (Llama 3.3 70B) : génération des quiz — aucune clé API externe
- **D1** (`quizify-db`) : comptes, quiz, quotas, licences
- **Durable Object `GameRoom`** : 1 par partie live, WebSockets (Hibernation API), scoring à la vitesse
- **KV** : divers
- **Cron quotidien** : re-vérification automatique des licences Gumroad
- **Frontend** : React + Vite + Tailwind (`web/`), design jovial mobile-first

## Monétisation (autonome)

| Plan | Prix | Contenu |
|---|---|---|
| Gratuit | 0 € | 3 quiz IA/mois, parties 10 joueurs |
| 👑 Premium | 4,99 €/mois | IA illimitée, 100 joueurs |
| 🎉 Pass Événement | 14,99 €/48h | Tout Premium, sans abonnement |

Paiement via Gumroad : l'acheteur reçoit une clé de licence par email et l'active dans l'app (`/pricing`). Vérification via l'API publique Gumroad, 1 clé = 1 compte, abonnements re-vérifiés chaque nuit.

## Déploiement (Cloudflare Workers Builds — sans CLI)

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → **Import a repository** → choisir ce repo
2. Build command : `npm ci && npm run build` — Deploy command : `npx wrangler deploy`
3. Ajouter la variable secrète `AUTH_SECRET` (longue chaîne aléatoire) dans Settings → Variables
4. C'est tout : chaque `git push` redéploie automatiquement.

Les identifiants D1/KV dans `wrangler.toml` correspondent aux ressources déjà créées sur le compte.

## Développement local

```bash
npm install
npm run build          # build du frontend
npx wrangler d1 execute quizify-db --local --file=schema.sql
npx wrangler dev       # http://localhost:8787
```

## Configuration Gumroad

Créer 2 produits avec **License keys** activées : permalinks `quizify-premium` (abonnement 4,99 €/mois) et `quizify-event` (14,99 €). Si les permalinks diffèrent, les mettre à jour dans `wrangler.toml` (`GUMROAD_*_PERMALINK`) et `web/src/api.js` (`GUMROAD_LINKS`).
