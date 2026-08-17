const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};
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
export async function handleAiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/api/ai/generate' && request.method === 'POST') {
    try {
      const { text, type = 'multipleChoice', count = 5, language = 'fr', difficulty = 'medium' } = await request.json();
      if (!text) return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400, headers: corsHeaders });
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: corsHeaders });
      const prompt = MUSIC_QUIZ_PROMPTS[language]?.[type]?.(text, count);
      if (!prompt) return new Response(JSON.stringify({ error: 'Invalid type or language' }), { status: 400, headers: corsHeaders });
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
        return new Response(JSON.stringify({ success: true, quiz: { questions, type, count, language, difficulty } }), { status: 200, headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: true, quiz: { questions: getDefaultQuestions(type, language), type, count, language, difficulty } }), { status: 200, headers: corsHeaders });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
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