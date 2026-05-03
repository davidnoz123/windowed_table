from pydantic import BaseModel
from typing import List, Any, Union


class SortField(BaseModel):
    field: str
    direction: str


class FilterField(BaseModel):
    field: str
    op: str
    value: Union[Any, List[Any]]


class TableQuery(BaseModel):
    start: int = 0
    count: int = 50
    sort: List[SortField] = []
    filters: List[FilterField] = []


class TableResponse(BaseModel):
    total: int
    start: int
    count: int
    rows: List[dict]
