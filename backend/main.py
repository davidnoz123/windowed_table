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
            rows = [r for r in rows if _contains_match(r.get(field), value)]
        elif op == "gt":
            rows = [r for r in rows if _numeric_compare(r.get(field), value, lambda a, b: a > b)]
        elif op == "gte":
            rows = [r for r in rows if _numeric_compare(r.get(field), value, lambda a, b: a >= b)]
        elif op == "lt":
            rows = [r for r in rows if _numeric_compare(r.get(field), value, lambda a, b: a < b)]
        elif op == "lte":
            rows = [r for r in rows if _numeric_compare(r.get(field), value, lambda a, b: a <= b)]
        elif op == "in":
            rows = [r for r in rows if _in_match(r.get(field), value)]
    return rows


def _contains_match(field_value, search_value) -> bool:
    if field_value is None:
        return False
    try:
        return str(search_value).lower() in str(field_value).lower()
    except:
        return False


def _numeric_compare(field_value, compare_value, op) -> bool:
    if field_value is None:
        return False
    try:
        num_field = float(field_value)
        num_compare = float(compare_value)
        return op(num_field, num_compare)
    except (ValueError, TypeError):
        return False


def _in_match(field_value, values) -> bool:
    if not isinstance(values, list):
        return False
    if len(values) == 0:
        return True
    if field_value is None:
        return False
    normalized_values = [str(v).lower() if isinstance(v, str) else v for v in values]
    normalized_field = str(field_value).lower() if isinstance(field_value, str) else field_value
    return normalized_field in normalized_values


def apply_sort(rows: list[dict], sort: list[SortField]) -> list[dict]:
    if not sort:
        return rows
    
    class Reverse:
        def __init__(self, value):
            self.value = value
        
        def __lt__(self, other):
            return self.value > other.value
        
        def __le__(self, other):
            return self.value >= other.value
        
        def __gt__(self, other):
            return self.value < other.value
        
        def __ge__(self, other):
            return self.value <= other.value
        
        def __eq__(self, other):
            return self.value == other.value
        
        def __ne__(self, other):
            return self.value != other.value
    
    def make_sort_key(row: dict) -> tuple:
        key_parts = []
        for s in sort:
            field_value = row.get(s.field)
            is_none = field_value is None
            
            if is_none:
                sort_value = ""
            elif isinstance(field_value, str):
                sort_value = field_value.lower()
            else:
                sort_value = field_value
            
            if s.direction == "desc":
                key_parts.append((is_none, Reverse(sort_value)))
            else:
                key_parts.append((is_none, sort_value))
        
        return tuple(key_parts)
    
    return sorted(rows, key=make_sort_key)


@app.get("/table/distinct/{field}")
def get_distinct_values(field: str) -> dict:
    if field not in ["status", "department"]:
        return {"values": []}
    
    values = set()
    for row in DATA:
        val = row.get(field)
        if val is not None:
            values.add(val)
    
    return {"values": sorted(list(values))}


@app.post("/table/query", response_model=TableResponse)
def query_table(query: TableQuery) -> TableResponse:
    rows = list(DATA)
    rows = apply_filters(rows, query.filters)
    rows = apply_sort(rows, query.sort)
    total = len(rows)
    
    start = max(0, query.start)
    count = min(200, query.count)
    
    if start >= total:
        window = []
    else:
        window = rows[start: start + count]
    
    return TableResponse(total=total, start=start, count=count, rows=window)
