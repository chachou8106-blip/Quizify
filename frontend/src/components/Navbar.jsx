import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../hooks/useLanguage';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🎵</span>
            <span className="text-xl font-bold text-gray-800 dark:text-white">QuizifyMusic</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">{t('home')}</Link>
            <Link to="/youtube" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">{t('youtubeQuiz')}</Link>
            <Link to="/create" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">{t('createQuiz')}</Link>
            <Link to="/pricing" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">{t('pricing')}</Link>
            {isAuthenticated && (<>
              <Link to="/my-quizzes" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">{t('myQuizzes')}</Link>
              <Link to="/settings" className="text-gray-600 dark:text-gray-300 hover:text-purple-600">{t('settingsTitle')}</Link>
            </>)}
            <button onClick={toggleLanguage} className="text-sm">{language === 'fr' ? '🇫🇷' : '🇬🇧'}</button>
            {isAuthenticated ? (
              <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded-lg">{t('logout')}</button>
            ) : (
              <>
                <Link to="/login" className="text-purple-600">{t('login')}</Link>
                <Link to="/signup" className="bg-purple-600 text-white px-4 py-2 rounded-lg">{t('signup')}</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}