"""Normalize Yahoo! Finance (285A) board posts into per-trading-day JSON files.

Input : a directory of "clean" board JSON files in any of the historical
        schemas produced during manual cleanup:
          A) {"posts": [{"number": int, "date": "YYYY-MM-DD", "time": "HH:MM",
                         "text": str}, ...], ...}
          B) {"posts": [{"id": "1234", "datetime": "YYYY-MM-DD HH:MM",
                         "text": str}, ...], ...}
          C) [{"number": int, "datetime": "YYYY-MM-DD HH:MM",
               "message": str}, ...]
        Extra top-level keys (e.g. an injected "retrieved_at" added by a
        download tool) are ignored; post text is never altered.

Output: <out_dir>/<trading-date>.json  {"date": ..., "posts": [...]}
        <out_dir>/index.json           manifest for the game
        Each normalized post: {"number": int, "date": "YYYY-MM-DD",
                               "time": "HH:MM", "text": str, "thread": str}
        "thread" is the source file stem and is part of the post's identity:
        numbers are NOT unique across files, so the key is (thread, number).

Day assignment (the game advances one trading day per game):
  - a post dated on a trading day belongs to that day;
  - a post dated on a non-trading day (weekend/holiday) is carried forward
    to the next trading day;
  - a post dated before the first trading day (pre-IPO thread) is shown on
    the first trading day;
  - a post dated after the last trading day is dropped and reported.

Deduplication is by (thread, number) only. Identical texts posted under
different numbers are distinct posts and are kept.

Usage:
  python3 scripts/normalize_board_data.py \
      --input-dir /path/to/board_jsons \
      --prices data/285A_daily_close.json \
      --out-dir data/board
"""
from __future__ import annotations

import argparse
import bisect
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def parse_post(raw: dict, thread: str) -> dict:
    number = raw.get("number", raw.get("id"))
    if number is None:
        raise ValueError(f"post without number/id in {thread}: {raw!r:.120}")
    if raw.get("date"):
        date = raw["date"]
        time = raw.get("time", "")
    elif raw.get("datetime"):
        date, _, time = raw["datetime"].partition(" ")
    else:
        raise ValueError(f"post without date/datetime in {thread}: {raw!r:.120}")
    text = raw.get("text", raw.get("message"))
    if text is None:
        raise ValueError(f"post without text/message in {thread}: {raw!r:.120}")
    return {
        "number": int(number),
        "date": date,
        "time": time,
        "text": text,
        "thread": thread,
    }


def load_posts(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    raw_posts = data["posts"] if isinstance(data, dict) else data
    return [parse_post(p, path.stem) for p in raw_posts]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", required=True)
    ap.add_argument("--prices", required=True, help="285A_daily_close.json")
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    prices = json.loads(Path(args.prices).read_text(encoding="utf-8"))
    trading_days = [row["date"] for row in prices["prices"]]
    trading_set = set(trading_days)

    def effective_day(date: str) -> str | None:
        if date in trading_set:
            return date
        i = bisect.bisect_left(trading_days, date)
        return trading_days[i] if i < len(trading_days) else None

    in_dir = Path(args.input_dir)
    files = sorted(in_dir.glob("*.json"))
    if not files:
        print(f"no JSON files in {in_dir}", file=sys.stderr)
        return 1

    seen: set[tuple[str, int]] = set()
    by_day: dict[str, list[dict]] = defaultdict(list)
    source_stats: list[dict] = []
    dropped_after_end = 0

    for f in files:
        posts = load_posts(f)
        dup = 0
        dates = Counter()
        for p in posts:
            key = (p["thread"], p["number"])
            if key in seen:
                dup += 1
                continue
            seen.add(key)
            dates[p["date"]] += 1
            day = effective_day(p["date"])
            if day is None:
                dropped_after_end += 1
                continue
            by_day[day].append(p)
        source_stats.append(
            {"file": f.name, "posts": len(posts), "duplicates_skipped": dup,
             "source_dates": dict(sorted(dates.items()))}
        )
        print(f"{f.name}: {len(posts)} posts, {dup} duplicates skipped")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.json"):
        old.unlink()

    manifest_days = {}
    total = 0
    for day in sorted(by_day):
        posts = sorted(by_day[day], key=lambda p: (p["date"], p["time"], p["thread"], p["number"]))
        total += len(posts)
        payload = {"date": day, "count": len(posts), "posts": posts}
        (out_dir / f"{day}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        manifest_days[day] = {
            "file": f"{day}.json",
            "count": len(posts),
            "source_dates": dict(sorted(Counter(p["date"] for p in posts).items())),
            "threads": sorted({p["thread"] for p in posts}),
        }
        print(f"{day}: {len(posts)} posts -> {day}.json")

    manifest = {
        "ticker": "285A.T",
        "generated_from": [s["file"] for s in source_stats],
        "total_posts": total,
        "days": manifest_days,
        "notes": (
            "Posts are grouped by the trading day on which the game shows them. "
            "Weekend/holiday posts are carried to the next trading day and "
            "pre-IPO posts to the first trading day; each post keeps its real "
            "date/time. Coverage is partial: only the source threads' date "
            "ranges and time windows are included."
        ),
    }
    (out_dir / "index.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(f"TOTAL: {total} posts in {len(manifest_days)} trading days "
          f"({dropped_after_end} dropped after last trading day)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
