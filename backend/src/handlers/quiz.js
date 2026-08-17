const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};
export async function handleQuizRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const searchParams = url.searchParams;
  if (path === '/api/quizzes' && request.method === 'GET') {
    try {
      const userId = searchParams.get('userId');
      const email = searchParams.get('email');
      if (!userId && !email) return new Response(JSON.stringify({ error: 'userId or email required' }), { status: 400, headers: corsHeaders });
      const keys = await env.QUIZZES.list();
      const userPrefix = userId ? `user:${userId}:` : `email:${email}:`;
      const userQuizzes = [];
      for (const key of keys.keys) {
        if (key.name.startsWith(userPrefix)) {
          const quiz = await env.QUIZZES.get(key.name, 'json');
          if (quiz) userQuizzes.push(quiz);
        }
      }
      return new Response(JSON.stringify({ success: true, quizzes: userQuizzes }), { status: 200, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  if (path === '/api/quizzes' && request.method === 'POST') {
    try {
      const { quiz, userId, email } = await request.json();
      if (!quiz) return new Response(JSON.stringify({ error: 'quiz required' }), { status: 400, headers: corsHeaders });
      if (!userId && !email) return new Response(JSON.stringify({ error: 'userId or email required' }), { status: 400, headers: corsHeaders });
      const quizId = generateId();
      const prefix = userId ? `user:${userId}:` : `email:${email}:`;
      const key = `${prefix}quiz:${quizId}`;
      const quizWithMetadata = { ...quiz, id: quizId, userId: userId || null, email: email || null, createdAt: new Date().toISOString() };
      await env.QUIZZES.put(key, JSON.stringify(quizWithMetadata));
      return new Response(JSON.stringify({ success: true, quiz: quizWithMetadata }), { status: 201, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
}
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}