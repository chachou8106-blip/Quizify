import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { getCategory, getSampleTopics } from "../services/categoryService";
import { generateQuiz } from "../services/aiService";
export default function Category() {
  const { t, language } = useLanguage();
  const { categoryId } = useParams();
  const category = getCategory(categoryId);
  if (!category) return (<div className="text-center py-12"><h2>Category not found</h2><Link to="/categories" className="bg-purple-600 text-white px-6 py-3 rounded-lg">Back</Link></div>);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [customText, setCustomText] = useState("");
  const [quizType, setQuizType] = useState("multipleChoice");
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState("");
  const sampleTopics = getSampleTopics(categoryId);
  const handleGenerate = async () => {
    const text = customText || selectedTopic;
    if (!text) { setError("Please select a topic or enter text"); return; }
    setLoading(true);
    try {
      const response = await generateQuiz({ text: `${text} - Category: ${category.name[language]}` , type: quizType, count: questionCount, language, difficulty });
      setQuiz(response.quiz);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const questionTypes = [{value: "multipleChoice", label: {fr: "QCM", en: "Multiple Choice"}}, {value: "trueFalse", label: {fr: "Vrai/Faux", en: "True/False"}}, {value: "fillBlank", label: {fr: "Texte à trous", en: "Fill Blank"}}];
  if (categoryId === "music") questionTypes.push({value: "audioRecognition", label: {fr: "Reconnaissance auditive", en: "Audio Recognition"}});
  return (<div className="max-w-6xl mx-auto p-6"><section className="text-center py-8" style={{backgroundColor: category.color + "20"}}><h1 className="text-4xl font-bold mb-2">{category.icon} {category.name[language]}</h1><p className="text-xl mb-6">{category.description[language]}</p><Link to="/pricing" className="bg-purple-600 text-white px-8 py-3 rounded-lg">Subscribe - {category.price}</Link></section><section className="py-8"><h2 className="text-2xl font-bold text-center mb-6">Create Quiz in {category.name[language]}</h2>{error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div><div className="mb-6"><h4 className="font-medium mb-2">Suggested Topics</h4><div className="flex flex-wrap gap-2">{sampleTopics.map((topic, i) => (<button key={i} onClick={() => { setSelectedTopic(topic); setCustomText(""); }} className={`px-3 py-2 rounded-lg text-sm ${selectedTopic === topic ? "bg-purple-600 text-white" : "bg-gray-200 hover:bg-purple-100"}`}>{topic}</button>))}</div></div><div className="mb-6"><h4 className="font-medium mb-2">Or Enter Custom Text</h4><textarea value={customText} onChange={(e) => { setCustomText(e.target.value); setSelectedTopic(""); }} placeholder="Enter your text here..." className="w-full p-4 border rounded-lg h-32"></textarea></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><div><label className="block text-sm font-medium mb-2">Quiz Type</label><select value={quizType} onChange={(e) => setQuizType(e.target.value)} className="w-full p-2 border rounded">{questionTypes.map((type) => (<option key={type.value} value={type.value}>{type.label[language]}</option>))}</select></div><div><label className="block text-sm font-medium mb-2">Questions</label><input type="number" min="1" max="20" value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded" /></div><div><label className="block text-sm font-medium mb-2">Difficulty</label><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full p-2 border rounded"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div></div><button onClick={handleGenerate} disabled={loading || (!selectedTopic && !customText.trim())} className="w-full bg-purple-600 text-white py-4 rounded-lg disabled:opacity-50">{loading ? "Generating..." : "Generate Quiz"}</button></section>{quiz && (<section className="py-8"><h2 className="text-2xl font-bold text-center mb-6">Generated Quiz</h2><div className="space-y-4">{quiz.questions.map((q, i) => (<div key={i} className="p-4 border rounded-lg bg-white dark:bg-gray-800"><p className="font-medium">{i + 1}. {q.question || q.statement}</p>{q.options && <ul className="list-disc list-inside mt-2 pl-4">{q.options.map((opt, j) => (<li key={j} className={opt === q.answer ? "text-green-600" : ""}>{opt}</li>))}</ul>}{q.sentence && <p className="mt-2">{q.sentence.replace("___", <span className="bg-yellow-200 px-2 py-1 rounded">{q.answer}</span>)}</p>}{q.explanation && <p className="mt-2 text-sm text-gray-500">Explanation: {q.explanation}</p>}</div>))}</div><div className="mt-6 flex gap-4 justify-center"><button className="bg-green-600 text-white px-6 py-3 rounded-lg">Save Quiz</button><button className="bg-blue-600 text-white px-6 py-3 rounded-lg">Export PDF</button><button className="bg-pink-600 text-white px-6 py-3 rounded-lg">Share</button><button onClick={() => { setQuiz(null); setSelectedTopic(""); setCustomText(""); }} className="bg-gray-600 text-white px-6 py-3 rounded-lg">Create Another</button></div></section>)</div>);
}