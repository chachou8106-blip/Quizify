import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { searchVideos } from "../services/youtubeService";
import { generateQuiz } from "../services/aiService";
export default function YouTubeQuiz() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const results = await searchVideos(query, 10);
      setVideos(results);
    } catch (err) {}
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t("youtubeQuizGenerator")}</h1>
      <div className="flex gap-2 mb-4">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchYouTubePlaceholder")} className="flex-1 p-3 border rounded-lg" />
        <button onClick={handleSearch} disabled={loading} className="bg-purple-600 text-white px-6 py-3 rounded-lg">{loading ? t("searching") : t("searchYouTube")}</button>
      </div>
      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => (
            <div key={video.id} className="p-3 border rounded-lg hover:border-purple-300">
              <img src={video.thumbnails?.medium?.url} alt={video.title} className="w-full rounded mb-2" />
              <h3 className="font-medium truncate">{video.title}</h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}