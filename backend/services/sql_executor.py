from db.session import get_active_connection
from fastapi import HTTPException


def execute_query(query: str, user_id: int):
    conn = None
    cursor = None

    try:
        # 🔐 Safety check
        if not query.strip().lower().startswith("select"):
            raise HTTPException(
                status_code=400,
                detail="Only SELECT queries are allowed"
            )

        conn, _ = get_active_connection(user_id)
        cursor = conn.cursor()

        # 🔥 Optional LIMIT safety
        if (
            "limit" not in query.lower()
            and "count(" not in query.lower()
        ):
            query += " LIMIT 20"

        cursor.execute(query)

        if cursor.description is None:
            return []

        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        return [dict(zip(columns, row)) for row in rows]

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()