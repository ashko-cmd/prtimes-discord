import { CATEGORIES } from './config.js';

export function classifyTitle(title) {
  // 「再発売」は「発売」も内包するため、より具体的な再販・終了系を先に判定する。
  const priority = [CATEGORIES[2], CATEGORIES[1], CATEGORIES[0]];
  for (const category of priority) {
    const matchedKeywords = category.keywords.filter((keyword) => title.includes(keyword));
    if (matchedKeywords.length > 0) {
      return { ...category, matchedKeywords };
    }
  }
  return null;
}
