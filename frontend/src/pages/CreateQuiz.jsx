import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { generateQuiz } from "../services/aiService";
export default function CreateQuiz() {
  const { t, language } = useLanguage();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const response = await generateQuiz({ text, type: "multipleChoice", count: 5, language });
      setQuiz(response.quiz);
    } catch (err) {}
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create Quiz from Text</h1>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("sourceTextPlaceholder")} className="w-full p-4 border rounded-lg h-64"></textarea>
      <button onClick={handleGenerate} disabled={loading} className="mt-4 w-full bg-purple-600 text-white py-4 rounded-lg">{loading ? t("generating") : t("generateQuiz")}</button>
      {quiz && <div className="mt-8 p-6 bg-purple-50 rounded-lg"><h2 className="text-xl font-bold mb-4">{t("generatedQuiz")}</h2></div>}
    </div>
  );
}