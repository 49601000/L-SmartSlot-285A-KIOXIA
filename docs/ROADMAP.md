# Roadmap and Progress

Last updated: 2026-11-01
Current status: Static slot demo files registered; historical stock close data downloaded.

## Completed

- `index.html`, `style.css`, `script.js` を `main` に登録（非公式スロットデモ）。
- `scripts/fetch_285a_closes.py` とGitHub Actionsワークフローを追加。
- 2026-11-01: GitHub Actions初回実行成功。 `data/285A_daily_close.json` に2024-12-18～2026-10-30の453取引日分を保存。
- 終値の分割調整基準・取得範囲・現時点の未連携状態を仕様に記録。

- 2026-11-01: `docs/EVENT_CANDIDATES.md` に17件の史実・報道イベント候補を出典・検証状態付きで整理。ゲーム連携は未実装。

## Current position

- GitHub上に価格履歴JSONが存在し、手動で再取得・更新可能。
- `script.js` は依然として組み込みデモ株価を使用。価格JSONはゲーム画面に読み込まれない。
- 定期取得スケジュールは未設定。

## Possible next task (not yet approved)

- `docs/EVENT_CANDIDATES.md` の要確認事項を解消し、採用イベントと演出内容を決める。
- ゲーム中の株価演出にJSON履歴を使うか決め、必要になった場合のみ実装。
