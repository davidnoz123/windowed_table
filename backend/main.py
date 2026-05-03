from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import FilterField, SortField, TableQuery, TableResponse
from data import DATA

app = FastAPI(title="Windowed Table API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def apply_filters(rows: list[dict], filters: list[FilterField]) -> list[dict]:
    for f in filters:
        field, op, value = f.field, f.op, f.value
        if op == "eq":
            rows = [r for r in rows if r.get(field) == value]
        elif op == "neq":
            rows = [r for r in rows if r.get(field) != value]
        elif op == "contains":
            rows = [r for r in rows if str(value).lower() in str(r.get(field, "")).lower()]
        elif op == "gt":
            rows = [r for r in rows if r.get(field, 0) > value]
        elif op == "gte":
            rows = [r for r in rows if r.get(field, 0) >= value]
        elif op == "lt":
            rows = [r for r in rows if r.get(field, 0) < value]
        elif op == "lte":
            rows = [r for r in rows if r.get(field, 0) <= value]
    return rows


def apply_sort(rows: list[dict], sort: list[SortField]) -> list[dict]:
    for s in reversed(sort):
        reverse = s.direction == "desc"
        rows = sorted(rows, key=lambda r: (r.get(s.field) is None, r.get(s.field, "")), reverse=reverse)
    return rows


@app.post("/table/query", response_model=TableResponse)
def query_table(query: TableQuery) -> TableResponse:
    rows = list(DATA)
    rows = apply_filters(rows, query.filters)
    rows = apply_sort(rows, query.sort)
    total = len(rows)
    window = rows[query.start: query.start + query.count]
    return TableResponse(total=total, rows=window)
