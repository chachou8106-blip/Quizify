import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../hooks/useLanguage";
export default function MyQuizzes() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const mockQuizzes = [
      { id: "1", title: t("language") === "fr" ? "Quiz Théorie" : "Music Theory", type: "multipleChoice", questions: 10 },
      { id: "2", title: t("language") === "fr" ? "Quiz Histoire" : "Music History", type: "trueFalse", questions: 8 },
    ];
    setQuizzes(mockQuizzes);
    setLoading(false);
  }, [t]);
  if (loading) return <div className="text-center py-8">{t("loading")}</div>;
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t("myQuizzes")}</h1>
        <button className="bg-purple-600 text-white px-6 py-2 rounded-lg">{t("createNew")}</button>
      </div>
      {!isAuthenticated && <div className="bg-yellow-100 p-4 rounded-lg mb-6">{t("pleaseLogin")}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-2">{quiz.title}</h3>
            <span className="px-2 py-1 bg-purple-100 rounded text-sm">{quiz.type}</span>
            <span className="px-2 py-1 bg-gray-100 rounded text-sm ml-2">{quiz.questions} {t("questions")}</span>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-blue-600 text-white py-2 rounded">{t("view")}</button>
              <button className="flex-1 bg-green-600 text-white py-2 rounded">{t("edit")}</button>
              <button className="bg-red-600 text-white py-2 px-4 rounded">{t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}