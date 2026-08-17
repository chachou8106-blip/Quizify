import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
export default function Home() {
  const { t } = useLanguage();
  return (
    <div className="max-w-6xl mx-auto text-center py-16">
      <h1 className="text-5xl font-bold mb-4">QuizifyMusic</h1>
      <p className="text-xl mb-8">{t("tagline")}</p>
      <div className="flex justify-center gap-4">
        <Link to="/youtube" className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg">{t("youtubeQuiz")}</Link>
        <Link to="/create" className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg">{t("createQuiz")}</Link>
      </div>
      <div className="mt-16">
        <Link to="/pricing" className="bg-pink-600 text-white px-8 py-4 rounded-lg text-lg">Voir les tarifs</Link>
      </div>
    </div>
  );
}