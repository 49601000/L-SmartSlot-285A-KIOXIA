# Roadmap and Progress

Last updated: 2026-11-14
Current status: Static slot demo; historical close JSON is now linked to the game screen (1 game = 1 trading day).

## Completed

- `index.html`, `style.css`, `script.js` を `main` に登録（非公式スロットデモ）。
- `scripts/fetch_285a_closes.py` とGitHub Actionsワークフローを追加。
- 2026-11-01: GitHub Actions初回実行成功。 `data/285A_daily_close.json` に2024-12-18～2026-10-30の453取引日分を保存。
- 終値の分割調整基準・取得範囲・現時点の未連携状態を仕様に記録。
- 2026-11-01: `docs/EVENT_CANDIDATES.md` に17件の史実・報道イベント候補を出典・検証状態付きで整理。ゲーム連携は未実装。
- 2026-11-14: 株価JSON連携を実装。起動時に終値JSONを読み込み、上場日から1ゲーム=1営業日で進行。前日比・最高／最安終値・営業日進捗を表示。fetch不可の環境ではサンプル表示にフォールバック。

## Current position

- GitHub上に価格履歴JSONが存在し、手動で再取得・更新可能。ゲーム画面はそのJSONを表示する。
- 定期取得スケジュールは未設定。
- イベント台帳（EVT-001〜017）と掲示板素材はゲーム未連携。

## Possible next task (not yet approved)

- `docs/EVENT_CANDIDATES.md` の要確認事項を解消し、採用イベントと演出内容を決める。
- 掲示板素材の日付同期表示（株価の取引日に合わせて当時の投稿を表示する方式）の設計。
- 株価の大幅変動日に連動した背景・演出の強化。
