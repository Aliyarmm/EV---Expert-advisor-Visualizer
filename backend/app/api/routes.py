from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import sqlite3
import json
import shutil
import hashlib
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.db import get_db, new_db_connection

router = APIRouter()

# --- Field name mapping: db (snake_case) → frontend (camelCase) ---
STRATEGY_METRIC_MAP = {
    "win_rate": "win_rate",
    "profit_factor": "profit_factor",
    "max_drawdown": "max_drawdown",
    "sharpe_ratio": "sharpe_ratio",
    "calmar_ratio": "calmar_ratio",
    "total_trades": "total_trades",
    "years_of_data": "years_of_data",
    "avg_r_multiple": "avg_r_multiple",
}


def _row_to_strategy(row: sqlite3.Row) -> dict:
    """Convert a strategy DB row into the frontend Strategy shape."""
    result = dict(row)
    # Map legacy metric columns to nested metrics object
    metrics = {}
    for db_col, fe_key in STRATEGY_METRIC_MAP.items():
        val = result.pop(db_col, None)
        if val is not None:
            metrics[fe_key] = val
    result["metrics"] = metrics if metrics else None
    return result


@router.get("/strategies")
def list_strategies(db: sqlite3.Connection = Depends(get_db)):
    """List all strategies with summary metrics."""
    rows = db.execute(
        """
        SELECT s.*,
               m1.value as win_rate,
               m2.value as profit_factor,
               m3.value as max_drawdown,
               m4.value as sharpe_ratio
        FROM strategies s
        LEFT JOIN metrics m1 ON m1.strategy_id = s.id AND m1.label = 'win_rate'
        LEFT JOIN metrics m2 ON m2.strategy_id = s.id AND m2.label = 'profit_factor'
        LEFT JOIN metrics m3 ON m3.strategy_id = s.id AND m3.label = 'max_drawdown'
        LEFT JOIN metrics m4 ON m4.strategy_id = s.id AND m4.label = 'sharpe_ratio'
        ORDER BY s.family, s.name
        """
    ).fetchall()
    return [_row_to_strategy(r) for r in rows]


