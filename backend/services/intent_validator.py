def validate_intent(natural_query: str, schema: dict):

    query = natural_query.lower()
    tables = set(schema.keys())

    # 🔥 1. Detect destructive intent (word-based but smarter)
    DANGEROUS_INTENT = [
        "drop", "delete", "truncate",
        "remove", "clear", "erase",
        "update", "insert", "alter",
        "create", "modify", "replace"
    ]

    # Only block if intent looks like an action, not a column name
    tokens = query.split()

    for word in DANGEROUS_INTENT:
        if word in tokens:
            return False, "Data modification requests are not allowed. Try analytical queries instead."

    # 🔹 2. Detect table mentions explicitly
    mentioned_tables = set()

    for table in tables:
        if table.lower() in query:
            mentioned_tables.add(table)

    # 🔹 3. Invalid multi-table reference (edge case)
    if len(mentioned_tables) > 1 and len(tables) < 2:
        return False, "Query references multiple tables, but only one table exists in database"

    # 🔹 4. Empty / meaningless query
    if not query.strip():
        return False, "Query is empty"

    # 🔹 5. Otherwise allow
    return True, "Valid query"