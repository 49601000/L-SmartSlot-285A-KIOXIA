# Specification — スマスロ285A キオクシア

Status: Initial demo implemented; historical close JSON imported (2026-11-01).

## Purpose

キオクシア（285A）を題材にした非公式パロディの個人用ブラウザスロットデモ。実際の投資・株式取引機能はない。

## Runtime and components

- 静的HTML/CSS/JavaScript。エントリポイントは `index.html`。
- `script.js` は既存のサンプル株価配列とゲーム用の乱数抽選を使用。
- 設定1固定のデモ。CREDIT、PAYOUT、AT枚数、TOTAL Gを表示。
- CZ（NAND品薄CHANCE）、AT（SUPER CYCLE RUSH）、SUPER_AT、強制CZ/AT等のデバッグ操作あり。

## Historical daily closing price dataset

- 取得銘柄：`285A.T`、東京証券取引所、JPY、`Asia/Tokyo`。
- ソース：Yahoo Finance、取得ライブラリ `yfinance`。
- 起点：2024-12-18（含む）。実行日の**前日まで**の確定済み取引日が対象。
- `yf.Ticker("285A.T").history(start="2024-12-18", end=<当日JST>, interval="1d", auto_adjust=False, actions=False)` を使用。
- 対象フィールド：`Close`。Yahoo Financeの履歴仕様に基づく**株式分割調整後・配当調整前**の価格。2026-09-29の1:3分割前も現在の株数基準に調整される。**各当時の非調整実勢終値ではない**。
- JSON保存先：`data/285A_daily_close.json`。1取引日1行、日付昇順。
- JSONの主な項目：`ticker`, `source`, `adjustment`, `start_date`, `last_trading_date`, `record_count`, `fetched_at_utc`, `prices: [{date, close}]`。
- 起点日欠落・空データ・不正な終値・日付重複は処理失敗とし、不完全なファイルで上書きしない。

## Updating data

- `scripts/fetch_285a_closes.py` が取得・JSON生成を実行。
- `.github/workflows/fetch-285a-closes.yml` は初回追加時のpushおよび手動 `workflow_dispatch` で実行。
- 成功時はGitHub Actionsが生成JSONを `main` へcommitする。日次定期更新は未設定。
- ブラウザゲームへのJSON読み込みは**未実装**。現行ゲーム中の株価表示と履歴JSONは別。

## Acceptance / verification

- 2026-11-01、GitHub Actionsの初回実行が成功し、2024-12-18から2026-10-30まで453件のJSONを保存。
- GitHub上のJSONについて日付昇順、日付重複なし、終値が有限数値であることを確認。
- デモゲームのブラウザ操作とJSONの画面連携は今回の取得作業の対象外。
