import { Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { GUMROAD_PRODUCTS } from '../services/gumroadService';

export default function Pricing() {
  const { t } = useLanguage();
  const plans = [
    { id: 'free', name: t('free'), price: '0€', features: ['3 quiz/mois', 'Types de base', 'Export PDF'], cta: t('getStarted'), to: '/create', featured: false },
    { id: 'pro', name: 'Pro', price: '9.99€/mois', features: [t('unlimitedQuizzes'), t('allQuestionTypes'), 'Export SCORM', 'Support email'], cta: t('buyNow'), url: GUMROAD_PRODUCTS.pro.url, featured: false },
    { id: 'music', name: 'Musique', price: '14.99€/mois', features: [t('unlimitedQuizzes'), t('allQuestionTypes'), 'Quiz YouTube', 'Reconnaissance auditive'], cta: t('buyNow'), url: GUMROAD_PRODUCTS.music.url, featured: true },
    { id: 'course', name: 'Formation', price: '49.99€', features: ['100 quiz exemples', 'Guide vidéo', 'Templates premium', 'Accès à vie'], cta: t('buyNow'), url: GUMROAD_PRODUCTS.course.url, featured: false },
  ];
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-12">{t('pricingPlans')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, i) => (
          <div key={i} className={`p-6 rounded-xl shadow-lg border-2 ${plan.featured ? 'border-purple-500 transform scale-105' : 'border-gray-200'}`}>
            <h2 className="text-xl font-bold mb-2">{plan.name}</h2>
            <div className="mb-4"><span className="text-3xl font-bold text-purple-600">{plan.price}</span></div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  {f}
                </li>
              ))}
            </ul>
            {plan.to ? (
              <Link to={plan.to} className="block w-full text-center bg-purple-600 text-white py-3 rounded-lg">{plan.cta}</Link>
            ) : (
              <a href={plan.url} target="_blank" className="block w-full text-center bg-pink-600 text-white py-3 rounded-lg">{plan.cta}</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}