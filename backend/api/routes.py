from fastapi import APIRouter
from pydantic import BaseModel

from services.text_to_sql import generate_sql
from services.sql_validator import validate_sql
from services.sql_executor import execute_query
from services.schema import get_schema
from services.intent_validator import validate_intent
from services.dashboard import get_dashboard_metrics
from services.suggestions import generate_suggestions

from db.session import get_app_db_connection

router = APIRouter()


# =========================
# 📦 MODELS
# =========================

class AnalyzeRequest(BaseModel):
    query: str
    table: str


class SaveQueryRequest(BaseModel):
    name: str
    query: str
    sql: str


# =========================
# 🔥 ANALYZE ENDPOINT
# =========================

@router.post("/analyze")
def analyze(request: AnalyzeRequest):

    # 🔹 Step 0: Intent validation
    try:
        schema = get_schema()
    except Exception as e:
        return {"success": False, "error": str(e)}

    is_valid_intent, message = validate_intent(request.query, schema)

    if not is_valid_intent:
        return {"success": False, "error": message}

    # 🔹 Step 1: NL → SQL
    sql_query, confidence, reason = generate_sql(
        request.query,
        request.table
    )

    if confidence == "LOW":
        return {"success": False, "error": reason}

    # 🔹 Step 2: Validate SQL
    allowed_tables = list(schema.keys())

    if not validate_sql(sql_query, allowed_tables):
        return {
            "success": False,
            "error": "Invalid or unsafe SQL query generated"
        }

    # 🔹 Step 3: Execute
    try:
        data = execute_query(sql_query)
    except Exception as e:
        return {"success": False, "error": str(e)}

    # 🔥 Step 3.5: SAVE QUERY HISTORY
    try:
        app_conn = get_app_db_connection()
        cursor = app_conn.cursor()

        # get active DB
        cursor.execute("""
            SELECT id FROM db_connections
            WHERE user_id = 1 AND is_active = TRUE
            LIMIT 1
        """)
        db_row = cursor.fetchone()
        active_db_id = db_row[0] if db_row else None

        cursor.execute("""
            INSERT INTO query_history 
            (user_id, db_id, natural_query, sql_query)
            VALUES (%s, %s, %s, %s)
        """, (
            1,
            active_db_id,
            request.query,
            sql_query
        ))

        app_conn.commit()

    except Exception as e:
        print("History save failed:", e)

    finally:
        try:
            cursor.close()
            app_conn.close()
        except:
            pass

    # 🔹 Step 4: Data Quality Check
    if data:
        null_present = any(
            any(value is None for value in row.values())
            for row in data
        )

        if null_present:
            if confidence == "VERY_HIGH":
                confidence = "HIGH"
                reason = "Result contains NULL values"
            elif confidence == "HIGH":
                confidence = "MEDIUM"
                reason = "Some values missing (NULLs present)"

    # 🔹 Final response
    return {
        "success": True,
        "sql": sql_query,
        "data": data,
        "table": request.table,
        "confidence": confidence,
        "reason": reason
    }


# =========================
# 📊 DASHBOARD
# =========================

@router.get("/dashboard")
def dashboard():
    return get_dashboard_metrics()


# =========================
# 💡 SUGGESTIONS
# =========================

@router.get("/suggestions")
def suggestions():
    return generate_suggestions()


# =========================
# 📚 TABLES
# =========================

@router.get("/tables")
def get_tables():
    try:
        schema = get_schema()
        return list(schema.keys())
    except Exception as e:
        return {"success": False, "error": str(e)}


# =========================
# 🧠 FULL SCHEMA
# =========================

@router.get("/schema")
def fetch_schema():
    try:
        return get_schema()
    except Exception as e:
        return {"success": False, "error": str(e)}


# =========================
# 🟢 ACTIVE DB
# =========================

@router.get("/active-db")
def active_db():
    conn = get_app_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name
        FROM db_connections
        WHERE user_id = 1 AND is_active = TRUE
        LIMIT 1
    """)

    row = cursor.fetchone()

    cursor.close()
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
def get_query_history():

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT q.id, q.natural_query, q.sql_query, q.created_at, d.name
            FROM query_history q
            LEFT JOIN db_connections d ON q.db_id = d.id
            WHERE q.user_id = 1
            ORDER BY q.created_at DESC
            LIMIT 20
        """)

        rows = cursor.fetchall()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        cursor.close()
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
def save_query(request: SaveQueryRequest):

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        # get active DB
        cursor.execute("""
            SELECT id FROM db_connections
            WHERE user_id = 1 AND is_active = TRUE
            LIMIT 1
        """)
        db_row = cursor.fetchone()

        if not db_row:
            return {"success": False, "error": "No active database"}

        db_id = db_row[0]

        cursor.execute("""
            INSERT INTO saved_queries
            (user_id, db_id, name, natural_query, sql_query)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            1,
            db_id,
            request.name,
            request.query,
            request.sql
        ))

        conn.commit()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        cursor.close()
        conn.close()

    return {"success": True}


# =========================
# 📂 GET SAVED QUERIES
# =========================

@router.get("/saved-queries")
def get_saved_queries():

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.name, s.natural_query, s.sql_query, s.created_at, d.name, d.id
            FROM saved_queries s
            LEFT JOIN db_connections d ON s.db_id = d.id
            WHERE s.user_id = 1
            ORDER BY s.created_at DESC
        """)

        rows = cursor.fetchall()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        cursor.close()
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
def delete_saved_query(query_id: int):

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM saved_queries
            WHERE id = %s AND user_id = 1
        """, (query_id,))

        conn.commit()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        cursor.close()
        conn.close()

    return {"success": True}