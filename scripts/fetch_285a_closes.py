"""Fetch Kioxia (285A.T) daily closing prices with yfinance.

Yahoo's historical Close is stock-split-adjusted, but not dividend-adjusted
when auto_adjust=False. Run after Japanese market close, or on a non-trading day.
"""
from __future__ import annotations

import json
import math
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import yfinance as yf

TICKER = "285A.T"
START_DATE = date(2024, 12, 18)
OUTPUT_PATH = Path("data/285A_daily_close.json")


def main() -> None:
    # 'end' is exclusive. Exclude today so unfinished sessions cannot enter.
    today_jst = datetime.now(ZoneInfo("Asia/Tokyo")).date()
    prices = yf.Ticker(TICKER).history(
        start=START_DATE.isoformat(),
        end=today_jst.isoformat(),
        interval="1d",
        auto_adjust=False,
        actions=False,
        timeout=30,
    )

    if prices.empty or "Close" not in prices.columns:
        raise RuntimeError(f"No yfinance daily Close data returned for {TICKER}")

    records = []
    for timestamp, bar in prices.sort_index().iterrows():
        trading_date = timestamp.date()
        close = float(bar["Close"])
        if trading_date < START_DATE or trading_date >= today_jst:
            continue
        if not math.isfinite(close) or close <= 0:
            raise ValueError(f"Invalid Close for {trading_date}: {close}")
        records.append({"date": trading_date.isoformat(), "close": round(close, 2)})

    if not records or records[0]["date"] != START_DATE.isoformat():
        raise RuntimeError(
            "Missing IPO starting date 2024-12-18; refusing to save partial history"
        )
    if len({row["date"] for row in records}) != len(records):
        raise RuntimeError("Duplicate trading dates detected")

    output = {
        "ticker": TICKER,
        "name": "Kioxia Holdings Corporation",
        "currency": "JPY",
        "market_timezone": "Asia/Tokyo",
        "source": "Yahoo Finance via yfinance",
        "interval": "1d",
        "field": "Close",
        "adjustment": "split-adjusted, not dividend-adjusted (auto_adjust=False)",
        "start_date": START_DATE.isoformat(),
        "last_trading_date": records[-1]["date"],
        "record_count": len(records),
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "prices": records,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Saved {len(records)} daily closing prices: "
        f"{records[0]['date']} to {records[-1]['date']} -> {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
