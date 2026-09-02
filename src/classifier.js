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

const NON_PRODUCT_TERMS = '(?:イベント|セミナー|講演会|配信|アーカイブ|ログイン(?:ボーナス|プレゼント)?|キャンペーン|フェア|ツアー|展示会|制度|事業|市民証|ウェブ?サイト|ホームページ|施設)';
const NEGATED_RELEASE = /(?:発売|販売|提供)(?:を|は|が)?(?:しません|しない|されません|されない|停止|中止|終了)/;
const RELEASE_EVENT_REPORT = /(?:発売|販売)(?:を)?記念.{0,35}(?:イベント|会|開催|レポート)|(?:イベント|会).{0,35}(?:発売|販売)(?:を)?記念/s;
const NON_PRODUCT_LIMITED = new RegExp(`${NON_PRODUCT_TERMS}.{0,30}期間限定|期間限定.{0,30}${NON_PRODUCT_TERMS}`);
const NON_PRODUCT_RENEWAL = new RegExp(`${NON_PRODUCT_TERMS}.{0,20}リニューアル|リニューアル.{0,20}${NON_PRODUCT_TERMS}`);

function publicationYear(publishedAt) {
  const year = new Date(publishedAt ?? '').getFullYear();
  return Number.isFinite(year) ? year : null;
}

function isPastReleaseStatement(text, publishedAt) {
  if (/(?:発売|販売)(?:以来|から\d+年|されてから)|過去に.{0,20}(?:発売|販売)/s.test(text)) return true;
  const currentYear = publicationYear(publishedAt);
  if (!currentYear || !/(?:発売|販売)(?:された|した|していた)/.test(text)) return false;
  return [...text.matchAll(/(?:19|20)\d{2}年/g)]
    .some((match) => Number.parseInt(match[0], 10) < currentYear);
}

function isRejectedContext(text, publishedAt) {
  return NEGATED_RELEASE.test(text)
    || RELEASE_EVENT_REPORT.test(text)
    || NON_PRODUCT_LIMITED.test(text)
    || NON_PRODUCT_RENEWAL.test(text)
    || isPastReleaseStatement(text, publishedAt);
}

function classifyAuxiliaryText(text, publishedAt) {
  if (!text) return null;
  const accepted = [];
  for (const sentence of text.split(/(?<=[。！？!?])|\n+/).map((value) => value.trim()).filter(Boolean)) {
    const result = classifyTitle(sentence);
    if (!result || isRejectedContext(sentence, publishedAt)) continue;
    // 本文中の単独の「発売」は説明・沿革にも頻出するため、実施を示す表現だけを採用する。
    if (result.matchedKeywords.length === 1 && result.matchedKeywords[0] === '発売'
      && !/発売(?:します|いたします|開始|予定|決定|しました|いたしました|となります|になります|中です|へ)/.test(sentence)) continue;
    accepted.push({ sentence, result });
  }
  if (accepted.length === 0) return null;
  const category = accepted[0].result;
  const matchedKeywords = [...new Set(accepted
    .filter(({ result }) => result.name === category.name)
    .flatMap(({ result }) => result.matchedKeywords))];
  return { ...category, matchedKeywords };
}

export function classifyArticle(article) {
  const titleResult = classifyTitle(article.title ?? '');
  if (titleResult) return titleResult;

  const subtitleResult = classifyAuxiliaryText(article.subtitle ?? '', article.publishedAt);
  if (subtitleResult) return subtitleResult;

  return classifyAuxiliaryText(article.bodyExcerpt ?? '', article.publishedAt);
}
