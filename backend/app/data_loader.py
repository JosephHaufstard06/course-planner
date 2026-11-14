import json
from pathlib import Path
from typing import Any


DATA_FILE = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "courses.json"
)


def load_courses() -> list[dict[str, Any]]:
    with DATA_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    courses = data.get("courses")
    if not isinstance(courses, list):
        raise ValueError("courses.json must contain a 'courses' list")

    return courses