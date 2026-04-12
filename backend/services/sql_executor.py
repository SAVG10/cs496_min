from db.session import get_active_connection


def execute_query(query: str):
    conn, _ = get_active_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query)

        # Handle cases where query returns no data
        if cursor.description is None:
            return []

        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        data = [dict(zip(columns, row)) for row in rows]

        return data

    finally:
        cursor.close()
        conn.close()