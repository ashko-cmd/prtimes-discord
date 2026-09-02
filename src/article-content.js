const BODY_EXCERPT_LENGTH = 600;
const SUBTITLE_LENGTH = 300;

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function htmlToText(value) {
  return decodeHtmlEntities(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>|<\/p\s*>|<\/div\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

function findReleaseContent(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.subtitle === 'string' && typeof value.text === 'string') return value;
  for (const child of Object.values(value)) {
    const found = findReleaseContent(child);
    if (found) return found;
  }
  return null;
}

export function extractArticleContent(html) {
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error('記事HTMLが空です。');
  }
  const nextData = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!nextData) throw new Error('記事の構造化データが見つかりません。');

  let document;
  try {
    document = JSON.parse(nextData);
  } catch (error) {
    throw new Error(`記事の構造化データを解析できません: ${error.message}`, { cause: error });
  }
  const release = findReleaseContent(document);
  if (!release) throw new Error('サブタイトル・本文データが見つかりません。');

  return {
    subtitle: htmlToText(release.subtitle).slice(0, SUBTITLE_LENGTH),
    bodyExcerpt: htmlToText(release.text).slice(0, BODY_EXCERPT_LENGTH),
  };
}

export function buildClassificationText(article) {
  return [article.title, article.subtitle, article.bodyExcerpt].filter(Boolean).join('\n');
}

export { BODY_EXCERPT_LENGTH };
