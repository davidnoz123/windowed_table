from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import TableQuery, TableResponse
from db import init_db, query_table as db_query_table, get_distinct_values as db_get_distinct_values

app = FastAPI(title="Windowed Table API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db_conn = None

@app.on_event("startup")
def startup():
    global db_conn
    db_conn = init_db()


@app.get("/table/distinct/{field}")
def get_distinct_values(field: str) -> dict:
    values = db_get_distinct_values(db_conn, field)
    return {"values": values}


@app.post("/table/query", response_model=TableResponse)
def query_table(query: TableQuery) -> TableResponse:
    start = max(0, query.start)
    count = min(200, query.count)
    
    total, rows = db_query_table(db_conn, query.filters, query.sort, start, count)
    
    return TableResponse(total=total, start=start, count=count, rows=rows)
