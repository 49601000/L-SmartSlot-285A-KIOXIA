# スマスロ285A キオクシア ～偽りの株主～

キオクシア（285A）をモチーフにした**非公式パロディの個人用スロットゲーム**。実在の企業・人物とは無関係です。設定1固定のデモモードです。

## ファイル

- `index.html`：筐体・液晶・リール・ボタンのHTML
- `style.css`：ネオン筐体デザイン
- `script.js`：ゲーム内抽選、リール、CZ、AT、デバッグ操作
- `data/285A_daily_close.json`：285A.Tの日次終値（2024-12-18から、yfinance取得）
- `scripts/fetch_285a_closes.py`：終値JSONの取得・更新スクリプト

## 使い方

`index.html` をブラウザで開くとデモ画面を操作できます。

**株価JSONは現時点でゲーム画面とは未連携**です。既存の `script.js` は組み込みのデモ株価配列を表示します。

## 終値データの更新

GitHubの **Actions → Fetch 285A daily closes → Run workflow** を実行します。初回のJSON作成は2026-11-01に成功済みです。定期自動実行は設定していません。

データはYahoo Financeから `yfinance` で取得した `Close`（株式分割調整後・配当調整前）を使用します。当日途中のデータを混ぜないよう、処理実行日の前日までを対象とします。履歴が取れなければ保存せず失敗します。

開発運用： [AGENTS.md](AGENTS.md) / [仕様](docs/SPECIFICATION.md) / [進捗](docs/ROADMAP.md)
