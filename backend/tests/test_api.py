import pytest
from fastapi.testclient import TestClient

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app

client = TestClient(app)


def post_query(**kwargs):
    payload = {"start": 0, "count": 50, "sort": [], "filters": [], **kwargs}
    return client.post("/table/query", json=payload)


# ---------------------------------------------------------------------------
# Basic structure
# ---------------------------------------------------------------------------

def test_returns_total_and_rows():
    r = post_query()
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 10000
    assert len(data["rows"]) == 50


def test_row_fields_present():
    r = post_query(count=1)
    row = r.json()["rows"][0]
    for field in ("id", "name", "status", "department", "value", "date"):
        assert field in row


# ---------------------------------------------------------------------------
# Pagination / window
# ---------------------------------------------------------------------------

def test_pagination_window():
    r = post_query(start=100, count=25)
    data = r.json()
    assert len(data["rows"]) == 25
    assert data["rows"][0]["id"] == 101  # data is 1-indexed, no filter/sort applied


def test_window_beyond_total_returns_remainder():
    r = post_query(start=9999, count=50)
    data = r.json()
    assert data["total"] == 10000
    assert len(data["rows"]) == 1


def test_window_past_end_returns_empty():
    r = post_query(start=10000, count=50)
    data = r.json()
    assert data["total"] == 10000
    assert len(data["rows"]) == 0


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

def test_filter_eq():
    r = post_query(count=200, filters=[{"field": "status", "op": "eq", "value": "active"}])
    data = r.json()
    assert all(row["status"] == "active" for row in data["rows"])


def test_filter_neq():
    r = post_query(count=200, filters=[{"field": "status", "op": "neq", "value": "active"}])
    data = r.json()
    assert all(row["status"] != "active" for row in data["rows"])


def test_filter_contains_name():
    r = post_query(count=200, filters=[{"field": "name", "op": "contains", "value": "Alice"}])
    data = r.json()
    assert all("alice" in row["name"].lower() for row in data["rows"])


def test_filter_gt():
    r = post_query(count=200, filters=[{"field": "value", "op": "gt", "value": 9000}])
    data = r.json()
    assert all(row["value"] > 9000 for row in data["rows"])


def test_filter_gte():
    r = post_query(count=200, filters=[{"field": "value", "op": "gte", "value": 9000}])
    data = r.json()
    assert all(row["value"] >= 9000 for row in data["rows"])


def test_filter_lt():
    r = post_query(count=200, filters=[{"field": "value", "op": "lt", "value": 100}])
    data = r.json()
    assert all(row["value"] < 100 for row in data["rows"])


def test_filter_lte():
    r = post_query(count=200, filters=[{"field": "value", "op": "lte", "value": 100}])
    data = r.json()
    assert all(row["value"] <= 100 for row in data["rows"])


def test_filter_reduces_total():
    r_all = post_query()
    r_filtered = post_query(filters=[{"field": "status", "op": "eq", "value": "active"}])
    assert r_filtered.json()["total"] < r_all.json()["total"]


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------

def test_sort_name_asc():
    r = post_query(count=100, sort=[{"field": "name", "direction": "asc"}])
    names = [row["name"] for row in r.json()["rows"]]
    assert names == sorted(names)


def test_sort_name_desc():
    r = post_query(count=100, sort=[{"field": "name", "direction": "desc"}])
    names = [row["name"] for row in r.json()["rows"]]
    assert names == sorted(names, reverse=True)


def test_sort_value_asc():
    r = post_query(count=100, sort=[{"field": "value", "direction": "asc"}])
    values = [row["value"] for row in r.json()["rows"]]
    assert values == sorted(values)


def test_sort_value_desc():
    r = post_query(count=100, sort=[{"field": "value", "direction": "desc"}])
    values = [row["value"] for row in r.json()["rows"]]
    assert values == sorted(values, reverse=True)


# ---------------------------------------------------------------------------
# Combined filter + sort + pagination
# ---------------------------------------------------------------------------

def test_filter_sort_pagination():
    r = post_query(
        start=0,
        count=50,
        sort=[{"field": "value", "direction": "asc"}],
        filters=[{"field": "status", "op": "eq", "value": "active"}],
    )
    data = r.json()
    rows = data["rows"]
    assert all(row["status"] == "active" for row in rows)
    values = [row["value"] for row in rows]
    assert values == sorted(values)


def test_pagination_consistent_across_pages():
    r1 = post_query(start=0, count=50, sort=[{"field": "id", "direction": "asc"}])
    r2 = post_query(start=50, count=50, sort=[{"field": "id", "direction": "asc"}])
    ids1 = [row["id"] for row in r1.json()["rows"]]
    ids2 = [row["id"] for row in r2.json()["rows"]]
    assert ids1[-1] < ids2[0], "Pages must not overlap"
