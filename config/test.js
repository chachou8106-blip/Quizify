/**
 * Quizify - Configuration des 10 Catégories Principales
 * Chaque catégorie a des prompts IA optimisés pour générer les meilleurs quiz
 */

export const CATEGORIES = {
  music: {
    id: 'music',
    name: { fr: 'Musique', en: 'Music' },
    description: { fr: 'Test', en: 'Test' },
    aiPrompts: {
      fr: {
        multipleChoice: (text, count) => `Test ${count}`,
      },
    },
  },
};

console.log('Test file');
