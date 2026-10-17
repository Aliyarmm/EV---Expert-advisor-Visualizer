"""
Seed database with sample strategies and precomputed equity curves.
Run: python -m app.seed
"""
import json
from pathlib import Path
import sqlite3
import sys
import os

# Ensure we can import from app package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db import init_db, DB_PATH


def seed():
    init_db()  # ensure tables exist
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row

    # Clear existing non-system data
    for table in ["book_items", "books", "equity_curve", "metrics", "strategies"]:
        db.execute(f"DELETE FROM {table}")
    db.commit()

    strategies_dir = Path(__file__).parent.parent.parent / "data" / "strategies"
    sample_data_dir = Path(__file__).parent.parent.parent / "data" / "sample"

    for strat_file in strategies_dir.glob("*.json"):
        with open(strat_file) as f:
            strat = json.load(f)

        db.execute("""
            INSERT INTO strategies (id, name, family, status, symbol, timeframe, logic, params, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            strat["id"], strat["name"], strat["family"], strat.get("status", "Under Review"),
            strat["symbol"], strat["timeframe"], strat.get("logic"),
            json.dumps(strat.get("params", {})),
            "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"
        ))

        for label, value in strat.get("metrics", {}).items():
            db.execute(
                "INSERT INTO metrics (strategy_id, label, value) VALUES (?, ?, ?)",
                (strat["id"], label, float(value))
            )

        # Generate synthetic equity curve if no sample data exists
        curve_file = sample_data_dir / f"{strat['id']}_equity.json"
        if curve_file.exists():
            with open(curve_file) as f:
                curve = json.load(f)
            for point in curve:
                db.execute(
                    "INSERT INTO equity_curve (strategy_id, date, value) VALUES (?, ?, ?)",
                    (strat["id"], point["date"], point["value"])
                )
        else:
            # Generate synthetic curve from backtest-like returns
            import numpy as np
            n_points = 500
            np.random.seed(hash(strat["id"]) % 2**32)
            returns = np.random.normal(0.0025, 0.02, n_points)
            # Inject some drawdown
            returns[100:120] -= 0.03
            returns[300:310] -= 0.02
            equity = 100000 * np.cumprod(1 + returns)
            for i, val in enumerate(equity):
                # Spread 500 points across multiple months/years
                month = (i // 42) % 12 + 1
                year = 2023 + (i // 500)
                day = (i % 28) + 1
                date = f"{year}-{month:02d}-{day:02d}"
                db.execute(
                    "INSERT INTO equity_curve (strategy_id, date, value) VALUES (?, ?, ?)",
                    (strat["id"], date, float(val))
                )

    # Create sample books
    db.execute("""
        INSERT INTO books (id, name, weights, created_at)
        VALUES (?, ?, ?, ?)
    """, ("book-core-portfolio", "Core Portfolio", '{"strat-gold-breakout-v1": 0.3}', "2026-01-01T00:00:00Z"))

    db.execute("""
        INSERT INTO book_items (book_id, strategy_id, weight)
        VALUES (?, ?, ?)
    """, ("book-core-portfolio", "strat-gold-breakout-v1", 1.0))

    db.commit()
    db.close()
    print("[OK] Seeded database with sample strategies and equity curves.")


if __name__ == "__main__":
    seed()
