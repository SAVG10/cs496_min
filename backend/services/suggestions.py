from services.schema import get_schema


def is_useless_column(col: str):
    col = col.lower()
    return (
        col == "id" or
        col.endswith("_id") or
        "uuid" in col or
        col.startswith("is_") or
        col.startswith("has_")
    )


def generate_suggestions(user_id: int):
    schema = get_schema(user_id)

    text_cols = []
    numeric_cols = []
    time_cols = []

    for table, columns in schema.items():
        for col, dtype in columns:
            col_lower = col.lower()
            dtype_lower = dtype.lower()

            if is_useless_column(col_lower):
                continue

            # 🔹 classify columns
            if "char" in dtype_lower or "text" in dtype_lower:
                text_cols.append(col)

            elif any(x in dtype_lower for x in ["int", "numeric", "double", "real"]):
                numeric_cols.append(col)

            elif "date" in dtype_lower or "time" in dtype_lower:
                time_cols.append(col)

    suggestions = []

    # 🔥 TEXT → categorical insights
    for col in text_cols[:2]:
        suggestions.append(f"Top 5 {col} by count")

    # 🔥 NUMERIC → aggregation
    for col in numeric_cols[:2]:
        suggestions.append(f"What is the average {col}?")

    # 🔥 TIME → trends
    for col in time_cols[:1]:
        suggestions.append(f"How do records change over time based on {col}?")

    # 🔥 generic fallback (important)
    if not suggestions:
        suggestions = [
            "Show top 5 records",
            "What is the total number of records?",
            "Show distribution of values"
        ]

    return suggestions[:6]