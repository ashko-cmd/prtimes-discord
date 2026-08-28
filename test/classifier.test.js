import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTitle } from '../src/classifier.js';

const cases = [
  ['KUNDAL、ダメージケアラインの新製品を8月下旬発よりPLAZAにて先行発売！', '新商品・リニューアル', ['新製品', '発売']],
  ['スノーピーク、新製品ルーフトップテント「フィールドライズ」10月10日に発売決定', '新商品・リニューアル', ['新製品', '発売', '発売決定']],
];

for (const [title, expectedCategory, expectedKeywords] of cases) {
  test(`指定記事を判定: ${title}`, () => {
    const result = classifyTitle(title);
    assert.equal(result?.name, expectedCategory);
    for (const keyword of expectedKeywords) assert.ok(result.matchedKeywords.includes(keyword));
  });
}

test('該当しないタイトルはnull', () => {
  assert.equal(classifyTitle('企業の人事異動に関するお知らせ'), null);
});

test('再発売を通常の発売より優先する', () => {
  assert.equal(classifyTitle('人気商品を再発売します')?.name, '再販・販売再開');
});

for (const keyword of ['限定販売', '期間限定', '限定発売', '先行販売']) {
  test(`追加キーワード「${keyword}」を新商品・リニューアルと判定する`, () => {
    const result = classifyTitle(`注目のアイテムを${keyword}します`);
    assert.equal(result?.name, '新商品・リニューアル');
    assert.ok(result.matchedKeywords.includes(keyword));
  });
}
