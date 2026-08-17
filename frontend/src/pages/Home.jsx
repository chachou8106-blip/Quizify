import { Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';

export default function Home() {
  const { t } = useLanguage();
  const features = [
    { icon: '🎵', title: t('youtubeQuizGenerator'), description: 'Transformez vidéos YouTube en quiz' },
    { icon: '📝', title: t('sourceText'), description: 'Créez des quiz à partir de texte' },
    { icon: '🎯', title: t('allQuestionTypes'), description: 'QCM, Vrai/Faux, Texte à trous, Audio' },
    { icon: '🌍', title: t('language'), description: 'Français et Anglais' },
    { icon: '💰', title: 'Monétisation', description: 'Vendez vos quiz sur Gumroad' },
    { icon: '📱', title: 'Responsive', description: 'Mobile, tablette, desktop' },
  ];
  return (
    <div className="max-w-6xl mx-auto">
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold text-gray-800 dark:text-white mb-4">QuizifyMusic</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">{t('tagline')}</p>
        <div className="flex justify-center gap-4">
          <Link to="/youtube" className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg">{t('youtubeQuiz')}</Link>
          <Link to="/create" className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg">{t('createQuiz')}</Link>
        </div>
      </section>
      <section className="py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Fonctionnalités</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-600 dark:text-gray-300">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="text-center py-16">
        <h2 className="text-3xl font-bold mb-4">Tarifs</h2>
        <p className="text-xl mb-8">Choisissez le plan qui vous convient</p>
        <Link to="/pricing" className="bg-pink-600 text-white px-8 py-4 rounded-lg text-lg">Voir les tarifs</Link>
      </section>
    </div>
  );
}