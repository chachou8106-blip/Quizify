/**
 * Quizify - Configuration des 10 Catégories Principales
 * Chaque catégorie a des prompts IA optimisés pour générer les meilleurs quiz
 */

export const CATEGORIES = {
  // 1. Musique (Premium - déjà existant)
  music: {
    id: 'music',
    name: { fr: 'Musique', en: 'Music' },
    description: { fr: 'Quiz sur la théorie musicale, l'histoire de la musique et la reconnaissance auditive', en: 'Quizzes about music theory, history, and audio recognition' },
    icon: '🎵',
    color: '#9333EA',
    price: '14.99€/mois',
    gumroadId: 'quiz-music-pro',
    tags: ['musique', 'music', 'théorie', 'theory', 'instruments', 'compositeurs', 'composers'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank', 'audioRecognition'],
    aiPrompts: {
      fr: {
        multipleChoice: (text, count) => `Génère EXACTEMENT ${count} questions à choix multiples en français sur la musique. Réponds UNIQUEMENT avec un tableau JSON valide: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"musique","difficulty":"moyen"}]. Texte: ${text}`,
        trueFalse: (text, count) => `Génère EXACTEMENT ${count} affirmations Vrai/Faux en français sur la musique. Format JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"musique","difficulty":"moyen"}]. Texte: ${text}`,
        fillBlank: (text, count) => `Crée EXACTEMENT ${count} phrases à trous en français sur la musique. Format JSON: [{"sentence":"...___...","answer":"...","category":"musique","difficulty":"moyen"}]. Texte: ${text}`,
        audioRecognition: (text, count) => `Génère EXACTEMENT ${count} questions de reconnaissance auditive en français. Format JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"musique","difficulty":"moyen"}]. Contexte: ${text}`
      },
      en: {
        multipleChoice: (text, count) => `Generate EXACTLY ${count} multiple-choice questions in English about music. ONLY valid JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"music","difficulty":"medium"}]. Text: ${text}`,
        trueFalse: (text, count) => `Generate EXACTLY ${count} True/False statements in English about music. Format JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"music","difficulty":"medium"}]. Text: ${text}`,
        fillBlank: (text, count) => `Create EXACTLY ${count} fill-in-the-blank sentences in English about music. Format JSON: [{"sentence":"...___...","answer":"...","category":"music","difficulty":"medium"}]. Text: ${text}`,
        audioRecognition: (text, count) => `Generate EXACTLY ${count} audio recognition questions in English. Format JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"music","difficulty":"medium"}]. Context: ${text}`
      }
    },
    sampleTopics: ['Bach', 'Beethoven', 'Mozart', 'théorie musicale', 'solfège', 'instruments']
  },

  // 2. Culture Générale
  culture: {
    id: 'culture',
    name: { fr: 'Culture Générale', en: 'General Culture' },
    description: { fr: 'Quiz sur l'art, la littérature, les traditions et le savoir général', en: 'Quizzes about art, literature, traditions, and general knowledge' },
    icon: '🌍',
    color: '#3B82F6',
    price: '12.99€/mois',
    gumroadId: 'quiz-culture-pro',
    tags: ['culture', 'art', 'littérature', 'literature', 'traditions', 'savoir', 'knowledge'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
