/**
 * Quizify - 10 Main Categories Configuration
 */
export const CATEGORIES = {
  music: {
    id: 'music',
    name: { fr: 'Musique', en: 'Music' },
    description: { fr: 'Quiz sur la musique', en: 'Music quizzes' },
    icon: '🎵',
    color: '#9333EA',
    tags: ['musique', 'music', 'théorie'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank', 'audioRecognition'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur la musique. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"musique"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur la musique. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"musique"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur la musique. JSON: [{"sentence":"...___...","answer":"...","category":"musique"}]`,
        audioRecognition: (t,c) => `Génère EXACTEMENT ${c} questions de reconnaissance auditive. JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","category":"musique"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about music. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"music"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about music. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"music"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about music. JSON: [{"sentence":"...___...","answer":"...","category":"music"}]`,
        audioRecognition: (t,c) => `Generate EXACTLY ${c} audio recognition questions. JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","category":"music"}]`
      }
    },
    sampleTopics: ['Bach', 'Beethoven', 'théorie musicale']
  }