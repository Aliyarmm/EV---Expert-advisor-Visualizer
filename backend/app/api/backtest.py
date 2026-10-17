from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any, Literal

from app.services.backtest import VectorizedBacktester, MonteCarloAnalyzer, calculate_metrics
from app.db import new_db_connection

router = APIRouter()


class BacktestRequest(BaseModel):
    strategy_id: str
    symbol: str
    timeframe: str = "D1"
    start_date: str
    end_date: str
    initial_capital: float = 100000.0
    commission: float = 0.001
    slippage: float = 0.0005
    strategy_params: Optional[Dict[str, Any]] = None


class BacktestResult(BaseModel):
    strategy_id: str
    equity_curve: List[Dict[str, Any]]
    metrics: Dict[str, float]
    trades: List[Dict[str, Any]]
    signals: List[Dict[str, Any]]


class SignalConfig(BaseModel):
    type: Literal["sma_crossover", "rsi", "bollinger", "momentum"]
    params: Dict[str, Any]


class BacktestConfig(BaseModel):
    symbol: str = "SPY"
    timeframe: str = "D1"
    start_date: str = "2020-01-01"
    end_date: str = "2024-01-01"
    initial_capital: float = 100000.0
    commission: float = 0.001
    slippage: float = 0.0005
    signal: SignalConfig
    strategy_params: Optional[Dict[str, Any]] = None
    position_sizing: Optional[str] = "fixed"
    max_risk_per_trade: Optional[float] = 2.0


def generate_signal_func(signal_config: SignalConfig):
    """Generate a signal function based on config."""
    stype = signal_config.type
    params = signal_config.params
    window = params.get("window", 20)
    threshold = params.get("threshold", 0.0)

    if stype == "sma_crossover":
        fast = params.get("fast", 20)
        slow = params.get("slow", 50)

        def signal_func(prices: pd.DataFrame) -> pd.Series:
            fast_ma = prices["close"].rolling(fast).mean()
            slow_ma = prices["close"].rolling(slow).mean()
            return (fast_ma > slow_ma).astype(int).diff().fillna(0)

        return signal_func
    elif stype == "rsi":
        period = params.get("period", 14)
        oversold = params.get("oversold", 30)
        overbought = params.get("overbought", 70)

        def signal_func(prices: pd.DataFrame) -> pd.Series:
            delta = prices["close"].diff()
            gain = (delta * (delta > 0)).rolling(period).mean()
            loss = (-delta * (delta < 0)).rolling(period).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            signals = pd.Series(0, index=prices.index)
            signals[rsi < oversold] = 1
            signals[rsi > overbought] = -1
            return signals.diff().fillna(0)

        return signal_func
    elif stype == "bollinger":
        bb_period = params.get("period", 20)
        bb_std = params.get("std_mult", 2.0)

        def signal_func(prices: pd.DataFrame) -> pd.Series:
            rolling_mean = prices["close"].rolling(bb_period).mean()
            rolling_std = prices["close"].rolling(bb_period).std()
            lower = rolling_mean - bb_std * rolling_std
            upper = rolling_mean + bb_std * rolling_std
            signals = pd.Series(0, index=prices.index)
            signals[prices["close"] < lower] = 1
            signals[prices["close"] > upper] = -1
            return signals.diff().fillna(0)

        return signal_func
    elif stype == "momentum":
        lookback = params.get("lookback", 10)

        def signal_func(prices: pd.DataFrame) -> pd.Series:
            momentum = prices["close"].pct_change(lookback)
            signals = (momentum > threshold).astype(int)
            # Cast back to int after diff to avoid float coercion
            signals = signals.diff().fillna(0).astype(int)
            return signals

        return signal_func
    else:
        raise ValueError(f"Unknown signal type: {stype}")


def generate_mock_prices(symbol: str, start: str, end: str) -> pd.DataFrame:
    """Generate synthetic OHLCV data for backtesting.
    In production, this would come from a data source (CSV, Parquet, API)."""
    dates = pd.date_range(start=start, end=end, freq="D")
    np.random.seed(42)  # reproducible

    prices = pd.DataFrame(index=dates)
    base_price = 100.0

    # Simulate mean-reverting price with trend
    returns = np.random.normal(0.0003, 0.015, len(dates))
    prices["close"] = base_price * (1 + pd.Series(returns)).cumprod().values

    # Generate realistic OHLC
    prices["high"] = prices["close"] * (1 + np.random.uniform(0.005, 0.02, len(dates)))
    prices["low"] = prices["close"] * (1 - np.random.uniform(0.005, 0.02, len(dates)))
    prices["open"] = prices["close"].shift(1) * (1 + np.random.normal(0, 0.01, len(dates)))
    prices = prices.ffill()
    prices["volume"] = np.random.randint(10000, 100000, len(dates))

    return prices


