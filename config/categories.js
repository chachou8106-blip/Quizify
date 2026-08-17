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
  },
  culture: {
    id: 'culture',
    name: { fr: 'Culture', en: 'Culture' },
    description: { fr: 'Quiz sur la culture générale', en: 'General culture quizzes' },
    icon: '🌍',
    color: '#3B82F6',
    tags: ['culture', 'art', 'littérature'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur la culture. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"culture"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur la culture. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"culture"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur la culture. JSON: [{"sentence":"...___...","answer":"...","category":"culture"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about culture. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"culture"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about culture. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"culture"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about culture. JSON: [{"sentence":"...___...","answer":"...","category":"culture"}]`
      }
    },
    sampleTopics: ['Picasso', 'Victor Hugo', 'traditions']
  },
  cinema: {
    id: 'cinema',
    name: { fr: 'Cinéma', en: 'Cinema' },
    description: { fr: 'Quiz sur les films et séries', en: 'Movies and TV shows quizzes' },
    icon: '🎬',
    color: '#EC4899',
    tags: ['cinéma', 'films', 'séries'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur le cinéma. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"cinéma"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur le cinéma. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"cinéma"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur le cinéma. JSON: [{"sentence":"...___...","answer":"...","category":"cinéma"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about cinema. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"cinema"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about cinema. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"cinema"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about cinema. JSON: [{"sentence":"...___...","answer":"...","category":"cinema"}]`
      }
    },
    sampleTopics: ['Star Wars', 'Marvel', 'Oscars']
  },
  sport: {
    id: 'sport',
    name: { fr: 'Sport', en: 'Sports' },
    description: { fr: 'Quiz sur tous les sports', en: 'Sports quizzes' },
    icon: '⚽',
    color: '#10B981',
    tags: ['sport', 'football', 'basketball'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur le sport. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"sport"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur le sport. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"sport"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur le sport. JSON: [{"sentence":"...___...","answer":"...","category":"sport"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about sports. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"sport"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about sports. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"sport"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about sports. JSON: [{"sentence":"...___...","answer":"...","category":"sport"}]`
      }
    },
    sampleTopics: ['Coupe du Monde', 'NBA', 'JO']
  },
  science: {
    id: 'science',
    name: { fr: 'Science', en: 'Science' },
    description: { fr: 'Quiz sur la science', en: 'Science quizzes' },
    icon: '🔬',
    color: '#F59E0B',
    tags: ['science', 'physique', 'chimie'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur la science. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"science"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur la science. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"science"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur la science. JSON: [{"sentence":"...___...","answer":"...","category":"science"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about science. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"science"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about science. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"science"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about science. JSON: [{"sentence":"...___...","answer":"...","category":"science"}]`
      }
    },
    sampleTopics: ['Einstein', 'ADN', 'espace']
  },
  history: {
    id: 'history',
    name: { fr: 'Histoire', en: 'History' },
    description: { fr: 'Quiz sur l histoire', en: 'History quizzes' },
    icon: '🏛️',
    color: '#8B5CF6',
    tags: ['histoire', 'guerres', 'civilisations'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur l histoire. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"histoire"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur l histoire. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"histoire"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur l histoire. JSON: [{"sentence":"...___...","answer":"...","category":"histoire"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about history. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"history"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about history. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"history"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about history. JSON: [{"sentence":"...___...","answer":"...","category":"history"}]`
      }
    },
    sampleTopics: ['Seconde Guerre Mondiale', 'Égypte', 'Rome']
  },
  languages: {
    id: 'languages',
    name: { fr: 'Langues', en: 'Languages' },
    description: { fr: 'Quiz pour apprendre les langues', en: 'Language learning quizzes' },
    icon: '🗣️',
    color: '#EF4444',
    tags: ['langues', 'français', 'anglais'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français pour apprendre les langues. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"langues"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français pour apprendre les langues. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"langues"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français pour apprendre les langues. JSON: [{"sentence":"...___...","answer":"...","category":"langues"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English for learning languages. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"languages"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English for learning languages. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"languages"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English for learning languages. JSON: [{"sentence":"...___...","answer":"...","category":"languages"}]`
      }
    },
    sampleTopics: ['verbes irréguliers', 'vocabulaire']
  },
  gaming: {
    id: 'gaming',
    name: { fr: 'Jeux Vidéo', en: 'Gaming' },
    description: { fr: 'Quiz sur les jeux vidéo', en: 'Video games quizzes' },
    icon: '🎮',
    color: '#06B6D4',
    tags: ['jeux', 'video games', 'esport'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur les jeux vidéo. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"jeux vidéo"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur les jeux vidéo. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"jeux vidéo"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur les jeux vidéo. JSON: [{"sentence":"...___...","answer":"...","category":"jeux vidéo"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about video games. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"gaming"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about video games. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"gaming"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about video games. JSON: [{"sentence":"...___...","answer":"...","category":"gaming"}]`
      }
    },
    sampleTopics: ['Fortnite', 'League of Legends', 'Minecraft']
  },
  food: {
    id: 'food',
    name: { fr: 'Cuisine', en: 'Food' },
    description: { fr: 'Quiz sur la cuisine', en: 'Food and cooking quizzes' },
    icon: '🍳',
    color: '#F97316',
    tags: ['cuisine', 'recettes', 'ingrédients'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur la cuisine. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"cuisine"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur la cuisine. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"cuisine"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur la cuisine. JSON: [{"sentence":"...___...","answer":"...","category":"cuisine"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about food. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"food"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about food. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"food"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about food. JSON: [{"sentence":"...___...","answer":"...","category":"food"}]`
      }
    },
    sampleTopics: ['recettes', 'pâtisserie', 'techniques']
  },
  travel: {
    id: 'travel',
    name: { fr: 'Voyages', en: 'Travel' },
    description: { fr: 'Quiz sur les voyages', en: 'Travel quizzes' },
    icon: '✈️',
    color: '#84CC16',
    tags: ['voyages', 'pays', 'monuments'],
    questionTypes: ['multipleChoice', 'trueFalse', 'fillBlank'],
    aiPrompts: {
      fr: {
        multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur les voyages. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"voyages"}]`,
        trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français sur les voyages. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"voyages"}]`,
        fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français sur les voyages. JSON: [{"sentence":"...___...","answer":"...","category":"voyages"}]`
      },
      en: {
        multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English about travel. JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"travel"}]`,
        trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements in English about travel. JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"travel"}]`,
        fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences in English about travel. JSON: [{"sentence":"...___...","answer":"...","category":"travel"}]`
      }
    },
    sampleTopics: ['Tour Eiffel', 'Pyramides', 'Japon']
  }
};
export const CATEGORY_IDS = Object.keys(CATEGORIES);
export function getCategoryById(id) { return CATEGORIES[id]; }
export default CATEGORIES;