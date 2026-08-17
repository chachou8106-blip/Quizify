const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};
export async function handleYouTubeRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const { searchParams } = url;
  if (path === '/api/youtube/search' && request.method === 'GET') {
    try {
      const query = searchParams.get('q');
      const maxResults = parseInt(searchParams.get('maxResults')) || 10;
      if (!query) return new Response(JSON.stringify({ error: 'Query parameter q is required' }), { status: 400, headers: corsHeaders });
      const apiKey = env.YOUTUBE_API_KEY;
      if (!apiKey) return new Response(JSON.stringify({ error: 'YouTube API key not configured' }), { status: 500, headers: corsHeaders });
      const response = await fetch(`${YOUTUBE_API_URL}/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
      if (!response.ok) throw new Error('YouTube API error');
      const data = await response.json();
      const videos = data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnails: item.snippet.thumbnails,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));
      return new Response(JSON.stringify({ success: true, videos }), { status: 200, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  if (path === '/api/youtube/transcript' && request.method === 'GET') {
    try {
      const videoId = searchParams.get('videoId');
      if (!videoId) return new Response(JSON.stringify({ error: 'videoId parameter is required' }), { status: 400, headers: corsHeaders });
      const response = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
      if (!response.ok) return new Response(JSON.stringify({ error: 'Failed to fetch transcript' }), { status: 500, headers: corsHeaders });
      const html = await response.text();
      const transcript = parseTranscriptFromHtml(html);
      if (!transcript) return new Response(JSON.stringify({ error: 'No transcript available' }), { status: 404, headers: corsHeaders });
      return new Response(JSON.stringify({ success: true, transcript }), { status: 200, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
}
function parseTranscriptFromHtml(html) {
  try {
    const transcriptStart = html.indexOf('<div class="transcript-segment"');
    const transcriptEnd = html.indexOf('</div>', transcriptStart);
    if (transcriptStart === -1 || transcriptEnd === -1) return null;
    const transcriptSection = html.slice(transcriptStart, transcriptEnd);
    const text = transcriptSection.replace(/<[^>]*>/g, ' ');
    return text.trim();
  } catch (error) {
    return null;
  }
}