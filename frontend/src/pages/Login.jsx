import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../hooks/useLanguage";
export default function Login() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {}
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold text-center mb-8">{t("login")}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">{t("email")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className="w-full p-3 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t("password")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="w-full p-3 border rounded-lg" required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-lg">{loading ? t("loggingIn") : t("login")}</button>
      </form>
      <p className="text-center mt-4">{t("noAccount")} <Link to="/signup" className="text-purple-600">{t("signup")}</Link></p>
      <p className="text-center mt-2 text-sm text-gray-500">{t("demoMode")}: {t("useAnyEmail")}</p>
    </div>
  );
}