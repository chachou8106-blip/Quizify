const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};
export async function handleGumroadRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/api/gumroad/verify' && request.method === 'POST') {
    try {
      const { email, productId } = await request.json();
      if (!email || !productId) return new Response(JSON.stringify({ error: 'email and productId are required' }), { status: 400, headers: corsHeaders });
      return new Response(JSON.stringify({ success: true, isValid: true, message: 'Demo mode - all purchases are valid' }), { status: 200, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  if (path === '/api/gumroad/webhook' && request.method === 'POST') {
    try {
      const payload = await request.json();
      console.log('Gumroad webhook:', payload.event);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
}