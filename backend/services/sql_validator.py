import re

FORBIDDEN = [
    "DROP", "DELETE", "TRUNCATE",
    "UPDATE", "INSERT", "ALTER",
    "CREATE", "GRANT", "REVOKE"
]


def validate_sql(query: str, allowed_tables: list[str]) -> bool:

    if not query:
        return False

    query = query.strip()

    # ❌ must be single statement only
    if query.count(";") > 1:
        return False

    if ";" in query and not query.endswith(";"):
        return False

    # ❌ must start with SELECT (allow whitespace before it)
    if not re.match(r"^\s*SELECT\b", query, re.IGNORECASE):
        return False

    # ❌ block CTE (WITH ...) to prevent hidden mutations
    if re.match(r"^\s*WITH\b", query, re.IGNORECASE):
        return False

    # ❌ block comments
    if "--" in query or "/*" in query or "*/" in query:
        return False

    # ❌ block dangerous SQL commands ONLY when used as commands
    for word in FORBIDDEN:
        # blocks: DELETE FROM, DROP TABLE, etc.
        if re.search(rf"\b{word}\b\s+(FROM|TABLE)", query, re.IGNORECASE):
            return False

    # ❌ enforce allowed tables dynamically
    tables = re.findall(r"\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)", query, re.IGNORECASE)
    tables += re.findall(r"\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)", query, re.IGNORECASE)

    allowed_tables_lower = [t.lower() for t in allowed_tables]

    for table in tables:
        if table.lower() not in allowed_tables_lower:
            return False

    return True