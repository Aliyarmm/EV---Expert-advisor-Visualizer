from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.backtest import router as backtest_router
from app.db import init_db

app = FastAPI(
    title="EV — Expert Advisor Visualizer API",
    description="MetaTrader EA performance analytics dashboard — strategy management, backtesting, portfolio construction",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3003", "http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(backtest_router, prefix="/api/v1/backtest")

init_db()

@app.get("/")
def root():
    return {"name": "EV — Expert Advisor Visualizer API", "status": "running", "version": "1.0.0"}
