# PR TIMES 商品情報 Discord モニター

PR TIMESの新着タイトルから商品発売・再販・販売終了関連の語を検出し、該当記事だけをDiscord Webhookへ通知します。Windows / Node.js 20以上に対応しています。

## 取得方式と注意事項

- 主取得元: `https://prtimes.jp/sitemap-news.xml`（robots.txtから案内されるGoogle Newsサイトマップ。当日分のURL、タイトル、公開日時を収録）
- 補助取得元: `https://prtimes.jp/index.rdf`
- 記事本文や新着HTMLページはスクレイピングしません。
- 既定10分間隔（10分未満には設定不可）で、ETag / Last-Modifiedによる条件付きGETを使います。
- gzip圧縮・chunked転送をNode.jsで展開後、UTF-8、XML閉じタグ、XML構文を検証します。不完全なレスポンスは2秒・5秒の間隔で再試行し、全試行失敗時は `data/last-good-*.xml` の直近正常データだけを使用します。
- 2026-08-28確認時のrobots.txtではサイトマップが明示され、新着記事URLは拒否対象ではありません。一方、PR TIMES基本規約第15条には「当社の許可なく行われる…営利を目的とした利用またはその準備」を禁じる条項があります。本ツールをAmazon物販等の営利目的で運用する前に、PR TIMESへ利用可否を確認し、許諾を得てください。robots.txtの許可だけで利用規約上の許諾を意味するものではありません。

参考: [robots.txt](https://prtimes.jp/robots.txt) / [利用規約](https://prtimes.jp/main/html/kiyaku)

## セットアップ

PowerShellでこのフォルダを開き、次を実行します。

```powershell
npm install
Copy-Item .env.example .env
notepad .env
```

`.env` の `DISCORD_WEBHOOK_URL` を実際のWebhook URLへ置き換えてください。

## 起動

継続監視:

```powershell
npm start
```

1回だけ実行:

```powershell
npm run once
```

Discordへ送信せず取得・判定ログだけ確認:

```powershell
npm run dry-run
```

テスト:

```powershell
npm test
```

現在の記事をDiscordへ送らず既読登録:

```powershell
npm run seed
```

初回は既定で、その時点の全記事を `data/notified.json` に既読登録して通知しません。以後、新着だけを通知します。初回から通知したい場合は `.env` の `SKIP_EXISTING_ON_FIRST_RUN=false` にしてください。通知成功後にだけURLを保存するため、Discord障害時は次回に再試行します。

## 判定カテゴリー

- 新商品・リニューアル: 新商品、新製品、新発売、リニューアル、発売、新登場、発売開始、販売開始、発売決定、数量限定、限定販売、期間限定、限定発売、先行販売
- 再販・販売再開: 再販、再販売、再発売、販売再開
- 販売停止・販売終了・廃番: 販売終了、販売停止、販売中止、生産終了、製造終了、廃番、廃止、終売

複数カテゴリーの語がある場合は、上記の先頭カテゴリーを採用し、一致した語を通知内に併記します。

## GitHub Actionsでの常時監視

`.github/workflows/monitor.yml` は10分ごと、または手動実行でモニターを1回起動します。GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions` で、Repository Secret `DISCORD_WEBHOOK_URL` にDiscord Webhook URLを設定してください。Webhook URLをファイルへ保存する必要はありません。

通知済みURLは公開コードとは別の `state` ブランチに `notified.json` だけを保存します。各実行はstateを復元してから監視し、通知成功のたびに更新された履歴を実行後に保存します。Actionsの `concurrency` により同時実行を直列化し、さらに保存直前にもstateが実行中に変更されていないことを確認します。競合時は上書きせず失敗するため、履歴を壊しません。

PCで蓄積した `data/notified.json` を初回クラウド実行前に引き継ぐ場合は、先に次を実行します。このスクリプトは履歴の内容を表示せず、`origin` がこのプロジェクトのGitHub URLであることと、既存のstateブランチがないことを確認してから、履歴だけをstateブランチへpushします。まず `-WhatIf` で対象を確認できます。

```powershell
.\scripts\initialize-state-branch.ps1 -WhatIf
.\scripts\initialize-state-branch.ps1
```

stateを事前作成しなかった場合、最初のActions実行は現在取得できる記事を通知せず既読登録し、過去記事の大量通知を防ぎます。2回目以降は新着だけを通知します。

失敗理由はActionsの各ステップに時刻付きで記録されます。途中まで通知に成功した後で失敗した場合も、その時点の通知履歴を先にstateへ保存してからジョブを失敗扱いにするため、次回の重複通知を抑えます。
