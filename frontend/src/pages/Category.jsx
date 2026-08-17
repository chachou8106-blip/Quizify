import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { getCategory, getSampleTopics } from '../services/categoryService';
import { generateQuiz } from '../services/aiService';

export default function Category() {
  const { t, language } = useLanguage();
  const { categoryId } = useParams();
  const category = getCategory(categoryId);
  
  // Si la catégorie n'existe pas, rediriger vers les catégories
  if (!category) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">{t('categoryNotFound')}</h2>
        <Link to="/categories" className="bg-purple-600 text-white px-6 py-3 rounded-lg">
          {t('backToCategories')}
        </Link>
      </div>
    );
  }

  const [selectedTopic, setSelectedTopic] = useState('');
  const [customText, setCustomText] = useState('');
  const [quizType, setQuizType] = useState('multipleChoice');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');

  const sampleTopics = getSampleTopics(categoryId);

  const handleGenerateQuiz = async () => {
    const text = customText || selectedTopic;
    if (!text) {
      setError(t('pleaseSelectTopic'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await generateQuiz({
        text: `${text}

Catégorie: ${category.name[language]}
Contexte: ${category.description[language]}`,
        type: quizType,
        count: questionCount,
        language,
        difficulty,
      });
      setQuiz(response.quiz);
    } catch (err) {
      setError(err.message || t('generationError'));
    } finally {
      setLoading(false);
    }
  };

  const questionTypes = [
    { value: 'multipleChoice', label: { fr: 'QCM (4 options)', en: 'Multiple Choice' } },
    { value: 'trueFalse', label: { fr: 'Vrai/Faux', en: 'True/False' } },
    { value: 'fillBlank', label: { fr: 'Texte à trous', en: 'Fill in the Blank' } },
  ];

  // Ajouter audioRecognition si la catégorie est Musique
  if (categoryId === 'music') {
    questionTypes.push({
      value: 'audioRecognition',
      label: { fr: 'Reconnaissance auditive', en: 'Audio Recognition' }
    });
  }

  const difficulties = [
    { value: 'easy', label: { fr: 'Facile', en: 'Easy' } },
    { value: 'medium', label: { fr: 'Moyen', en: 'Medium' } },
    { value: 'hard', label: { fr: 'Difficile', en: 'Hard' } },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* En-tête de la catégorie */}
      <section className="text-center py-8" style={{ backgroundColor: category.color + '20' }}>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          {category.icon} {category.name[language]}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
          {category.description[language]}
        </p>
        
        {/* Abonnement catégorie */}
        <div className="mb-8">
          <Link 
            to="/pricing" 
            className="bg-purple-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-purple-700"
          >
            {t('subscribeToAccess')} - {category.price}
          </Link>
        </div>
      </section>

      {/* Générateur de quiz pour cette catégorie */}
      <section className="py-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">
          {t('createQuizInCategory', { category: category.name[language] })}
        </h2>

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>
        )}

        {/* Sélection de sujet ou texte personnalisé */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('selectTopicOrEnterText')}</h3>
          
          {/* Sujets proposés */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">{t('suggestedTopics')}</h4>
            <div className="flex flex-wrap gap-2">
              {sampleTopics.map((topic, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedTopic(topic);
                    setCustomText('');
                  }}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    selectedTopic === topic
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Ou texte personnalisé */}
          <div className="mb-6">
            <h4 className="font-medium mb-2">{t('orEnterCustomText')}</h4>
            <textarea
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                setSelectedTopic('');
              }}
              placeholder={t('enterYourTextHere')}
              className="w-full p-4 border rounded-lg h-32"
            />
          </div>

        {/* Options de quiz */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">{t('quizType')}</label>
            <select
              value={quizType}
              onChange={(e) => setQuizType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {questionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label[language]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('questionCount')}</label>
            <input
              type="number"
              min="1"
              max="20"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('difficulty')}</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {difficulties.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label[language]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bouton de génération */}
        <button
          onClick={handleGenerateQuiz}
          disabled={loading || (!selectedTopic && !customText.trim())}
          className="w-full bg-purple-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? t('generating') : t('generateQuiz')}
        </button>
      </section>

      {/* Résultat du quiz */}
      {quiz && (
        <section className="py-8">
          <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">
            {t('generatedQuiz')}
          </h2>
          <div className="space-y-4">
            {quiz.questions.map((q, i) => (
              <div
                key={i}
                className="p-4 border rounded-lg bg-white dark:bg-gray-800"
              >
                <p className="font-medium text-gray-800 dark:text-white">
                  {i + 1}. {q.question || q.statement}
                </p>
                {q.options && (
                  <ul className="list-disc list-inside mt-2 pl-4 text-gray-600 dark:text-gray-300">
                    {q.options.map((opt, j) => (
                      <li
                        key={j}
                        className={opt === q.answer ? 'text-green-600 font-semibold' : ''}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
                {q.sentence && (
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    {q.sentence.replace('___', (
                      <span className="bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded">
                        {q.answer}
                      </span>
                    ))}
                  </p>
                )}
                {q.explanation && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('explanation')}: {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Actions sur le quiz */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <button className="bg-green-600 text-white px-6 py-3 rounded-lg">
              {t('saveQuiz')}
            </button>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
              {t('exportPDF')}
            </button>
            <button className="bg-pink-600 text-white px-6 py-3 rounded-lg">
              {t('share')}
            </button>
            <button 
              onClick={() => {
                setQuiz(null);
                setSelectedTopic('');
                setCustomText('');
              }}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg"
            >
              {t('createAnother')}
            </button>
          </div>
        </section>
      )}

      {/* Autres catégories */}
      <section className="py-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">
          {t('otherCategories')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.values(getAllCategories()).filter(cat => cat.id !== categoryId).map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.id}`}
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-3xl mb-2">{cat.icon}</span>
              <span className="text-sm font-medium">{cat.name[language]}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// Fonction pour obtenir toutes les catégories (importée depuis categoryService)
import { getAllCategories } from '../services/categoryService';
