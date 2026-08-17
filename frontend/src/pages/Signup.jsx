import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../hooks/useLanguage";
export default function Signup() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err) {}
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold text-center mb-8">{t("signup")}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">{t("name")}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className="w-full p-3 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t("email")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className="w-full p-3 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t("password")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="w-full p-3 border rounded-lg" required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-lg">{loading ? t("creatingAccount") : t("signup")}</button>
      </form>
      <p className="text-center mt-4">{t("alreadyHaveAccount")} <Link to="/login" className="text-purple-600">{t("login")}</Link></p>
      <p className="text-center mt-2 text-sm text-gray-500">{t("demoMode")}: {t("useAnyEmail")}</p>
    </div>
  );
}