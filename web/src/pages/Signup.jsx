import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await signup(email, password, name);
      navigate(params.get('next') || '/create');
    } catch (e2) { setError(e2.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="font-display text-3xl font-extrabold">Crée ton compte gratuit</h1>
        <p className="mt-1 font-semibold text-white/60">3 quiz offerts chaque mois, sans carte bancaire.</p>
      </div>
      <form onSubmit={submit} className="card space-y-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" className="input" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" className="input" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (8 caractères min.)" className="input" minLength={8} required />
        {error && <p className="font-bold text-cherry">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">{loading ? '⏳…' : 'C\'est parti ! 🚀'}</button>
      </form>
      <p className="text-center font-semibold text-white/60">
        Déjà un compte ? <Link to={`/login?next=${params.get('next') || '/'}`} className="font-bold text-grape-light">Connexion</Link>
      </p>
    </div>
  );
}
