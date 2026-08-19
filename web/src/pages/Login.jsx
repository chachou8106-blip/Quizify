import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate(params.get('next') || '/');
    } catch (e2) { setError(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-center font-display text-3xl font-extrabold">👋 Content de te revoir !</h1>
      <form onSubmit={submit} className="card space-y-4">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" className="input" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="input" required />
        {error && <p className="font-bold text-cherry">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">{loading ? '⏳…' : 'Connexion'}</button>
      </form>
      <p className="text-center font-semibold text-white/60">
        Pas encore de compte ? <Link to={`/signup?next=${params.get('next') || '/'}`} className="font-bold text-grape-light">Inscription gratuite</Link>
      </p>
    </div>
  );
}
