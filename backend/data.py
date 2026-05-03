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


def generate_data(n: int = 10000) -> list[dict]:
    random.seed(42)
    start_date = date(2020, 1, 1)
    rows = []
    for i in range(1, n + 1):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        rows.append({
            "id": i,
            "name": f"{first} {last}",
            "status": random.choice(STATUSES),
            "department": random.choice(DEPARTMENTS),
            "value": round(random.uniform(0.0, 10000.0), 2),
            "date": str(start_date + timedelta(days=random.randint(0, 365 * 4))),
        })
    return rows


DATA: list[dict] = generate_data()
