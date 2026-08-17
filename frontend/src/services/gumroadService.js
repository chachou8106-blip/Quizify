export const GUMROAD_PRODUCTS = {
  pro: {
    id: 'quiz-pro',
    name: { fr: 'Abonnement Pro', en: 'Pro Subscription' },
    price: '9.99€/mois',
    url: 'https://gumroad.com/l/quiz-pro'
  },
  music: {
    id: 'quiz-music',
    name: { fr: 'Abonnement Musique', en: 'Music Subscription' },
    price: '14.99€/mois',
    url: 'https://gumroad.com/l/quiz-music'
  },
  course: {
    id: 'music-course',
    name: { fr: 'Formation Complète', en: 'Complete Course' },
    price: '49.99€',
    url: 'https://gumroad.com/l/music-course'
  }
};

export function getBuyUrl(productId) {
  const product = Object.values(GUMROAD_PRODUCTS).find(p => p.id === productId);
  return product ? product.url : GUMROAD_PRODUCTS.pro.url;
}

export function openGumroadPopup(productId) {
  const product = Object.values(GUMROAD_PRODUCTS).find(p => p.id === productId);
  if (product) window.open(product.url, '_blank');
}