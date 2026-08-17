import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { getCategory, getSampleTopics } from '../services/categoryService';
import { generateQuiz } from '../services/aiService';

export default function Category() {
  const { t, language } = useLanguage();
  const { categoryId } = useParams();
  const category = getCategory(categoryId);
  
  if (!category) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">{t('categoryNotFound')}</h2>
        <Link to="/categories" className="bg-purple-600 text-white px-6 py-3 rounded-lg">
          {t('backToCategories')}
        </Link>
      </div>
    );
  }

  const handleGenerateQuiz = async () => {
    const text = 'test';
    setLoading(true);
    try {
      const response = await generateQuiz({
        text: `${text}`,
        type: 'multipleChoice',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">Test</div>
  );
}