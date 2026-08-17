import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../hooks/useLanguage";
export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState("system");
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    if (newTheme === "dark") document.documentElement.classList.add("dark");
    else if (newTheme === "light") document.documentElement.classList.remove("dark");
  };
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">{t("settingsTitle")}</h1>
      <div className="space-y-8">
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{t("languageSettings")}</h2>
          <div className="flex gap-4">
            <button onClick={() => setLanguage("fr")} className={`px-6 py-3 rounded-lg ${language === "fr" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>Français</button>
            <button onClick={() => setLanguage("en")} className={`px-6 py-3 rounded-lg ${language === "en" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>English</button>
          </div>
        </section>
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">{t("themeSettings")}</h2>
          <div className="flex gap-4">
            <button onClick={() => handleThemeChange("light")} className={`px-6 py-3 rounded-lg ${theme === "light" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>✨ {t("light")}</button>
            <button onClick={() => handleThemeChange("dark")} className={`px-6 py-3 rounded-lg ${theme === "dark" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>🌙 {t("dark")}</button>
            <button onClick={() => handleThemeChange("system")} className={`px-6 py-3 rounded-lg ${theme === "system" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>🖥️ {t("system")}</button>
          </div>
        </section>
        <div className="flex gap-4">
          <button className="bg-green-600 text-white px-8 py-3 rounded-lg">{t("saveSettings")}</button>
          <button onClick={logout} className="bg-gray-600 text-white px-8 py-3 rounded-lg">{t("logout")}</button>
        </div>
      </div>
    </div>
  );
}