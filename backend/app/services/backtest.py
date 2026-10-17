"""
Backtesting engine — vectorized, event-driven, and walk-forward.
MetaTrader EA performance analytics: equity curve, drawdown, Sharpe ratio, trade history.
Based on backtesting-frameworks skill patterns, adapted for this platform.
"""
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from decimal import Decimal
from typing import Callable, Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"


@dataclass
class Order:
    symbol: str
    side: OrderSide
    quantity: Decimal
    order_type: OrderType
    limit_price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    timestamp: Optional[datetime] = None


@dataclass
class Fill:
    order: Order
    fill_price: Decimal
    fill_quantity: Decimal
    commission: Decimal
    slippage: Decimal
    timestamp: datetime


@dataclass
class Position:
    symbol: str
    quantity: Decimal = Decimal("0")
    avg_cost: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")

    def update(self, fill: Fill) -> None:
        if fill.order.side == OrderSide.BUY:
            new_qty = self.quantity + fill.fill_quantity
            if new_qty != 0:
                self.avg_cost = (
                    (self.quantity * self.avg_cost +
                     fill.fill_quantity * fill.fill_price) / new_qty
                )
            self.quantity = new_qty
        else:
            self.realized_pnl += fill.fill_quantity * (fill.fill_price - self.avg_cost)
            self.quantity -= fill.fill_quantity


@dataclass
class Portfolio:
    cash: Decimal
    positions: Dict[str, Position] = None
    commission_per_share: Decimal = Decimal("0.01")
    slippage_bps: Decimal = Decimal("10")

    def __post_init__(self):
        if self.positions is None:
            self.positions = {}

    def get_position(self, symbol: str) -> Position:
        if symbol not in self.positions:
            self.positions[symbol] = Position(symbol=symbol)
        return self.positions[symbol]

    def process_fill(self, fill: Fill) -> None:
        position = self.get_position(fill.order.symbol)
        position.update(fill)

        if fill.order.side == OrderSide.BUY:
            self.cash -= fill.fill_price * fill.fill_quantity + fill.commission
        else:
            self.cash += fill.fill_price * fill.fill_quantity - fill.commission

    def get_equity(self, prices: Dict[str, Decimal]) -> Decimal:
        equity = self.cash
        for symbol, position in self.positions.items():
            if position.quantity != 0 and symbol in prices:
                equity += position.quantity * prices[symbol]
        return equity


def calculate_metrics(returns: pd.Series, rf_rate: float = 0.02) -> Dict[str, float]:
    """Calculate comprehensive performance metrics."""
    ann_factor = 252  # daily returns

    total_return = (1 + returns).prod() - 1
    annual_return = (1 + total_return) ** (ann_factor / len(returns)) - 1 if len(returns) > 0 else 0
    annual_vol = returns.std() * np.sqrt(ann_factor)

    sharpe = (annual_return - rf_rate) / annual_vol if annual_vol > 0 else 0

    downside_returns = returns[returns < 0]
    downside_vol = downside_returns.std() * np.sqrt(ann_factor) if len(downside_returns) > 0 else 0
    sortino = (annual_return - rf_rate) / downside_vol if downside_vol > 0 else 0

    equity = (1 + returns).cumprod()
    rolling_max = equity.cummax()
    drawdowns = (equity - rolling_max) / rolling_max
    max_drawdown = drawdowns.min()
    calmar = annual_return / abs(max_drawdown) if max_drawdown != 0 else 0

    wins = returns[returns > 0]
    losses = returns[returns < 0]
    win_rate = len(wins) / len(returns[returns != 0]) if len(returns[returns != 0]) > 0 else 0
    profit_factor = wins.sum() / abs(losses.sum()) if losses.sum() != 0 else float("inf")

    return {
        "total_return": float(total_return),
        "annual_return": float(annual_return),
        "annual_volatility": float(annual_vol),
        "sharpe_ratio": float(sharpe),
        "sortino_ratio": float(sortino),
        "calmar_ratio": float(calmar),
        "max_drawdown": float(max_drawdown),
        "win_rate": float(win_rate),
        "profit_factor": float(profit_factor),
        "num_trades": int((returns != 0).sum()),
    }


class VectorizedBacktester:
    """Fast vectorized backtester for simple strategies."""

    def __init__(
        self,
        initial_capital: float = 100000,
        commission: float = 0.001,
        slippage: float = 0.0005,
        position_sizing: str = "fixed",
        max_risk_per_trade: float = 2.0,
    ):
        self.initial_capital = initial_capital
        self.commission = commission
        self.slippage = slippage
        self.position_sizing = position_sizing
        self.max_risk_per_trade = max_risk_per_trade

    def _calculate_position_size(self, portfolio_value: float, price: float, volatility: float = None) -> float:
        """Calculate position size based on sizing mode."""
        if self.position_sizing == "fixed":
            return portfolio_value / price
        elif self.position_sizing == "percent_risk":
            # Risk max_risk_per_trade % of capital per trade
            risk_amount = portfolio_value * (self.max_risk_per_trade / 100)
            # Assuming 1:1 risk-reward with ATR = 1% of price
            atr = price * 0.01
            return risk_amount / (atr * price)
        elif self.position_sizing == "volatility_adjusted":
            vol = volatility if volatility else 0.01
            return (portfolio_value * 0.1) / (price * vol)
        elif self.position_sizing == "Kelly":
            # Fractional Kelly: 25% of full Kelly
            return portfolio_value / price * 0.25
        else:
            return portfolio_value / price

    def run(
        self,
        prices: pd.DataFrame,
        signal_func: Callable[[pd.DataFrame], pd.Series],
    ) -> Dict[str, Any]:
        signals = signal_func(prices).shift(1).fillna(0)
        returns = prices["close"].pct_change().fillna(0)
        position_changes = signals.diff().abs()
        trading_costs = position_changes * (self.commission + self.slippage)
        strategy_returns = signals * returns - trading_costs
        equity = (1 + strategy_returns).cumprod() * self.initial_capital
        metrics = calculate_metrics(strategy_returns)

        return {
            "equity": equity,
            "returns": strategy_returns,
            "signals": signals,
            "metrics": metrics,
        }


class MonteCarloAnalyzer:
    """Monte Carlo simulation for strategy robustness."""

    def __init__(self, n_simulations: int = 1000, confidence: float = 0.95):
        self.n_simulations = n_simulations
        self.confidence = confidence

    def bootstrap_returns(self, returns: pd.Series, n_periods: int = None) -> np.ndarray:
        if n_periods is None:
            n_periods = len(returns)
        simulations = np.zeros((self.n_simulations, n_periods))
        for i in range(self.n_simulations):
            simulated = np.random.choice(
                returns.values, size=n_periods, replace=True
            )
            simulations[i] = simulated
        return simulations

    def analyze_drawdowns(self, returns: pd.Series) -> Dict[str, float]:
        simulations = self.bootstrap_returns(returns)
        max_drawdowns = []
        for sim in simulations:
            equity = (1 + sim).cumprod()
            rolling_max = np.maximum.accumulate(equity)
            dd = (equity - rolling_max) / rolling_max
            max_drawdowns.append(dd.min())
        max_drawdowns = np.array(max_drawdowns)

        return {
            "expected_max_dd": float(np.mean(max_drawdowns)),
            "median_max_dd": float(np.median(max_drawdowns)),
            f"worst_{int(self.confidence*100)}pct": float(np.percentile(max_drawdowns, (1 - self.confidence) * 100)),
            "worst_case": float(max_drawdowns.min()),
        }
