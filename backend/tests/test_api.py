"""
Tests for the EA Index API.
Run: pytest tests/ -v
"""
import pytest
import sqlite3
from fastapi.testclient import TestClient
from app.main import app
from app.db import init_db, get_db, DB_PATH

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure DB exists with tables for each test."""
    init_db()
    yield


def test_root():
    """API root should return service info."""
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "EA Index API"
    assert data["status"] == "running"


def test_list_strategies_empty():
    """Should return a list (possibly empty) of strategies."""
    r = client.get("/api/v1/strategies")
    assert r.status_code == 200
    assert isinstance(r.data if hasattr(r, 'data') else r.json(), list)


def test_create_and_get_book():
    """Create a book then verify it can be fetched."""
    r = client.post("/api/v1/books", json={
        "id": "test-book-1",
        "name": "Test Book",
        "items": [{"strategy_id": "strat-a", "weight": 0.5}],
    })
    assert r.status_code == 200
    assert r.json()["id"] == "test-book-1"

    r = client.get("/api/v1/books/test-book-1")
    assert r.status_code == 200
    assert r.json()["name"] == "Test Book"


def test_delete_book():
    """Delete a book that exists."""
    client.post("/api/v1/books", json={"id": "test-book-del", "name": "Del"})
    r = client.delete("/api/v1/books/test-book-del")
    assert r.status_code == 200
    assert r.json()["deleted"] == "test-book-del"
