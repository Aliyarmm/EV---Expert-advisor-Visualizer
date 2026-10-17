from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class StrategyStatus(str, Enum):
    LIVE = "Live"
    PAPER = "Paper"
    RETIRED = "Retired"
    UNDER_REVIEW = "Under Review"


class StrategyBase(BaseModel):
    name: str
    family: str
    symbol: str
    timeframe: str
    logic: Optional[str] = None
    params: Optional[dict] = None


class StrategyCreate(StrategyBase):
    pass


class StrategyUpdate(StrategyBase):
    status: Optional[StrategyStatus] = None


class StrategyOut(StrategyBase):
    id: str
    status: StrategyStatus
    created_at: str
    updated_at: str
