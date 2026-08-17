const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

export async function searchVideos(query, maxResults = 10) {
  if (!YOUTUBE_API_KEY) throw new Error('YouTube API key not configured');
  const response = await fetch(`${YOUTUBE_API_URL}/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`);
  if (!response.ok) throw new Error('YouTube API error');
  const data = await response.json();
  return data.items.map(item => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails: item.snippet.thumbnails,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

export async function getVideoTranscript(videoId) {
  try {
    const response = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
    if (!response.ok) return null;
    const html = await response.text();
    return parseTranscriptFromHtml(html);
  } catch (error) { return null; }
}

function parseTranscriptFromHtml(html) {
  try {
    const transcriptStart = html.indexOf('<div class="transcript-segment"');
    const transcriptEnd = html.indexOf('</div>', transcriptStart);
    if (transcriptStart === -1 || transcriptEnd === -1) return null;
    const transcriptSection = html.slice(transcriptStart, transcriptEnd);
    const text = transcriptSection.replace(/<[^>]*>/g, ' ');
    return text.trim();
  } catch (error) { return null; }
}