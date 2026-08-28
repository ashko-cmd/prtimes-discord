import { loadConfig } from './config.js';
import { runOnce } from './monitor.js';

const once = process.argv.includes('--once');
const dryRun = process.argv.includes('--dry-run');
const seed = process.argv.includes('--seed');

try {
  const config = loadConfig();
  if (!dryRun && !seed && !config.webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL が未設定です。.env.example を参考に .env を作成してください。');
  }

  let running = false;
  const execute = async () => {
    if (running) return console.warn(`[${new Date().toISOString()}] 前回処理中のためスキップします。`);
    running = true;
    try { await runOnce(config, { dryRun, seed }); }
    catch (error) { console.error(`[${new Date().toISOString()}] 実行エラー`, error.stack ?? error); }
    finally { running = false; }
  };

  await execute();
  if (!once) {
    console.info(`[${new Date().toISOString()}] 監視開始: ${config.intervalMs / 60_000}分間隔`);
    setInterval(execute, config.intervalMs);
  }
} catch (error) {
  console.error(`[${new Date().toISOString()}] 起動エラー: ${error.stack ?? error.message}`);
  process.exitCode = 1;
}
