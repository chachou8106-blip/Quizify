import { handleAiRequest } from './handlers/ai';
import { handleYouTubeRequest } from './handlers/youtube';
import { handleGumroadRequest } from './handlers/gumroad';
import { handleQuizRequest } from './handlers/quiz';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return new Response('OK', { status: 200, headers: corsHeaders });
    try {
      if (path.startsWith('/api/ai/')) return await handleAiRequest(request, env, ctx);
      if (path.startsWith('/api/youtube/')) return await handleYouTubeRequest(request, env, ctx);
      if (path.startsWith('/api/gumroad/')) return await handleGumroadRequest(request, env, ctx);
      if (path.startsWith('/api/quizzes') || path === '/api/quizzes') return await handleQuizRequest(request, env, ctx);
      if (path === '/api/health') return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: corsHeaders });
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  },
};