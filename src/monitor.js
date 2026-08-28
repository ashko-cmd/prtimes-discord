import { classifyTitle } from './classifier.js';
import { mergeArticles, parseSource } from './parser.js';
import { SOURCES } from './config.js';
import { loadHttpCache, loadNotified, loadSnapshot, saveHttpCache, saveNotified, saveSnapshot } from './storage.js';

const log = (level, message, details = '') => {
  const suffix = details ? ` | ${details}` : '';
  console[level](`[${new Date().toISOString()}] ${message}${suffix}`);
};
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchSourceAttempt(source, config, cache) {
  const headers = { 'User-Agent': config.userAgent, Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1' };
  if (cache[source.url]?.etag) headers['If-None-Match'] = cache[source.url].etag;
  if (cache[source.url]?.lastModified) headers['If-Modified-Since'] = cache[source.url].lastModified;

  const response = await fetch(source.url, { headers, signal: AbortSignal.timeout(60_000) });
  if (response.status === 304) {
    log('info', `${source.name}: 更新なし (304)`);
    return [];
  }
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status} ${response.statusText}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (!/(?:application|text)\/(?:[\w.+-]*\+)?xml\b/i.test(contentType)) {
    throw new Error(`${source.name}: 想定外のContent-Typeです (${contentType || 'なし'})。`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let xml;
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${source.name}: UTF-8として復号できません (${bytes.byteLength} bytes): ${error.message}`, { cause: error });
  }

  const articles = parseSource(xml, source.name);
  cache[source.url] = {
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
  await saveSnapshot(source.name, xml);
  log('info', `${source.name}: ${articles.length}件取得`, `${bytes.byteLength} bytes | ${contentType} | Content-Encoding=${response.headers.get('content-encoding') ?? 'identity'}`);
  return articles;
}

async function fetchSource(source, config, cache) {
  const retryDelays = [0, 2_000, 5_000];
  let lastError;
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await sleep(retryDelays[attempt]);
    try {
      return await fetchSourceAttempt(source, config, cache);
    } catch (error) {
      lastError = error;
      log('warn', `${source.name}: 取得/完全性検証に失敗 (${attempt + 1}/${retryDelays.length})`, error.message);
    }
  }

  const snapshot = await loadSnapshot(source.name);
  if (snapshot) {
    try {
      const articles = parseSource(snapshot, source.name);
      log('warn', `${source.name}: 直近の正常な保存データを使用`, `${articles.length}件（次回巡回で再取得します）`);
      return articles;
    } catch (snapshotError) {
      throw new Error(`${lastError.message} 保存データも利用できません: ${snapshotError.message}`, { cause: lastError });
    }
  }
  throw lastError;
}

async function sendDiscord(article, category, webhookUrl, dryRun) {
  if (dryRun) {
    log('info', `[DRY RUN] ${category.name}`, `${article.title} | ${article.url}`);
    return;
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'PR TIMES 商品情報',
      embeds: [{
        title: article.title.slice(0, 256),
        url: article.url,
        color: category.color,
        fields: [
          { name: 'カテゴリー', value: category.name, inline: true },
          { name: '検出キーワード', value: category.matchedKeywords.join('、'), inline: true },
        ],
        timestamp: article.publishedAt && !Number.isNaN(Date.parse(article.publishedAt))
          ? new Date(article.publishedAt).toISOString()
          : undefined,
      }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Discord Webhook: HTTP ${response.status} ${await response.text()}`);
}

export async function runOnce(config, { dryRun = false, seed = false } = {}) {
  const notified = await loadNotified();
  const firstRun = notified.size === 0;
  const cache = firstRun || seed ? {} : await loadHttpCache();
  const groups = [];

  for (const source of SOURCES) {
    try {
      groups.push(await fetchSource(source, config, cache));
    } catch (error) {
      log('error', `${source.name} の取得/解析に失敗`, error.stack ?? error.message);
    }
  }
  if (!dryRun) await saveHttpCache(cache);
  const articles = mergeArticles(groups);
  if (articles.length === 0) {
    log('info', '処理対象の記事はありません。');
    return;
  }

  if (seed) {
    for (const article of articles) notified.add(article.url);
    await saveNotified(notified);
    await saveHttpCache(cache);
    log('info', `通知せず${articles.length}件を既読登録しました。既読URL総数: ${notified.size}件`);
    return;
  }

  if (firstRun && config.skipExisting && !dryRun) {
    for (const article of articles) notified.add(article.url);
    await saveNotified(notified);
    log('info', `初回取得の${articles.length}件を既読登録しました（通知なし）。`);
    return;
  }

  let sent = 0;
  for (const article of articles) {
    if (notified.has(article.url)) continue;
    const category = classifyTitle(article.title);
    if (!category) continue;
    try {
      await sendDiscord(article, category, config.webhookUrl, dryRun);
      sent += 1;
      if (!dryRun) {
        notified.add(article.url);
        await saveNotified(notified);
      }
    } catch (error) {
      log('error', 'Discord通知に失敗（次回再試行します）', `${article.url} | ${error.stack ?? error.message}`);
    }
  }
  log('info', `判定完了: ${articles.length}件中 ${sent}件${dryRun ? '検出' : '通知'}`);
}
