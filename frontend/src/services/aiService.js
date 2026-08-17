const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const MUSIC_QUIZ_PROMPTS = {
  fr: {
    multipleChoice: (t,c) => `Génère EXACTEMENT ${c} questions à choix multiples en français sur la musique. Réponds UNIQUEMENT avec un tableau JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"théorie|histoire|instruments"}]. Texte: ${t}`,
    trueFalse: (t,c) => `Génère EXACTEMENT ${c} affirmations Vrai/Faux en français. Format JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"théorie|histoire|instruments"}]. Texte: ${t}`,
    fillBlank: (t,c) => `Crée EXACTEMENT ${c} phrases à trous en français. Format JSON: [{"sentence":"...___...","answer":"...","category":"théorie|histoire|instruments"}]. Texte: ${t}`,
    audioRecognition: (t,c) => `Génère EXACTEMENT ${c} questions de reconnaissance auditive. Format JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"instruments"}]. Contexte: ${t}`
  },
  en: {
    multipleChoice: (t,c) => `Generate EXACTLY ${c} multiple-choice questions in English. ONLY valid JSON: [{"question":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"theory|history|instruments"}]. Text: ${t}`,
    trueFalse: (t,c) => `Generate EXACTLY ${c} True/False statements. Format JSON: [{"statement":"...","answer":true/false,"explanation":"...","category":"theory|history|instruments"}]. Text: ${t}`,
    fillBlank: (t,c) => `Create EXACTLY ${c} fill-in-the-blank sentences. Format JSON: [{"sentence":"...___...","answer":"...","category":"theory|history|instruments"}]. Text: ${t}`,
    audioRecognition: (t,c) => `Generate EXACTLY ${c} audio recognition questions. Format JSON: [{"question":"...","audioDescription":"...","options":["a","b","c","d"],"answer":"...","explanation":"...","category":"instruments"}]. Context: ${t}`
  }
};
export async function generateQuiz({ text, type = 'multipleChoice', count = 5, language = 'fr' }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key not configured');
  const prompt = MUSIC_QUIZ_PROMPTS[language]?.[type]?.(text, count);
  if (!prompt) throw new Error('Invalid type or language');
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2000 } })
  });
  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) throw new Error('No text generated');
  try {
    const jsonStart = generatedText.indexOf('[');
    const jsonEnd = generatedText.lastIndexOf(']') + 1;
    const questions = JSON.parse(generatedText.slice(jsonStart, jsonEnd));
    return { success: true, quiz: { questions, type, count, language } };
  } catch (e) {
    return { success: true, quiz: { questions: getDefaultQuestions(type, language), type, count, language } };
  }
}
function getDefaultQuestions(type, language) {
  const defaults = {
    fr: {
      multipleChoice: [{ question: 'Quel compositeur a écrit la Symphonie n°5 ?', options: ['Mozart', 'Beethoven', 'Bach', 'Chopin'], answer: 'Beethoven', explanation: 'La Symphonie n°5 a été composée par Beethoven en 1808.', category: 'histoire' }]
    },
    en: {
      multipleChoice: [{ question: 'Who composed Symphony No. 5?', options: ['Mozart', 'Beethoven', 'Bach', 'Chopin'], answer: 'Beethoven', explanation: 'Symphony No. 5 was composed by Beethoven in 1808.', category: 'history' }]
    }
  };
  return defaults[language]?.[type] || defaults.fr.multipleChoice;
}