@router.post("/run", response_model=BacktestResult)
def run_backtest(config: BacktestConfig):
    """Run a backtest with the given configuration."""
    try:
        prices = generate_mock_prices(config.symbol, config.start_date, config.end_date)
        signal_func = generate_signal_func(config.signal)

        backtester = VectorizedBacktester(
            initial_capital=config.initial_capital,
            commission=config.commission,
            slippage=config.slippage,
            position_sizing=config.position_sizing or "fixed",
            max_risk_per_trade=config.max_risk_per_trade or 2.0,
        )

        result = backtester.run(prices, signal_func)

        # Drop first row (NaN from shift(1)) — equity starts at initial_capital
        equity_clean = result["equity"].dropna()
        if len(equity_clean) == 0:
            equity_clean = pd.Series([config.initial_capital], index=[result["equity"].index[-1]])
        equity_curve = [
            {"date": str(idx.date()), "value": float(val)}
            for idx, val in equity_clean.items()
        ]

        signals = [
            {"date": str(idx.date()), "signal": int(val)}
            for idx, val in result["signals"].items()
            if val != 0
        ]

        trades = []
        position_changes = result["signals"].diff().fillna(0)
        for idx, val in position_changes.items():
            if val != 0:
                trades.append({
                    "date": str(idx.date()),
                    "type": "BUY" if val > 0 else "SELL",
                    "price": float(prices.loc[idx, "close"]),
                    "quantity": abs(float(val)),
                })

        return BacktestResult(
            strategy_id=f"{config.symbol}-{config.signal.type}",
            equity_curve=equity_curve,
            metrics=result["metrics"],
            trades=trades,
            signals=signals,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class MonteCarloStressRequest(BaseModel):
    strategy_id: str = "default"
    equity_curve: List[Dict[str, Any]] = Field(default_factory=list)
    n_simulations: int = 1000
    n_periods: int = 252
    initial_capital: float = 100000.0
    confidence_levels: List[float] = Field(default_factory=lambda: [0.1, 0.25, 0.5, 0.75, 0.9])


@router.post("/monte-carlo-stress")
def monte_carlo_stress_test(request: MonteCarloStressRequest):
    """Run Monte Carlo stress testing on equity curve returns."""
    np.random.seed(42)

    if request.equity_curve and len(request.equity_curve) > 1:
        values = [e["value"] for e in request.equity_curve]
        returns = pd.Series(values).pct_change().dropna()
    else:
        returns = pd.Series(np.random.normal(0.0005, 0.015, 500))

    analyzer = MonteCarloAnalyzer(n_simulations=request.n_simulations)
    drawdown_analysis = analyzer.analyze_drawdowns(returns)

    simulations = analyzer.bootstrap_returns(returns, n_periods=request.n_periods)
    final_values = []
    for sim in simulations:
        equity = (1 + sim).cumprod() * request.initial_capital
        final_values.append(float(equity[-1]))

    fv_arr = np.array(final_values)

    return {
        "strategy_id": request.strategy_id,
        "n_simulations": request.n_simulations,
        "n_periods": request.n_periods,
        "initial_capital": request.initial_capital,
        "drawdown_analysis": drawdown_analysis,
        "final_values": {
            "median": float(np.median(fv_arr)),
            "p25": float(np.percentile(fv_arr, 25)),
            "p75": float(np.percentile(fv_arr, 75)),
            "p10": float(np.percentile(fv_arr, 10)),
            "p90": float(np.percentile(fv_arr, 90)),
            "p5": float(np.percentile(fv_arr, 5)),
            "p95": float(np.percentile(fv_arr, 95)),
            "min": float(np.min(fv_arr)),
            "max": float(np.max(fv_arr)),
            "mean": float(np.mean(fv_arr)),
            "std": float(np.std(fv_arr)),
        },
        "confidence_levels": {
            str(cl): float(np.percentile(fv_arr, cl * 100))
            for cl in request.confidence_levels
        },
        "survival_rate": float(np.mean(fv_arr > request.initial_capital)),
        "probability_of_loss": float(np.mean(fv_arr < request.initial_capital)),
    }


@router.get("/monte-carlo")
def monte_carlo_analysis(
    strategy_id: str = "default",
    n_simulations: int = 1000,
):
    """Run Monte Carlo analysis on a strategy's historical returns."""
    np.random.seed(42)
    # Mock daily returns — in production, fetch from stored backtest results
    returns = pd.Series(np.random.normal(0.0005, 0.015, 500))

    analyzer = MonteCarloAnalyzer(n_simulations=n_simulations)
    results = analyzer.analyze_drawdowns(returns)

    # Generate simulation paths
    simulations = analyzer.bootstrap_returns(returns, n_periods=252)
    final_values = []
    for sim in simulations:
        equity = (1 + sim).cumprod() * 100000
        final_values.append(float(equity[-1]))

    return {
        "strategy_id": strategy_id,
        "n_simulations": n_simulations,
        "drawdown_analysis": results,
        "final_values": {
            "median": float(np.median(final_values)),
            "p25": float(np.percentile(final_values, 25)),
            "p75": float(np.percentile(final_values, 75)),
            "p10": float(np.percentile(final_values, 10)),
            "p90": float(np.percentile(final_values, 90)),
            "min": float(min(final_values)),
            "max": float(max(final_values)),
        },
        "survival_rate": float(np.mean(np.array(final_values) > 100000)),
    }


@router.post("/walk-forward")
def walk_forward_analysis(config: BacktestConfig):
    """Run walk-forward optimization with in-sample / out-of-sample windows."""
    try:
        import numpy as np
        from datetime import datetime, timedelta

        prices = generate_mock_prices(config.symbol, config.start_date, config.end_date)
        signal_func = generate_signal_func(config.signal)

        start = datetime.strptime(config.start_date, "%Y-%m-%d")
        end = datetime.strptime(config.end_date, "%Y-%m-%d")
        total_days = (end - start).days

        # Walk-forward parameters
        in_sample_months = 12  # 12 months in-sample
        oos_months = 3         # 3 months out-of-sample
        window_size = timedelta(days=30)

        windows = []
        oos_returns = []

        current = start
        backtester = VectorizedBacktester(
            initial_capital=config.initial_capital,
            commission=config.commission,
            slippage=config.slippage,
        )

        while current < end - timedelta(days=60):
            is_start = current
            is_end = min(current + timedelta(days=in_sample_months * 30), end)
            oos_start = is_end
            oos_end = min(oos_start + timedelta(days=oos_months * 30), end)

            if oos_end >= end:
                break

            # In-sample backtest
            is_prices = prices.loc[is_start:is_end]
            if len(is_prices) < 30:
                current += window_size
                continue

            is_result = backtester.run(is_prices, signal_func)
            is_returns = is_result["returns"]

            # Out-of-sample backtest
            oos_prices = prices.loc[oos_start:oos_end]
            if len(oos_prices) < 10:
                current += window_size
                continue

            oos_result = backtester.run(oos_prices, signal_func)
            oos_returns_series = oos_result["returns"]

            if len(oos_returns_series) > 0:
                oos_ret = float(oos_returns_series.mean() * 252)  # annualized
                oos_sharpe = float(oos_returns_series.mean() / oos_returns_series.std() * np.sqrt(252)) if oos_returns_series.std() > 0 else 0
            else:
                oos_ret = 0
                oos_sharpe = 0

            oos_returns.append(oos_ret)
            windows.append({
                "in_sample_start": is_start.strftime("%Y-%m-%d"),
                "in_sample_end": is_end.strftime("%Y-%m-%d"),
                "oos_start": oos_start.strftime("%Y-%m-%d"),
                "oos_end": oos_end.strftime("%Y-%m-%d"),
                "in_sample_return": float(is_result["metrics"]["annual_return"]),
                "oos_return": oos_ret,
                "oos_sharpe": oos_sharpe,
            })

            current += window_size

        if not windows:
            return {
                "strategy_id": f"{config.symbol}-{config.signal.type}",
                "windows": [],
                "oos_return": 0,
                "oos_sharpe": 0,
                "pbo": 0,
                "deflated_sharpe": 0,
            }

        # Calculate PBO (Probability of Backtest Overfitting)
        is_returns_list = [w["in_sample_return"] for w in windows]
        oos_returns_list = [w["oos_return"] for w in windows]

        # Simple PBO: fraction of windows where OOS < IS
        pbo = sum(1 for is_r, oos_r in zip(is_returns_list, oos_returns_list) if oos_r < is_r) / len(windows)

        # Deflated Sharpe: Sharpe adjusted for multiple testing
        avg_oos_sharpe = np.mean(oos_returns_list) / (np.std(oos_returns_list) + 1e-10) if len(oos_returns_list) > 1 else 0
        deflated_sharpe = float(avg_oos_sharpe * (1 - pbo))

        # Composite Sharpe from return series
        if len(oos_returns) > 0:
            avg_oos_return = sum(oos_returns) / len(oos_returns)
            std_oos = np.std(oos_returns) if len(oos_returns) > 1 else 0
            composite_sharpe = avg_oos_return / (std_oos + 1e-10)
        else:
            composite_sharpe = 0

        return {
            "strategy_id": f"{config.symbol}-{config.signal.type}",
            "windows": windows,
            "oos_return": float(np.mean(oos_returns)) if oos_returns else 0,
            "oos_sharpe": float(composite_sharpe),
            "pbo": float(pbo),
            "deflated_sharpe": deflated_sharpe,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ComparisonRequest(BaseModel):
    configs: List[BacktestConfig]


@router.post("/run-comparison")
def run_comparison(request: ComparisonRequest):
    """Run multiple backtest configurations side-by-side."""
    results = []
    for config in request.configs:
        try:
            prices = generate_mock_prices(config.symbol, config.start_date, config.end_date)
            signal_func = generate_signal_func(config.signal)

            backtester = VectorizedBacktester(
                initial_capital=config.initial_capital,
                commission=config.commission,
                slippage=config.slippage,
            )

            result = backtester.run(prices, signal_func)

            equity_clean = result["equity"].dropna()
            if len(equity_clean) == 0:
                equity_clean = pd.Series([config.initial_capital], index=[result["equity"].index[-1]])
            equity_curve = [
                {"date": str(idx.date()), "value": float(val)}
                for idx, val in equity_clean.items()
            ]

            results.append({
                "strategy_id": f"{config.symbol}-{config.signal.type}",
                "equity_curve": equity_curve,
                "metrics": result["metrics"],
                "label": config.signal.type,
            })
        except Exception as e:
            results.append({
                "strategy_id": f"{config.symbol}-{config.signal.type}",
                "equity_curve": [],
                "metrics": {},
                "label": config.signal.type,
                "error": str(e),
            })

    return {"results": results}


@router.get("/strategies/{strategy_id}/signals")
def get_strategy_signals(strategy_id: str):
    """Get backtest signals for a specific strategy."""
    # In production, this would analyze the strategy's logic
    return {
        "strategy_id": strategy_id,
        "signal_types": ["SMA Crossover", "RSI Divergence", "Bollinger Breakout", "Momentum"],
        "default_params": {
            "sma_crossover": {"fast": 20, "slow": 50},
            "rsi": {"period": 14, "oversold": 30, "overbought": 70},
            "bollinger": {"period": 20, "std_mult": 2.0},
            "momentum": {"lookback": 10, "threshold": 0.0},
        },
    }


@router.get("/regime")
def regime_detection(symbol: str = "SPY"):
    """Detect market regime (trending, mean-reverting, range-bound, high-vol)."""
    prices = generate_mock_prices(symbol, "2023-01-01", "2024-01-01")
    close = prices["close"]
    returns = close.pct_change().dropna()

    # Volatility regime
    vol = returns.std() * np.sqrt(252)
    vol_percentile = 0.5  # placeholder — in production compare to historical

    # Trend regime — ADX proxy via rolling correlation of price with time
    x = np.arange(len(close))
    rolling_corr = close.rolling(60).corr(pd.Series(x, index=close.index))
    trend_score = rolling_corr.tail(20).mean() if len(rolling_corr.dropna()) > 0 else 0.0

    # Momentum regime — recent price change
    momentum = (close.iloc[-1] / close.iloc[-20] - 1).item() if len(close) >= 20 else 0.0

    if trend_score > 0.5:
        regime = "trending"
    elif trend_score < 0.1 and vol_percentile > 0.6:
        regime = "volatile_range"
    elif trend_score < 0.1:
        regime = "range_bound"
    else:
        regime = "transition"

    return {
        "symbol": symbol,
        "regime": regime,
        "volatility": float(vol),
        "vol_percentile": float(vol_percentile),
        "trend_strength": float(trend_score) if not np.isnan(trend_score) else 0.0,
        "momentum_20d": float(momentum),
        "last_price": float(close.iloc[-1]),
    }


class ExportResult(BaseModel):
    type: str
    symbol: str
    timeframe: str
    data: Dict[str, Any]


@router.get("/export", response_model=ExportResult)
def export_backtest(
    symbol: str = "SPY",
    timeframe: str = "D1",
    start_date: str = "2020-01-01",
    end_date: str = "2024-01-01",
    initial_capital: float = 100000.0,
    commission: float = 0.001,
    slippage: float = 0.0005,
    signal_type: str = "sma_crossover",
    signal_params: str = '{"fast": 20, "slow": 50}',
):
    """Generate exportable backtest report data (JSON for PDF/HTML generation)."""
    import json
    params = json.loads(signal_params)
    config = BacktestConfig(
        symbol=symbol,
        timeframe=timeframe,
        start_date=start_date,
        end_date=end_date,
        initial_capital=initial_capital,
        commission=commission,
        slippage=slippage,
        signal=SignalConfig(type=signal_type, params=params),
    )

    prices = generate_mock_prices(config.symbol, config.start_date, config.end_date)
    signal_func = generate_signal_func(config.signal)

    backtester = VectorizedBacktester(
        initial_capital=config.initial_capital,
        commission=config.commission,
        slippage=config.slippage,
    )
    result = backtester.run(prices, signal_func)

    equity_clean = result["equity"].dropna()
    if len(equity_clean) == 0:
        equity_clean = pd.Series([config.initial_capital], index=[result["equity"].index[-1]])

    regime = regime_detection(symbol)

    return ExportResult(
        type="backtest_report",
        symbol=symbol,
        timeframe=timeframe,
        data={
            "config": {
                "symbol": symbol,
                "timeframe": timeframe,
                "start_date": start_date,
                "end_date": end_date,
                "initial_capital": initial_capital,
                "commission": commission,
                "slippage": slippage,
                "signal_type": signal_type,
                "signal_params": params,
            },
            "equity_curve": [
                {"date": str(idx.date()), "value": float(val)}
                for idx, val in equity_clean.items()
            ],
            "metrics": result["metrics"],
            "regime": regime,
            "generated_at": pd.Timestamp.now().isoformat(),
        },
    )


@router.get("/correlation-clusters/{strategy_id}")
def correlation_clusters(strategy_id: str):
    """Compute correlation clusters for a strategy against all others."""
    # Fetch all strategies from DB
    db = new_db_connection()
    try:
        rows = db.execute("SELECT id, name, symbol FROM strategies WHERE status IN ('Live', 'Paper')").fetchall()
    finally:
        db.close()

    if not rows:
        return {"strategies": [], "clusters": []}

    strategy_ids = [r["id"] for r in rows]
    strategy_names = {r["id"]: r["name"] for r in rows}

    # Generate returns for each strategy (mock for now; in production use stored backtest results)
    returns = {}
    for sid in strategy_ids:
        prices = generate_mock_prices(strategy_names[sid] if sid in strategy_names else "SPY", "2023-01-01", "2024-01-01")
        r = prices["close"].pct_change().dropna()
        returns[sid] = r

    # Align returns on common dates
    ret_df = pd.DataFrame(returns).dropna()
    if ret_df.empty:
        return {"strategies": [], "clusters": []}

    # Pearson correlation matrix
    corr_matrix = ret_df.corr()

    # Simple clustering: group by correlation threshold
    threshold = 0.5
    visited = set()
    clusters = []

    for sid in strategy_ids:
        if sid in visited:
            continue
        cluster = [sid]
        visited.add(sid)
        for other in strategy_ids:
            if other == sid or other in visited:
                continue
            if abs(corr_matrix.loc[sid, other]) >= threshold:
                cluster.append(other)
                visited.add(other)

        strategies_list = []
        for csid in cluster:
            corr_val = corr_matrix.loc[sid, csid] if sid != csid else 1.0
            strategies_list.append({
                "id": csid,
                "name": strategy_names.get(csid, csid),
                "correlation": float(corr_val),
            })

        if len(strategies_list) > 1:
            clusters.append({
                "cluster_id": f"cluster_{len(clusters) + 1}",
                "strategies": strategies_list,
            })

    all_strategies = [
        {"id": r["id"], "name": r["name"]}
        for r in rows
    ]

    return {
        "strategies": all_strategies,
        "clusters": clusters,
    }
