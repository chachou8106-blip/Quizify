# 🚀 Quizzalo — Guide de lancement complet

*Le cadeau est prêt. Voici les 4 comptes à créer, ce que tu me donnes pour chacun, et ce qui se passe automatiquement ensuite. Tout le reste est déjà codé, déployé et testé.*

---

## ✅ Déjà 100 % opérationnel (rien à faire)

L'application complète sur **quizify.chachou8106.workers.dev** : quiz IA vérifiés (26 catégories, 11 types), calcul mental garanti juste, blind tests (38 ambiances, extraits 15 s), parties live avec code PIN, mode animateur-joueur, récompenses des vainqueurs, partage WhatsApp du podium, app installable (PWA), **Studio Shorts intégré** (menu 🍔 → Studio Shorts 🎬 : n'importe quel quiz devient une vidéo verticale MP4 avec musique, générée sur ton téléphone). Comptes de Chachou et Nicole : Premium à vie.

---

## 1️⃣ YouTube (priorité n° 1 — gratuit, 10 min)

**Pourquoi d'abord :** c'est le moteur d'acquisition. Chaque Short ramène des joueurs, chaque joueur peut devenir abonné payant. AdSense viendra s'y brancher.

**À créer :** une chaîne YouTube (youtube.com → avatar → « Créer une chaîne »), au nom de ta sœur ou « Quizzalo FR ».

**Kit prêt à l'emploi (fichiers livrés) :**
- `youtube-avatar-800.png` → photo de profil
- `youtube-banniere-2048x1152.png` → bannière
- **Description de chaîne** (copier-coller) :
  > 🎯 1 quiz par jour, 15 secondes pour répondre !
  > Blind tests 🎧, culture G 🌍, devinettes emoji 😀…
  > Combien de bonnes réponses ? Dis-le en commentaire 💬
  > 🎮 Joue en vrai avec tes amis (gratuit, sans appli) 👉 quizify.chachou8106.workers.dev

**Production des Shorts (déjà dans l'app) :** Studio Shorts 🎬 → choisis un quiz → 3 questions × 5 s → Générer → Télécharger → appli YouTube → ➕ → importer. **2 minutes par vidéo.**

**Recette d'une chaîne qui prend :** 1 Short/jour minimum, toujours le même format (hook : « Seuls 1 % réussissent… »), réponse à la toute fin, question aux commentaires (« ton score ? »), hashtags #quiz #shorts #blindtest #culturegenerale. Les blind tests sont les plus viraux.

**Tu me donnes ensuite :** le nom/lien de la chaîne → je l'ajoute dans le pied de page de l'app et sur les écrans de fin de vidéo.

---

## 2️⃣ Gumroad (encaisser — 15 min)

**À créer :** compte sur gumroad.com + RIB dans Settings → Payments, puis 2 produits **avec « Generate license keys » coché** :

| Produit | Type | Prix | URL du produit |
|---|---|---|---|
| Quizzalo Premium | Membership | 4,99 €/mois | `quizzalo-premium` |
| Quizzalo Pass Événement 48h | Digital product | 14,99 € | `quizzalo-event` |

(Descriptions prêtes à coller : voir la conversation, ou demande-les-moi.)

**Tu me donnes ensuite :** les 2 URLs d'achat (ex. `https://tasoeur.gumroad.com/l/quizzalo-premium`) → je les mets dans la config → **tout devient automatique** : achat → clé par email → activation dans l'app → compte Premium ; annulations/remboursements rétrogradés chaque nuit. Zéro gestion.

---

## 3️⃣ Nom de domaine (recommandé — ~10 €/an)

**Pourquoi :** indispensable pour AdSense (refusé sur workers.dev), plus pro pour tout (« quizzalo.fr » sur les vidéos), et améliore le partage.

**À faire :** dans ton dashboard Cloudflare → Domain Registration → chercher `quizzalo.fr` (ou `quizify-app.fr`, `joue-quizzalo.fr`…) → acheter → me dire le nom.

**Je fais ensuite :** je connecte le domaine au Worker (route + redirection), mets à jour tous les liens de l'app, du kit YouTube et des vidéos.

---

## 4️⃣ AdSense (revenus pub — après le domaine)

**Prérequis :** le domaine (étape 3) + un peu de trafic. Créer le compte sur adsense.google.com avec le domaine.

**Déjà prêt dans l'app (dormant) :**
- Emplacements publicitaires sur Accueil et Découvrir — **jamais montrés aux abonnés Premium** (argument de vente : « Premium = zéro pub »)
- `ads.txt` généré automatiquement
- Il ne manque qu'une valeur : ton identifiant `ca-pub-XXXXXXXXXXXXXXXX`

**Tu me donnes ensuite :** cet identifiant → je remplis une variable → les pubs s'affichent pour les visiteurs gratuits. Et quand la chaîne YouTube atteint 1 000 abonnés + 10 M de vues Shorts/90 j, active la monétisation YouTube dans YouTube Studio (même compte AdSense).

---

## 💰 Le circuit de l'argent, une fois tout branché

YouTube Shorts (gratuits à produire via le Studio) → spectateurs → app → joueurs invités aux soirées → gagnants récompensés qui créent des comptes → conversion Premium 4,99 €/mois & Pass Événement 14,99 € (Gumroad → ton RIB) + pub AdSense sur les gratuits + AdSense YouTube à terme. **Chaque étage nourrit le suivant, et tout tourne tout seul.**

## 📋 Ce que tu me colles dans le chat, en résumé

1. Le lien de ta chaîne YouTube
2. Les 2 URLs d'achat Gumroad
3. Le nom de domaine acheté
4. L'identifiant AdSense `ca-pub-…`

*(dans n'importe quel ordre, au fil de l'eau — je branche à chaque fois)*
