import sqlite3
import random
from datetime import date, timedelta

STATUSES = ["active", "inactive", "pending"]
DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance"]
FIRST_NAMES = [
    "Alice", "Bob", "Charlie", "Diana", "Edward",
    "Fiona", "George", "Hannah", "Ivan", "Julia",
    "Kevin", "Laura", "Michael", "Nina", "Oscar",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones",
    "Garcia", "Miller", "Davis", "Wilson", "Moore",
    "Taylor", "Anderson", "Thomas", "Jackson", "White",
]


def init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE data (
            id INTEGER PRIMARY KEY,
            name TEXT,
            status TEXT,
            department TEXT,
            value REAL,
            date TEXT
        )
    """)
    
    random.seed(42)
    start_date = date(2020, 1, 1)
    rows = []
    for i in range(1, 10001):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        rows.append((
            i,
            f"{first} {last}",
            random.choice(STATUSES),
            random.choice(DEPARTMENTS),
            round(random.uniform(0.0, 10000.0), 2),
            str(start_date + timedelta(days=random.randint(0, 365 * 4))),
        ))
    
    cursor.executemany(
        "INSERT INTO data (id, name, status, department, value, date) VALUES (?, ?, ?, ?, ?, ?)",
        rows
    )
    
    conn.commit()
    return conn


def escape_like_pattern(value: str) -> str:
    return str(value).replace("%", "\\%").replace("_", "\\_")


def is_valid_field(field: str) -> bool:
    valid_fields = {"id", "name", "status", "department", "value", "date"}
    return field in valid_fields


def build_where_clause(filters: list, params: list) -> str:
    if not filters:
        return ""
    
    conditions = []
    for f in filters:
        field, op, value = f.field, f.op, f.value
        
        if not is_valid_field(field):
            conditions.append("1 = 0")
            continue
        
        if op == "eq":
            conditions.append(f"{field} = ?")
            params.append(value)
        elif op == "neq":
            conditions.append(f"({field} != ? AND {field} IS NOT NULL)")
            params.append(value)
        elif op == "contains":
            escaped = escape_like_pattern(value)
            conditions.append(f"{field} LIKE ? ESCAPE '\\'")
            params.append(f"%{escaped}%")
        elif op in ("gt", "gte", "lt", "lte"):
            sql_op = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<="}[op]
            conditions.append(f"(CAST({field} AS REAL) {sql_op} ? AND {field} IS NOT NULL)")
            params.append(float(value))
        elif op == "in":
            if not isinstance(value, list):
                continue
            if len(value) == 0:
                continue
            placeholders = ",".join("?" * len(value))
            conditions.append(f"LOWER({field}) IN ({placeholders})")
            params.extend([str(v).lower() for v in value])
    
    if not conditions:
        return ""
    return "WHERE " + " AND ".join(conditions)


def build_order_by_clause(sort: list) -> str:
    if not sort:
        return "ORDER BY id ASC"
    
    numeric_fields = {"id", "value"}
    
    order_terms = []
    for s in sort:
        field = s.field
        direction = s.direction.upper()
        order_terms.append(f"{field} IS NULL ASC")
        
        if field in numeric_fields:
            order_terms.append(f"CAST({field} AS REAL) {direction}")
        else:
            order_terms.append(f"LOWER({field}) COLLATE NOCASE {direction}")
    
    order_terms.append("id ASC")
    return "ORDER BY " + ", ".join(order_terms)


def query_table(conn: sqlite3.Connection, filters: list, sort: list, start: int, count: int) -> tuple:
    start = max(0, start)
    count = min(200, count)
    
    params = []
    where_clause = build_where_clause(filters, params)
    order_by_clause = build_order_by_clause(sort)
    
    count_query = f"SELECT COUNT(*) FROM data {where_clause}"
    cursor = conn.cursor()
    cursor.execute(count_query, params)
    total = cursor.fetchone()[0]
    
    if start >= total:
        return total, []
    
    data_query = f"""
        SELECT id, name, status, department, value, date
        FROM data
        {where_clause}
        {order_by_clause}
        LIMIT ? OFFSET ?
    """
    cursor.execute(data_query, params + [count, start])
    rows = [dict(row) for row in cursor.fetchall()]
    
    return total, rows


def get_distinct_values(conn: sqlite3.Connection, field: str) -> list:
    if field not in ["status", "department"]:
        return []
    
    cursor = conn.cursor()
    cursor.execute(f"SELECT DISTINCT {field} FROM data WHERE {field} IS NOT NULL ORDER BY {field}")
    return [row[0] for row in cursor.fetchall()]
