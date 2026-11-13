# Specification — スマスロ285A キオクシア

Status: Initial demo implemented; historical close JSON imported (2026-11-01) and linked to the game screen (2026-11-14).

## Purpose

キオクシア（285A）を題材にした非公式パロディの個人用ブラウザスロットデモ。実際の投資・株式取引機能はない。

## Runtime and components

- 静的HTML/CSS/JavaScript。エントリポイントは `index.html`。
- `script.js` はゲーム用の乱数抽選を使用。株価表示は下記の終値JSON連携（読み込めない環境では組み込みサンプル配列にフォールバック）。
- 設定1固定のデモ。CREDIT、PAYOUT、AT枚数、TOTAL Gを表示。
- CZ（NAND品薄CHANCE）、AT（SUPER CYCLE RUSH）、SUPER_AT、強制CZ/AT等のデバッグ操作あり。

## Price display linked to the close JSON (2026-11-14)

- 起動時に `data/285A_daily_close.json` を fetch し、成功したら実データ表示に切り替える。開始位置は上場日（2024-12-18、先頭レコード）。
- **1ゲーム = 1営業日**。レバーごとに次の営業日へ進み、最終営業日の次は上場日へ巻き戻す（デモ仕様。ステージ制を導入する場合は再検討する）。
- 表示項目: 取引日、終値、前日終値、前日比（円・%）、開始日からその日までの最高／最安終値、営業日の進捗（n / 全件数）、下部チッカーの285A価格。
- JSONは終値しか持たないため、始値・高値・安値・出来高は表示しない（ダッシュボードの詳細行は上記の終値由来の項目に置き換えた）。日経平均・SNDKのチッカーは従来どおりダミー表示のまま。
- fetchが失敗する環境（`file://` 直開き等）では、従来の組み込みサンプル株価配列（2025/02/10〜02/14の4件）で表示し、ゲーム自体は動作する。連携を確認するにはHTTP経由（GitHub Pages、またはローカルサーバー）で開くこと。
- リセットボタンは実データ連携時には上場日表示へ戻す。

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
- ブラウザゲームへのJSON読み込みは2026-11-14に実装済み（上記セクション）。

## Acceptance / verification

- 2026-11-01、GitHub Actionsの初回実行が成功し、2024-12-18から2026-10-30まで453件のJSONを保存。
- GitHub上のJSONについて日付昇順、日付重複なし、終値が有限数値であることを確認。
- 2026-11-14、JSON連携を検証: DOMスタブ上で初期表示が上場日（2024/12/18、終値533.67、前日比「上場日」）になること、364ゲーム後に2026-06-22（終値36,233.33、前日比 +33.33／+0.09%、最高終値36,233.33、最安終値506、365/453）とPython側の独立計算が一致すること、fetch失敗時にサンプル表示へフォールバックすることを確認。
