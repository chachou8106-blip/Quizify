/**
 * Quizify - Service de gestion des catégories
 * Gère la sélection, la classification automatique et la récupération des catégories
 */

import { CATEGORIES, CATEGORY_IDS, getCategoryById, getCategoryByTag, detectCategory } from '../../config/categories';

// Récupérer toutes les catégories
export function getAllCategories() {
  return Object.values(CATEGORIES);
}

// Récupérer une catégorie par ID
export function getCategory(id) {
  return getCategoryById(id);
}

// Récupérer les IDs de toutes les catégories
export function getAllCategoryIds() {
  return CATEGORY_IDS;
}

// Détecter automatiquement une catégorie à partir d'un texte
export function autoDetectCategory(text) {
  return detectCategory(text);
}

// Récupérer une catégorie par mot-clé (tag)
export function findCategoryByKeyword(keyword) {
  return getCategoryByTag(keyword);
}

// Obtenir les prompts IA pour une catégorie et un type de question
export function getAIPrompt(categoryId, questionType, text, count, language = 'fr') {
  const category = getCategoryById(categoryId);
  if (!category) {
    // Retourner le prompt par défaut (Culture Générale)
    return CATEGORIES.culture.aiPrompts[language]?.[questionType]?.(text, count) || 
           CATEGORIES.culture.aiPrompts.fr?.multipleChoice?.(text, count);
  }
  
  return category.aiPrompts[language]?.[questionType]?.(text, count) ||
         category.aiPrompts.fr?.multipleChoice?.(text, count);
}

// Obtenir les types de questions disponibles pour une catégorie
export function getQuestionTypes(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? category.questionTypes : ['multipleChoice', 'trueFalse', 'fillBlank'];
}

// Obtenir des sujets d'exemple pour une catégorie
export function getSampleTopics(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? category.sampleTopics : [];
}

// Vérifier si une catégorie existe
export function categoryExists(id) {
  return CATEGORY_IDS.includes(id);
}

// Obtenir la couleur d'une catégorie
export function getCategoryColor(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? category.color : '#9333EA';
}

// Obtenir l'icône d'une catégorie
export function getCategoryIcon(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? category.icon : '📚';
}

// Exporter toutes les catégories pour un accès direct
import * as categoriesConfig from '../../config/categories';
export { categoriesConfig };