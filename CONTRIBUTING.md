# Contributing to EA Index

Thank you for your interest in contributing to EA Index — a MetaTrader EA performance analytics dashboard!

## How to Contribute

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** — add tests where applicable
4. **Run tests**: `.\run-tests.bat` (or `cd backend && pytest -v` and `cd frontend && npx jest`)
5. **Commit**: `git commit -m "Brief description" -m "More detail if needed"`
6. **Push**: `git push origin feature/your-feature-name`
7. **Open a Pull Request**

## Development Setup

See the [README](README.md) for full setup instructions. Quick start:

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000

# Frontend
cd ../frontend
npm install
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1" > .env.local
npm run dev
```

## Code Style

- **Backend**: Python 3.10+, FastAPI, PEP 8 with 4-space indent
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Framer Motion

## Reporting Issues

Use the GitHub issue templates. Categories:
- 🐛 **Bug Report** — something doesn't work
- ✨ **Feature Request** — new capability for EA analysis
- 📈 **Data Issue** — equity curve, drawdown, or Sharpe ratio problem
- 📊 **Dashboard Bug** — frontend display issue

## Areas for Contribution

- **EA strategy analysis** — new signal types for MetaTrader backtests
- **Performance metrics** — equity curve visualization improvements
- **Portfolio construction** — risk allocation wizards
- **Data pipeline** — CSV/Parquet column mapping for trade history
- **Monte Carlo simulation** — portfolio-level stress testing

