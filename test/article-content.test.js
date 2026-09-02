import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_EXCERPT_LENGTH, buildClassificationText, extractArticleContent } from '../src/article-content.js';
import { classifyArticle, classifyTitle } from '../src/classifier.js';

function pageWithRelease(release) {
  const data = { props: { pageProps: { release } } };
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

test('カルビー記事をサブタイトルの「期間限定」で通知対象と判定する', () => {
  const title = '紅茶ブーム再来！ひとくちに広がるアールグレイの華やかな香りとミルクティーのまろやかな味わい『フルグラ®ボール アールグレイミルクティー風味』';
  const html = pageWithRelease({
    subtitle: '2026年9月7日（月）から期間限定発売',
    text: '<p>カルビー株式会社は対象商品を全国の店舗で期間限定発売します。</p>',
  });
  const content = extractArticleContent(html);
  const result = classifyArticle({ title, publishedAt: '2026-09-02T14:00:02+09:00', ...content });

  assert.equal(classifyTitle(title), null);
  assert.equal(content.subtitle, '2026年9月7日（月）から期間限定発売');
  assert.equal(result?.name, '新商品・リニューアル');
  assert.ok(result.matchedKeywords.includes('期間限定'));
});

test('本文はHTMLを除去して冒頭600文字だけを判定に使用する', () => {
  const html = pageWithRelease({ subtitle: '', text: `<p>${'あ'.repeat(650)}</p><p>期間限定</p>` });
  const content = extractArticleContent(html);
  assert.equal(content.bodyExcerpt.length, BODY_EXCERPT_LENGTH);
  assert.doesNotMatch(content.bodyExcerpt, /期間限定/);
});

test('本文冒頭にだけあるキーワードも判定できる', () => {
  const content = extractArticleContent(pageWithRelease({
    subtitle: '秋の新しい味わい',
    text: '<p>全国の店舗で期間限定発売します。</p><div>詳細情報</div>',
  }));
  const result = classifyArticle({ title: '季節のフルーツ味が登場', publishedAt: '2026-09-02T14:00:02+09:00', ...content });
  assert.ok(result?.matchedKeywords.includes('期間限定'));
});

const falsePositiveCases = [
  ['否定表現', '集計期間に契約があった保険でも、発売を停止した場合は掲載していません。'],
  ['発売記念イベント', '新端末の国内発売を記念し、取材インタビュー会を開催しました。'],
  ['過去の発売実績', 'SPEEDは1997年に発売された楽曲で大きな支持を得ました。'],
  ['商品と無関係な期間限定', 'ライブ配信後に見逃し配信（期間限定）をご視聴いただけます。'],
  ['商品と無関係なリニューアル', '宇都宮愉快市民事業は2026年9月1日にリニューアルされます。'],
];

for (const [name, bodyExcerpt] of falsePositiveCases) {
  test(`${name}を本文由来の通知対象にしない`, () => {
    assert.equal(classifyArticle({
      title: '取り組みに関するお知らせ',
      subtitle: '',
      bodyExcerpt,
      publishedAt: '2026-09-02T14:00:02+09:00',
    }), null);
  });
}
