from fastapi import APIRouter, Depends
from pydantic import BaseModel
from fastapi import HTTPException

from services.auth import get_current_user
from db.session import get_app_db_connection

router = APIRouter()


# =========================
# 📦 MODELS
# =========================

class SaveQueryRequest(BaseModel):
    name: str
    query: str
    sql: str


# =========================
# 🟢 ACTIVE DB (USER-SCOPED)
# =========================

@router.get("/active-db")
def active_db(user_id: int = Depends(get_current_user)):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name
            FROM db_connections
            WHERE user_id = %s AND is_active = TRUE
            LIMIT 1
        """, (user_id,))

        row = cursor.fetchone()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    if not row:
        return {"success": True, "data": None}

    return {
        "success": True,
        "data": {
            "id": row[0],
            "name": row[1]
        }
    }


# =========================
# 📜 QUERY HISTORY
# =========================

@router.get("/query-history")
def get_query_history(user_id: int = Depends(get_current_user)):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT q.id, q.natural_query, q.sql_query, q.created_at, d.name
            FROM query_history q
            LEFT JOIN db_connections d ON q.db_id = d.id
            WHERE q.user_id = %s
            ORDER BY q.created_at DESC
            LIMIT 20
        """, (user_id,))

        rows = cursor.fetchall()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return {
        "success": True,
        "data": [
            {
                "id": r[0],
                "query": r[1],
                "sql": r[2],
                "time": str(r[3]),
                "db": r[4]
            }
            for r in rows
        ]
    }


# =========================
# ⭐ SAVE QUERY
# =========================

@router.post("/save-query")
def save_query(
    request: SaveQueryRequest,
    user_id: int = Depends(get_current_user)
):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        # 🔹 get active DB for THIS user
        cursor.execute("""
            SELECT id FROM db_connections
            WHERE user_id = %s AND is_active = TRUE
            LIMIT 1
        """, (user_id,))

        db_row = cursor.fetchone()

        if not db_row:
            return {"success": False, "error": "No active database"}

        db_id = db_row[0]

        cursor.execute("""
            INSERT INTO saved_queries
            (user_id, db_id, name, natural_query, sql_query)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            db_id,
            request.name,
            request.query,
            request.sql
        ))

        conn.commit()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return {"success": True}


# =========================
# 📂 GET SAVED QUERIES
# =========================

@router.get("/saved-queries")
def get_saved_queries(user_id: int = Depends(get_current_user)):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.name, s.natural_query, s.sql_query, s.created_at, d.name, d.id
            FROM saved_queries s
            LEFT JOIN db_connections d ON s.db_id = d.id
            WHERE s.user_id = %s
            ORDER BY s.created_at DESC
        """, (user_id,))

        rows = cursor.fetchall()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return {
        "success": True,
        "data": [
            {
                "id": r[0],
                "name": r[1],
                "query": r[2],
                "sql": r[3],
                "time": str(r[4]),
                "db_name": r[5],
                "db_id": r[6]
            }
            for r in rows
        ]
    }


# =========================
# 🗑 DELETE SAVED QUERY
# =========================

@router.delete("/saved-query/{query_id}")
def delete_saved_query(
    query_id: int,
    user_id: int = Depends(get_current_user)
):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM saved_queries
            WHERE id = %s AND user_id = %s
        """, (query_id, user_id))

        conn.commit()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return {"success": True}