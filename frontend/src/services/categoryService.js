import { CATEGORIES, getCategoryById } from "../../config/categories";
export function getAllCategories() { return Object.values(CATEGORIES); }
export function getCategory(id) { return getCategoryById(id); }
export function getSampleTopics(id) { const cat = getCategoryById(id); return cat ? cat.sampleTopics : []; }
export function getAIPrompt(categoryId, questionType, text, count, language = "fr") { const cat = getCategoryById(categoryId); if (!cat) return null; return cat.aiPrompts[language]?.[questionType]?.(text, count); }