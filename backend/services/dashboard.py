from services.schema import get_schema, get_all_relationships
from services.sql_executor import execute_query


def get_dashboard_metrics():
    schema = get_schema()
    relationships = get_all_relationships()

    tables = list(schema.keys())

    # 🔹 1. Total Tables
    total_tables = len(tables)

    # 🔹 2. Largest Table
    largest_table = None
    largest_count = 0

    for table in tables:
        try:
            query = f"SELECT COUNT(*) as count FROM {table};"
            result = execute_query(query)

            if result:
                count = result[0]["count"]

                if count > largest_count:
                    largest_count = count
                    largest_table = table

        except Exception:
            continue

    # 🔹 3. Most Connected Table
    connection_count = {}

    for src_t, _, tgt_t, _, _ in relationships:
        connection_count[src_t] = connection_count.get(src_t, 0) + 1
        connection_count[tgt_t] = connection_count.get(tgt_t, 0) + 1

    most_connected_table = None
    max_connections = 0

    for table, count in connection_count.items():
        if count > max_connections:
            max_connections = count
            most_connected_table = table

    # 🔹 4. Total Relationships
    total_relationships = len(relationships)

    # 🔥 5. Schema Health
    if total_tables == 0:
        ratio = 0
    else:
        ratio = total_relationships / total_tables

    if ratio > 1:
        health_label = "Highly Connected"
    elif ratio > 0.3:
        health_label = "Moderately Connected"
    else:
        health_label = "Sparse Schema"

    return {
        "total_tables": total_tables,
        "largest_table": largest_table or "N/A",
        "largest_table_count": largest_count,
        "most_connected_table": most_connected_table or "N/A",
        "total_relationships": total_relationships,

        # 🔥 NEW
        "schema_health": {
            "label": health_label,
            "tables": total_tables,
            "relationships": total_relationships,
            "ratio": round(ratio, 2)
        }
    }