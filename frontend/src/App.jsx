import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './hooks/useLanguage';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import YouTubeQuiz from './pages/YouTubeQuiz';
import CreateQuiz from './pages/CreateQuiz';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MyQuizzes from './pages/MyQuizzes';
import Settings from './pages/Settings';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-purple-900">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/youtube" element={<YouTubeQuiz />} />
              <Route path="/create" element={<CreateQuiz />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/my-quizzes" element={<MyQuizzes />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;