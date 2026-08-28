import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSource, validateSourceXml } from '../src/parser.js';

test('ニュースサイトマップから指定2記事を取得できる', () => {
  const xml = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
    <url><loc>https://prtimes.jp/main/html/rd/p/000000107.000154819.html</loc><news:news><news:publication_date>2026-08-28T15:36:00+09:00</news:publication_date><news:title>KUNDAL、ダメージケアラインの新製品を8月下旬発よりPLAZAにて先行発売！</news:title></news:news></url>
    <url><loc>https://prtimes.jp/main/html/rd/p/000000015.000015083.html</loc><news:news><news:publication_date>2026-08-28T14:00:00+09:00</news:publication_date><news:title>スノーピーク、新製品ルーフトップテント「フィールドライズ」10月10日に発売決定</news:title></news:news></url>
  </urlset>`;
  const articles = parseSource(xml, 'news-sitemap');
  assert.equal(articles.length, 2);
  assert.equal(articles[0].url, 'https://prtimes.jp/main/html/rd/p/000000107.000154819.html');
  assert.match(articles[1].title, /フィールドライズ/);
});

test('途中で切れたサイトマップを拒否する', () => {
  const truncated = '<?xml version="1.0"?><urlset><url><loc>https://prtimes.jp/main/html/rd/p/1.html</loc>';
  assert.throws(
    () => validateSourceXml(truncated, 'news-sitemap'),
    /XMLが途中で切れています/,
  );
});

test('閉じタグがあっても不正なXMLを拒否する', () => {
  const malformed = '<?xml version="1.0"?><urlset><url></urlset>';
  assert.throws(
    () => validateSourceXml(malformed, 'news-sitemap'),
    /不完全または不正なXML/,
  );
});