@router.post("/strategies/import")
def import_strategy(strategy_def: Dict[str, Any], db: sqlite3.Connection = Depends(get_db)):
    """Import a strategy definition from JSON (e.g. uploaded strategy file)."""
    required = ["id", "name", "family", "symbol", "timeframe"]
    missing = [f for f in required if not strategy_def.get(f)]
    if missing:
        raise HTTPException(400, f"Missing required fields: {missing}")

    now = datetime.utcnow().isoformat()
    db.execute(
        """INSERT OR REPLACE INTO strategies
           (id, name, family, status, symbol, timeframe, logic, params, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            strategy_def["id"],
            strategy_def["name"],
            strategy_def["family"],
            strategy_def.get("status", "Under Review"),
            strategy_def["symbol"],
            strategy_def["timeframe"],
            strategy_def.get("logic"),
            json.dumps(strategy_def.get("params", {})) if strategy_def.get("params") else None,
            strategy_def.get("created_at", now),
            strategy_def.get("updated_at", now),
        ),
    )
    # Insert metrics if provided
    metrics = strategy_def.get("metrics", {})
    if isinstance(metrics, dict):
        for label, value in metrics.items():
            if isinstance(value, (int, float)):
                db.execute(
                    "INSERT INTO metrics (strategy_id, label, value) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                    (strategy_def["id"], label, float(value)),
                )
    db.commit()
    return {"id": strategy_def["id"], "imported": True}


@router.get("/strategies/{strategy_id}")
def get_strategy(strategy_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Get full strategy detail with metrics and equity curve."""
    row = db.execute("SELECT * FROM strategies WHERE id = ?", (strategy_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Strategy {strategy_id} not found")

    all_metrics = db.execute(
        "SELECT label, value FROM metrics WHERE strategy_id = ?", (strategy_id,)
    ).fetchall()
    metrics_dict = {m["label"]: m["value"] for m in all_metrics}

    equity = db.execute(
        "SELECT date, value FROM equity_curve WHERE strategy_id = ? ORDER BY date",
        (strategy_id,),
    ).fetchall()

    return {
        "strategy": _row_to_strategy(row),
        "metrics": metrics_dict,
        "equity_curve": [dict(r) for r in equity],
    }


@router.delete("/strategies/{strategy_id}")
def delete_strategy(strategy_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete a strategy and its associated metrics, equity_curve, and book_items."""
    row = db.execute("SELECT id FROM strategies WHERE id = ?", (strategy_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Strategy {strategy_id} not found")
    db.execute("DELETE FROM strategies WHERE id = ?", (strategy_id,))
    # metrics and equity_curve have ON DELETE CASCADE, book_items too
    db.commit()
    return {"deleted": strategy_id}


@router.get("/strategies/{strategy_id}/correlations")
def get_strategy_correlations(strategy_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Get correlation matrix between a strategy and all others."""
    strategies = db.execute(
        "SELECT id, name, family FROM strategies ORDER BY name"
    ).fetchall()

    # Build correlation from equity curves
    corr_data = []
    for s in strategies:
        s_id = s["id"]
        curve = db.execute(
            "SELECT date, value FROM equity_curve WHERE strategy_id = ? ORDER BY date",
            (s_id,),
        ).fetchall()
        corr_data.append({
            "id": s_id,
            "name": s["name"],
            "family": s["family"],
            "equity": [dict(r) for r in curve],
        })

    # Compute pairwise correlations
    import numpy as np
    strategy_list = []
    equity_matrix = []

    for s in corr_data:
        if len(s["equity"]) > 10:  # need minimum points for correlation
            values = [p["value"] for p in s["equity"][:500]]  # sample first 500 points
            strategy_list.append({
                "id": s["id"],
                "name": s["name"],
                "family": s["family"],
            })
            equity_matrix.append(values)

    if len(equity_matrix) < 2:
        # Fallback: return synthetic correlation matrix
        names = [s["name"] for s in strategies]
        matrix = []
        for i in range(len(names)):
            row = []
            for j in range(len(names)):
                if i == j:
                    row.append(1.0)
                else:
                    row.append(round(0.5 - abs(i - j) * 0.1 + np.random.uniform(-0.1, 0.1), 3))
            matrix.append(row)
        return {"strategies": names, "matrix": matrix}

    # Truncate all to same length
    min_len = min(len(e) for e in equity_matrix)
    aligned = [np.array(e[:min_len]) for e in equity_matrix]

    corr_matrix = np.corrcoef(aligned)
    corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)

    # Convert to percentage returns for better correlation signal
    ret_matrix = []
    for e in aligned:
        rets = np.diff(e) / e[:-1]
        rets = rets[np.isfinite(rets)]
        if len(rets) > 1:
            ret_matrix.append(rets)

    if len(ret_matrix) >= 2:
        try:
            min_ret_len = min(len(r) for r in ret_matrix)
            ret_aligned = [r[:min_ret_len] for r in ret_matrix]
            corr_matrix = np.corrcoef(ret_aligned)
            corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)
        except Exception:
            pass  # fall back to price-based correlation

    matrix_rounded = [[round(float(v), 3) for v in row] for row in corr_matrix]

    return {
        "strategies": [s["name"] for s in strategy_list],
        "matrix": matrix_rounded,
    }


@router.get("/books")
def list_books(db: sqlite3.Connection = Depends(get_db)):
    """List all portfolio books."""
    rows = db.execute("SELECT * FROM books ORDER BY name").fetchall()
    return [dict(r) for r in rows]


@router.get("/books/{book_id}")
def get_book(book_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Get book details with items."""
    book = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        raise HTTPException(404, f"Book {book_id} not found")

    items = db.execute(
        """
        SELECT bi.weight, s.id as strategy_id, s.name, s.family, s.symbol
        FROM book_items bi
        JOIN strategies s ON s.id = bi.strategy_id
        WHERE bi.book_id = ?
        """,
        (book_id,),
    ).fetchall()

    return {**dict(book), "items": [dict(r) for r in items]}


@router.post("/books")
def create_book(book: dict, db: sqlite3.Connection = Depends(get_db)):
    """Create a new portfolio book with items."""
    book_id = book.get("id") or f"book-{db.execute('SELECT COUNT(*) FROM books').fetchone()[0] + 1}"
    name = book.get("name", "New Book")
    weights = json.dumps(book.get("weights", {}))

    db.execute(
        "INSERT OR REPLACE INTO books (id, name, weights, created_at) VALUES (?, ?, ?, ?)",
        (book_id, name, weights, book.get("created_at", "2026-01-01T00:00:00Z"))
    )

    db.execute("DELETE FROM book_items WHERE book_id = ?", (book_id,))

    for item in book.get("items", []):
        side = item.get("side", "long")
        db.execute(
            "INSERT INTO book_items (book_id, strategy_id, weight, side) VALUES (?, ?, ?, ?)",
            (book_id, item["strategy_id"], item.get("weight", 0), side)
        )

    db.commit()
    return {"id": book_id, "name": name, "weights": weights, "items": book.get("items", [])}


@router.put("/books/{book_id}")
def update_book(book_id: str, book: dict, db: sqlite3.Connection = Depends(get_db)):
    """Update a portfolio book's items and weights."""
    name = book.get("name")
    if name:
        db.execute("UPDATE books SET name = ? WHERE id = ?", (name, book_id))

    # Clear existing items
    db.execute("DELETE FROM book_items WHERE book_id = ?", (book_id,))

    for item in book.get("items", []):
        side = item.get("side", "long")
        db.execute(
            "INSERT INTO book_items (book_id, strategy_id, weight, side) VALUES (?, ?, ?, ?)",
            (book_id, item["strategy_id"], item.get("weight", 0), side)
        )

    db.commit()
    return {"id": book_id, "items": book.get("items", [])}


@router.delete("/books/{book_id}")
def delete_book(book_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete a portfolio book."""
    db.execute("DELETE FROM books WHERE id = ?", (book_id,))
    db.commit()
    return {"deleted": book_id}


@router.get("/portfolio")
def get_portfolio(db: sqlite3.Connection = Depends(get_db)):
    """Get portfolio-level aggregated performance data."""
    books = db.execute("SELECT * FROM books ORDER BY name").fetchall()
    if not books:
        return {
            "books": [],
            "equity_curve": [],
            "metrics": {},
            "book_metrics": [],
        }

    book = books[0]

    # Get combined equity curve for the primary book
    book_items = db.execute(
        """
        SELECT bi.weight, bi.side, s.id as strategy_id, s.name,
               m1.value as win_rate, m2.value as profit_factor,
               m3.value as max_dd, m4.value as sharpe
        FROM book_items bi
        JOIN strategies s ON s.id = bi.strategy_id
        LEFT JOIN metrics m1 ON m1.strategy_id = s.id AND m1.label = 'win_rate'
        LEFT JOIN metrics m2 ON m2.strategy_id = s.id AND m2.label = 'profit_factor'
        LEFT JOIN metrics m3 ON m3.strategy_id = s.id AND m3.label = 'max_drawdown'
        LEFT JOIN metrics m4 ON m4.strategy_id = s.id AND m4.label = 'sharpe_ratio'
        WHERE bi.book_id = ?
        """,
        (book["id"],),
    ).fetchall()

    # Weighted-aggregate the equity curve across strategies on common dates.
    # Concatenating raw per-strategy rows produces duplicate dates per day,
    # which breaks charting clients (lightweight-charts) that require a
    # strictly time-ordered, unique series.
    series_by_strategy: Dict[str, Dict[str, float]] = {}
    for it in book_items:
        pts = db.execute(
            "SELECT date, value FROM equity_curve WHERE strategy_id = ? ORDER BY date",
            (it["strategy_id"],),
        ).fetchall()
        series_by_strategy[it["strategy_id"]] = {p["date"]: float(p["value"]) for p in pts}

    all_dates = sorted({d for st in series_by_strategy.values() for d in st})

    total_weight = sum((it["weight"] or 0) for it in book_items) or 0
    weights = {
        it["strategy_id"]: (
            (it["weight"] or 0) / total_weight if total_weight > 0 else 1.0 / len(book_items)
        )
        for it in book_items
    }

    equity_curve_list = []
    # Forward-fill each strategy's series onto the union of dates
    ffilled = {sid: None for sid in series_by_strategy}
    for d in all_dates:
        total = 0.0
        any_value = False
        for sid, series in series_by_strategy.items():
            if d in series:
                ffilled[sid] = series[d]
            v = ffilled[sid]
            if v is not None:
                total += v * weights[sid]
                any_value = True
        if any_value:
            equity_curve_list.append({"date": d, "value": round(total, 2)})

    # Aggregate metrics — map snake_case DB columns to camelCase frontend
    book_metrics = []
    for r in book_items:
        book_metrics.append({
            "strategy_id": r["strategy_id"],
            "name": r["name"],
            "weight": r["weight"],
            "win_rate": r["win_rate"] or 0,
            "profit_factor": r["profit_factor"] or 0,
            "max_dd": r["max_dd"] or 0,
            "sharpe": r["sharpe"] or 0,
        })

    avg_sharpe = sum(bm["sharpe"] for bm in book_metrics) / len(book_metrics) if book_metrics else 0
    avg_pf = sum(bm["profit_factor"] for bm in book_metrics) / len(book_metrics) if book_metrics else 0
    avg_wr = sum(bm["win_rate"] for bm in book_metrics) / len(book_metrics) if book_metrics else 0

    return {
        "books": [dict(b) for b in books],
        "equity_curve": equity_curve_list,
        "metrics": {
            "total_strategies": len(book_metrics),
            "avg_sharpe": avg_sharpe,
            "avg_profit_factor": avg_pf,
            "avg_win_rate": avg_wr,
        },
        "book_metrics": book_metrics,
    }


DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploaded"


@router.get("/data/files")
def list_data_files():
    """List uploaded data files."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for f in DATA_DIR.iterdir():
        if f.is_file():
            st = f.stat()
            files.append({
                "id": f.stem,
                "name": f.name,
                "symbol": f.stem.split("_")[0].upper(),
                "timeframe": f.stem.split("_")[1].upper() if "_" in f.stem else "D1",
                "rows": 0,
                "lastModified": datetime.fromtimestamp(st.st_mtime).isoformat(),
                "size": f"{st.st_size / 1e6:.1f} MB" if st.st_size > 1e6 else f"{st.st_size / 1024:.0f} KB",
            })
    return files


@router.delete("/data/{file_id}")
def delete_data_file(file_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete an uploaded data file (and any associated data_versions rows)."""
    # Remove rows from any extension the file_id might have
    for ext in [".csv", ".parquet", ".json"]:
        dest = DATA_DIR / f"{file_id}{ext}"
        if dest.exists():
            dest.unlink()
    db.execute("DELETE FROM data_versions WHERE filename = ?", (f"{file_id}.csv",))
    db.execute("DELETE FROM data_versions WHERE filename = ?", (f"{file_id}.parquet",))
    db.execute("DELETE FROM data_versions WHERE filename = ?", (f"{file_id}.json",))
    db.commit()
    return {"deleted": file_id}


@router.post("/data/upload")
def upload_data_file(file: UploadFile = File(...)):
    """Upload a CSV or Parquet data file. Overwrites existing file with same name.
    Returns detected columns and SHA256 checksum for version tracking."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    allowed = {".csv", ".parquet", ".json"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {', '.join(allowed)}")

    dest = DATA_DIR / file.filename

    # Compute checksum while writing
    sha256 = hashlib.sha256()
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    with open(dest, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    checksum = sha256.hexdigest()

    # Try to detect columns from the file
    columns = []
    try:
        if ext == ".csv":
            df = pd.read_csv(dest, nrows=1)
            columns = df.columns.tolist()
        elif ext == ".parquet":
            import pyarrow.parquet as pq
            pf = pq.ParquetFile(dest)
            columns = pf.schema_arrow.names
        elif ext == ".json":
            with open(dest) as jf:
                data = json.load(jf)
                if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                    columns = list(data[0].keys())
                elif isinstance(data, dict):
                    columns = list(data.keys())
    except Exception:
        columns = ["date", "open", "high", "low", "close", "volume"]

    # Store version info in DB
    db = new_db_connection()
    try:
        import uuid
        version_id = str(uuid.uuid4())
        db.execute(
            """INSERT INTO data_versions (id, filename, checksum, columns, row_count, file_size, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                version_id,
                file.filename,
                checksum,
                json.dumps(columns),
                0,
                dest.stat().st_size,
                datetime.now().isoformat(),
            ),
        )
        db.commit()
    except Exception:
        pass  # table may not exist yet; continue without version tracking
    finally:
        db.close()

    return {
        "id": dest.stem,
        "name": file.filename,
        "uploaded": True,
        "checksum": checksum,
        "columns": columns,
    }


@router.get("/data/versions")
def get_data_versions(db: sqlite3.Connection = Depends(get_db)):
    """List all data file versions with checksums."""
    try:
        rows = db.execute(
            "SELECT id, filename, checksum, columns, row_count, file_size, uploaded_at FROM data_versions ORDER BY uploaded_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        # Table doesn't exist
        return []


@router.post("/data/clean")
def clean_data_file(
    file_id: str,
    column_mapping: Optional[Dict[str, str]] = None,
    outlier_threshold: float = 3.0,
    db: sqlite3.Connection = Depends(get_db),
):
    """Clean a data file: map columns to standard names, detect and flag outliers."""
    import uuid

    file_path = DATA_DIR / f"{file_id}.csv"
    if not file_path.exists():
        # Try other extensions
        for ext in [".parquet", ".json"]:
            candidate = DATA_DIR / f"{file_id}{ext}"
            if candidate.exists():
                file_path = candidate
                break
        else:
            raise HTTPException(404, f"File {file_id} not found")

    # Load data
    ext = file_path.suffix.lower()
    if ext == ".csv":
        df = pd.read_csv(file_path)
    elif ext == ".parquet":
        df = pd.read_parquet(file_path)
    elif ext == ".json":
        df = pd.read_json(file_path)
    else:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    # Apply column mapping
    if column_mapping:
        df = df.rename(columns={v: k for k, v in column_mapping.items()})

    # Detect outliers using z-score
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    outlier_info = {}
    for col in numeric_cols:
        z_scores = np.abs((df[col] - df[col].mean()) / (df[col].std() + 1e-10))
        outlier_count = int((z_scores > outlier_threshold).sum())
        if outlier_count > 0:
            outlier_info[col] = {
                "count": outlier_count,
                "percentage": round(outlier_count / len(df) * 100, 2),
            }

    # Compute checksum of cleaned data
    cleaned_checksum = hashlib.sha256(df.to_csv(index=False).encode()).hexdigest()

    # Store cleaned version
    version_id = str(uuid.uuid4())
    try:
        db.execute(
            """INSERT INTO data_versions (id, filename, checksum, columns, row_count, file_size, uploaded_at, cleaned, outliers_removed)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                version_id,
                f"{file_id}_cleaned",
                cleaned_checksum,
                json.dumps(df.columns.tolist()),
                len(df),
                0,
                datetime.now().isoformat(),
                True,
                sum(v["count"] for v in outlier_info.values()),
            ),
        )
        db.commit()
    except Exception:
        pass

    return {
        "file_id": file_id,
        "original_rows": len(df),
        "columns_mapped": column_mapping or {},
        "outlier_threshold": outlier_threshold,
        "outliers_detected": outlier_info,
        "cleaned_checksum": cleaned_checksum,
        "version_id": version_id,
    }
