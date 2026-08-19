import { Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import Home from './pages/Home';
import Create from './pages/Create';
import Birthday from './pages/Birthday';
import BlindTest from './pages/BlindTest';
import Player from './pages/Player';
import MyQuizzes from './pages/MyQuizzes';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Host from './pages/Host';
import Join from './pages/Join';
import Reward from './pages/Reward';

export default function App() {
  const location = useLocation();
  return (
    <div className="min-h-screen">
      <Nav />
      <main key={location.pathname} className="page-enter mx-auto max-w-5xl px-4 pb-24 pt-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<Create />} />
          <Route path="/birthday" element={<Birthday />} />
          <Route path="/blindtest" element={<BlindTest />} />
          <Route path="/play/:id" element={<Player mode="own" />} />
          <Route path="/s/:code" element={<Player mode="shared" />} />
          <Route path="/quizzes" element={<MyQuizzes />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/host/:pin" element={<Host />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:pin" element={<Join />} />
          <Route path="/reward/:code" element={<Reward />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
