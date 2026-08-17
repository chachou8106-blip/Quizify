const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

const MUSIC_QUIZ_PROMPTS = {
  fr: {
    multipleChoice: (text, count) => `Génère EXACTEMENT ${count} questions à choix multiples en français sur la musique. Réponds UNIQUEMENT avec un tableau JSON valide: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"théorie|histoire|instruments"}]. Texte: ${text}`,
    trueFalse: (text, count) => `Génère EXACTEMENT ${count} affirmations Vrai/Faux en français sur la musique. Format JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"théorie|histoire|instruments"}]. Texte: ${text}`,
    fillBlank: (text, count) => `Crée EXACTEMENT ${count} phrases à trous en français. Format JSON: [{"sentence":"...___...","answer":"...","category":"théorie|histoire|instruments"}]. Texte: ${text}`,
    audioRecognition: (text, count) => `Génère EXACTEMENT ${count} questions de reconnaissance auditive en français. Format JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"instruments"}]. Contexte: ${text}`,
  },
  en: {
    multipleChoice: (text, count) => `Generate EXACTLY ${count} multiple-choice questions in English about music. ONLY valid JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"theory|history|instruments"}]. Text: ${text}`,
    trueFalse: (text, count) => `Generate EXACTLY ${count} True/False statements in English about music. Format JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"theory|history|instruments"}]. Text: ${text}`,
    fillBlank: (text, count) => `Create EXACTLY ${count} fill-in-the-blank sentences in English. Format JSON: [{"sentence":"...___...","answer":"...","category":"theory|history|instruments"}]. Text: ${text}`,
    audioRecognition: (text, count) => `Generate EXACTLY ${count} audio recognition questions in English. Format JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"instruments"}]. Context: ${text}`,
  },
};

export async function generateQuiz({ text, type = 'multipleChoice', count = 5, language = 'fr', difficulty = 'medium' }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');
  const prompt = MUSIC_QUIZ_PROMPTS[language]?.[type]?.(text, count);
  if (!prompt) throw new Error('Invalid quiz type or language');
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    }),
  });
  if (!response.ok) throw new Error('Gemini API error');
  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) throw new Error('No text generated');
  try {
    const jsonStart = generatedText.indexOf('[');
    const jsonEnd = generatedText.lastIndexOf(']') + 1;
    const questions = JSON.parse(generatedText.slice(jsonStart, jsonEnd));
    return { success: true, quiz: { questions, type, count, language, difficulty } };
  } catch (e) {
    return { success: true, quiz: { questions: getDefaultQuestions(type, language), type, count, language, difficulty } };
  }
}

function getDefaultQuestions(type, language) {
  const defaults = {
    fr: {
      multipleChoice: [{ question: 'Quel compositeur a écrit la Symphonie n°5 ?', options: ['Mozart', 'Beethoven', 'Bach', 'Chopin'], answer: 'Beethoven', explanation: 'La Symphonie n°5 a été composée par Beethoven en 1808.', category: 'histoire' }],
      trueFalse: [{ statement: 'Le piano est un instrument à cordes.', answer: true, explanation: 'Le piano est classé comme instrument à cordes frappées.', category: 'instruments' }],
      fillBlank: [{ sentence: 'La note ___ est la tonique de Do majeur.', answer: 'Do', category: 'théorie' }],
      audioRecognition: [{ question: 'Quel instrument entends-tu ?', audioDescription: 'Instrument à cordes pincées', options: ['Piano', 'Guitare', 'Violon', 'Harpe'], answer: 'Guitare', explanation: 'La guitare est un instrument à cordes pincées.', category: 'instruments' }],
    },
    en: {
      multipleChoice: [{ question: 'Who composed Symphony No. 5?', options: ['Mozart', 'Beethoven', 'Bach', 'Chopin'], answer: 'Beethoven', explanation: 'Symphony No. 5 was composed by Beethoven in 1808.', category: 'history' }],
      trueFalse: [{ statement: 'The piano is a string instrument.', answer: true, explanation: 'The piano is a keyboard instrument with struck strings.', category: 'instruments' }],
      fillBlank: [{ sentence: 'The note ___ is the tonic of C major.', answer: 'C', category: 'theory' }],
      audioRecognition: [{ question: 'Which instrument do you hear?', audioDescription: 'Plucked string instrument', options: ['Piano', 'Guitar', 'Violin', 'Harp'], answer: 'Guitar', explanation: 'The guitar is a plucked string instrument.', category: 'instruments' }],
    },
  };
  return defaults[language]?.[type] || defaults.fr.multipleChoice;
}