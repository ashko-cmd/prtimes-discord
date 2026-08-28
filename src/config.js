import 'dotenv/config';

export const SOURCES = [
  { name: 'news-sitemap', url: 'https://prtimes.jp/sitemap-news.xml' },
  { name: 'rss', url: 'https://prtimes.jp/index.rdf' },
];

export const CATEGORIES = [
  {
    name: '新商品・リニューアル',
    keywords: ['新商品', '新製品', '新発売', 'リニューアル', '発売', '新登場', '発売開始', '販売開始', '発売決定', '数量限定', '限定販売', '期間限定', '限定発売', '先行販売'],
    color: 0x2ecc71,
  },
  {
    name: '再販・販売再開',
    keywords: ['再販', '再販売', '再発売', '販売再開'],
    color: 0x3498db,
  },
  {
    name: '販売停止・販売終了・廃番',
    keywords: ['販売終了', '販売停止', '販売中止', '生産終了', '製造終了', '廃番', '廃止', '終売'],
    color: 0xe74c3c,
  },
];

export function loadConfig() {
  const minutes = Number.parseInt(process.env.POLL_INTERVAL_MINUTES ?? '10', 10);
  if (!Number.isFinite(minutes) || minutes < 10) {
    throw new Error('POLL_INTERVAL_MINUTES は10以上の整数にしてください。');
  }

  return {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL?.trim() ?? '',
    intervalMs: minutes * 60_000,
    skipExisting: (process.env.SKIP_EXISTING_ON_FIRST_RUN ?? 'true').toLowerCase() === 'true',
    userAgent: process.env.USER_AGENT?.trim() || 'prtimes-discord-monitor/1.0',
  };
}
