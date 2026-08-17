import { Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { getAllCategories } from '../services/categoryService';

export default function Categories() {
  const { t, language } = useLanguage();
  const categories = getAllCategories();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* En-tête */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
          {t('allCategories')}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          {t('chooseYourCategory')}
        </p>
        
        {/* Abonnement unique */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-xl text-white mb-12">
          <h2 className="text-2xl font-bold mb-2">👑 {t('unlimitedAccess')}</h2>
          <p className="mb-4">{t('allCategoriesAccess')}</p>
          <Link 
            to="/pricing" 
            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100"
          >
            {t('subscribeNow')} - 29,99€/mois
          </Link>
        </div>
      </section>

      {/* Grille des catégories */}
      <section className="py-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-8">
          {t('exploreCategories')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.id}`}
              className="block p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
              style={{ backgroundColor: category.color + '20', border: `2px solid ${category.color}` }}
            >
              <div className="text-center">
                {/* Icône */}
                <div className="text-5xl mb-4">{category.icon}</div>
                
                {/* Nom */}
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  {category.name[language]}
                </h3>
                
                {/* Description */}
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                  {category.description[language]}
                </p>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {category.sampleTopics.slice(0, 2).map((topic, index) => (
                    <span 
                      key={index} 
                      className="px-2 py-1 bg-white/50 dark:bg-gray-700 rounded text-xs"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
                
                {/* Bouton */}
                <button className="mt-4 w-full bg-white text-gray-800 dark:bg-gray-800 dark:text-white py-2 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                  {t('explore')} →
                </button>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA pour créer un quiz */}
      <section className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          {t('createYourOwnQuiz')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {t('createInAnyCategory')}
        </p>
        <Link 
          to="/create" 
          className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700"
        >
          {t('createQuiz')}
        </Link>
      </section>
    </div>
  );
}