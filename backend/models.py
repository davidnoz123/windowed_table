from pydantic import BaseModel
from typing import List, Any


class SortField(BaseModel):
    field: str
    direction: str  # "asc" | "desc"


class FilterField(BaseModel):
    field: str
    op: str  # "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte"
    value: Any


class TableQuery(BaseModel):
    start: int = 0
    count: int = 50
    sort: List[SortField] = []
    filters: List[FilterField] = []


class TableResponse(BaseModel):
    total: int
    rows: List[dict]
