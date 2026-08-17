# 🎯 Quizify - Générateur de Quiz IA avec Modèle Hybride

**Quizify** est une plateforme révolutionnaire de génération de quiz alimentée par l'IA, offrant **10 catégories premium** avec des prompts optimisés pour créer des quiz de haute qualité dans divers domaines.

## 🚀 Modèle Hybride - 10 Catégories Disponibles

Notre système utilise un modèle hybride avec **10 catégories spécialisées**, chacune configurée avec des prompts IA uniques pour générer des questions adaptées au domaine.

### 📚 Catégories Principales

| Catégorie | Icône | Couleur | Prix | ID Gumroad |
|-----------|-------|---------|------|------------|
| **Musique** | 🎵 | #9333EA | 14,99€/mois | quiz-music-pro |
| **Culture Générale** | 🌍 | #3B82F6 | 12,99€/mois | quiz-culture-pro |
| **Cinéma & Séries** | 🎬 | #EC4899 | 12,99€/mois | quiz-cinema-pro |
| **Sport** | ⚽ | #10B981 | 12,99€/mois | quiz-sport-pro |
| **Science** | 🔬 | #F59E0B | 12,99€/mois | quiz-science-pro |
| **Histoire** | 🏛️ | #8B5CF6 | 12,99€/mois | quiz-history-pro |
| **Langues** | 🗣️ | #EF4444 | 12,99€/mois | quiz-langues-pro |
| **Jeux Vidéo** | 🎮 | #06B6D4 | 12,99€/mois | quiz-gaming-pro |
| **Cuisine** | 🍳 | #F97316 | 12,99€/mois | quiz-food-pro |
| **Voyages** | ✈️ | #84CC16 | 12,99€/mois | quiz-travel-pro |

### 💎 Abonnement Premium

- **Accès illimité à toutes les catégories** : 29,99€/mois
- Génération de quiz illimitée
- Accès aux fonctionnalités avancées (reconnaissance auditive pour la musique, etc.)
- Mises à jour régulières des prompts IA

## 🛠 Architecture Technique

### Structure du Projet

quizify/
├── config/
│   └── categories.js          # Configuration des 10 catégories + prompts IA
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Categories.jsx      # Page d'accueil des catégories
│   │   │   └── Category.jsx       # Page détaillée par catégorie
│   │   └── services/
│   │       └── categoryService.js # Service de gestion des catégories
│   └── ...
└── README.md

### Fonctionnalités Clés

1. **Détection automatique de catégorie** : Le système détecte automatiquement la catégorie la plus pertinente à partir du texte saisi
2. **Prompts IA optimisés** : Chaque catégorie a des prompts spécialement conçus pour générer les meilleurs quiz
3. **Multilingue** : Support complet Français/Anglais pour toutes les catégories
4. **Types de questions variés** : QCM, Vrai/Faux, Texte à trous, Reconnaissance auditive (pour la musique)

## 📦 Lot 1 : Configuration des 10 Catégories

Toutes les catégories sont configurées avec des prompts IA en français et anglais, des types de questions adaptés, des sujets d'exemple pertinents, et une détection automatique par tags.

## 🎨 Interface Utilisateur

### Page des Catégories
- Affichage en grille des 10 catégories
- Couleurs et icônes personnalisées
- Bouton d'accès rapide à chaque catégorie
- Promotion de l'abonnement premium

### Page de Catégorie
- Sélection de sujets proposés
- Saisie de texte personnalisé
- Choix du type de quiz (QCM, Vrai/Faux, Texte à trous)
- Sélection du nombre de questions (1-20)
- Choix de la difficulté (Facile, Moyen, Difficile)
- Génération instantanée du quiz

## 🚀 Utilisation

### Installation

```bash
git clone https://github.com/chachou8106-blip/Quizify.git
cd Quizify
cd frontend
npm install
npm run dev
```

### Générer un Quiz
1. Accéder à /categories
2. Sélectionner une catégorie
3. Choisir un sujet ou entrer votre texte
4. Sélectionner le type et la difficulté
5. Générer le quiz

## 📊 Statistiques
- 10 catégories disponibles
- 2 langues supportées
- 4 types de questions
- 100% généré par IA

## 📞 Support
- Organisation : Zen Chez Toi
- Utilisateur : Chat Chou

## 📄 Licence
Propriétaire : chachou8106-blip
---
Dernière mise à jour : 17 août 2026
Version : 1.0.0 (Modèle Hybride)
Statut : Configuration des 10 catégories terminée