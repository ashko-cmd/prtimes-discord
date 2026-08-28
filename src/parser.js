import { XMLParser, XMLValidator } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
const list = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

export function parseSource(xml, sourceName) {
  validateSourceXml(xml, sourceName);
  const document = parser.parse(xml);
  if (sourceName === 'news-sitemap') {
    return list(document.urlset?.url).map((entry) => ({
      title: String(entry['news:news']?.['news:title'] ?? ''),
      url: String(entry.loc ?? ''),
      publishedAt: String(entry['news:news']?.['news:publication_date'] ?? ''),
      source: sourceName,
    })).filter(validArticle);
  }

  return list(document['rdf:RDF']?.item ?? document.rss?.channel?.item).map((entry) => ({
    title: String(entry.title ?? ''),
    url: String(entry.link ?? ''),
    publishedAt: String(entry['dc:date'] ?? entry.pubDate ?? ''),
    source: sourceName,
  })).filter(validArticle);
}

export function validateSourceXml(xml, sourceName) {
  if (typeof xml !== 'string' || xml.length === 0) {
    throw new Error(`${sourceName}: XML本文が空です。`);
  }
  const trimmed = xml.trim();
  const expectedClosingTag = sourceName === 'news-sitemap' ? '</urlset>' : '</rdf:RDF>';
  if (!trimmed.endsWith(expectedClosingTag)) {
    throw new Error(`${sourceName}: XMLが途中で切れています（末尾に ${expectedClosingTag} がありません、${Buffer.byteLength(xml, 'utf8')} bytes）。`);
  }
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const line = validation.err?.line ?? '?';
    const column = validation.err?.col ?? '?';
    throw new Error(`${sourceName}: 不完全または不正なXMLです (${validation.err?.msg ?? 'unknown'}, line ${line}, col ${column})。`);
  }
}

function validArticle(article) {
  try {
    const url = new URL(article.url);
    return article.title.length > 0
      && ['prtimes.jp', 'www.prtimes.jp'].includes(url.hostname)
      && url.pathname.startsWith('/main/html/rd/p/');
  } catch {
    return false;
  }
}

export function mergeArticles(groups) {
  const byUrl = new Map();
  for (const article of groups.flat()) {
    const current = byUrl.get(article.url);
    if (!current || current.source === 'rss') byUrl.set(article.url, article);
  }
  return [...byUrl.values()].sort((a, b) => Date.parse(a.publishedAt || 0) - Date.parse(b.publishedAt || 0));
}
