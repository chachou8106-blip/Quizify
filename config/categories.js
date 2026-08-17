/**
 * Quizify - Configuration des 10 Catégories Principales
 * Chaque catégorie a des prompts IA optimisés pour générer les meilleurs quiz
 */

export const CATEGORIES = {
  // 1. Musique (Premium - déjà existant)
  music: {
    id: 'music',
    name: { fr: 'Musique', en: 'Music' },
    description: { fr: 'Quiz sur la théorie musicale, l\'histoire de la musique et la reconnaissance auditive', en: 'Quizzes about music theory, history, and audio recognition' },
    icon: '🎵',
    color: '#9333EA',
    price: '14.99€/mois',
    gumroadId: 'quiz-music-pro',
