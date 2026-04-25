from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from services.text_to_sql import generate_sql, get_model
from services.sql_validator import validate_sql
from services.sql_executor import execute_query
from services.schema import (
    get_schema,
    get_fk_relationships_only,
    get_all_relationships
)
from services.intent_validator import validate_intent
from services.dashboard import get_dashboard_metrics
from services.suggestions import generate_suggestions
from services.auth import get_current_user
from db.session import get_app_db_connection
from services.sql_executor import execute_query


router = APIRouter()


class AnalyzeRequest(BaseModel):
    query: str
    table: Optional[str] = None

class SaveQueryRequest(BaseModel):
    name: str
    query: str
    sql: str


@router.post("/analyze")
def analyze(
    request: AnalyzeRequest,
    user_id: int = Depends(get_current_user)
):

    # 🔹 Step 0: Intent validation
    try:
        schema = get_schema(user_id)
    except Exception as e:
        return {"success": False, "error": str(e)}

    is_valid_intent, message = validate_intent(request.query, schema)

    if not is_valid_intent:
        return {"success": False, "error": message}

    # 🔹 Step 1: NL → SQL
    sql_query, confidence, reason = generate_sql(
        request.query,
        None,  # keeping flexibility from routes.py version
        user_id
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
        data = execute_query(sql_query, user_id)
    except Exception as e:
        return {"success": False, "error": str(e)}

    # 🔥 Step 3.5: SAVE QUERY HISTORY (FIXED VERSION)
    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        # 🔹 Get active DB for THIS user
        cursor.execute("""
            SELECT id FROM db_connections
            WHERE user_id = %s AND is_active = TRUE
            LIMIT 1
        """, (user_id,))

        db_row = cursor.fetchone()
        active_db_id = db_row[0] if db_row else None

        # 🔹 Save history
        cursor.execute("""
            INSERT INTO query_history 
            (user_id, db_id, natural_query, sql_query)
            VALUES (%s, %s, %s, %s)
        """, (
            user_id,
            active_db_id,
            request.query,
            sql_query
        ))

        conn.commit()

    except Exception as e:
        print("History save failed:", e)

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

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
        "confidence": confidence,
        "reason": reason
    }


# ✅ DASHBOARD
@router.get("/dashboard")
def dashboard(user_id: int = Depends(get_current_user)):
    return get_dashboard_metrics(user_id)


# ✅ SUGGESTIONS
@router.get("/suggestions")
def suggestions(user_id: int = Depends(get_current_user)):
    return generate_suggestions(user_id)


# ✅ GET TABLES
@router.get("/tables")
def get_tables(user_id: int = Depends(get_current_user)):
    try:
        schema = get_schema(user_id)
        return list(schema.keys())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ GET FULL SCHEMA
@router.get("/schema")
def fetch_schema(user_id: int = Depends(get_current_user)):
    try:
        return get_schema(user_id)
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# 🔥 CACHE
table_description_cache = {}


# 🔥 LLM DESCRIPTION FUNCTION
def generate_table_description(table_name, columns):
    try:
        model = get_model()

        column_text = ", ".join([col for col, _ in columns])

        prompt = f"""
You are a data analyst.

Table name: {table_name}
Columns: {column_text}

Write a short, clear one-line description of what this table represents.
Do not be verbose. But make sure it is very easy for laymen to understand. Use simple language.
"""

        response = model.generate_content(prompt)
        text = response.text if response.text else ""

        print("🔥 Generated description:", text)

        return text.strip()

    except Exception as e:
        print("❌ LLM error:", e)
        return f"Table '{table_name}'"


# ✅ TABLE PREVIEWS
@router.get("/table-previews")
def get_table_previews(
    include_description: bool = False,
    user_id: int = Depends(get_current_user)
):

    try:
        schema = get_schema(user_id)
        previews = {}

        for table in schema.keys():
            try:
                query = f"SELECT * FROM {table} LIMIT 5"
                data = execute_query(query, user_id)

                if include_description:
                    if table in table_description_cache:
                        description = table_description_cache[table]
                    else:
                        description = generate_table_description(table, schema[table])
                        table_description_cache[table] = description
                else:
                    description = None

                previews[table] = {
                    "columns": [col[0] for col in schema[table]],
                    "rows": data,
                    "description": description
                }

            except Exception as e:
                previews[table] = {
                    "columns": [],
                    "rows": [],
                    "description": f"Failed: {str(e)}"
                }

        return {
            "success": True,
            "data": previews
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ✅ SCHEMA GRAPH
@router.get("/schema-graph")
def fetch_schema_graph(user_id: int = Depends(get_current_user)):
    try:
        schema = get_schema(user_id)
        relationships = get_fk_relationships_only(user_id)

        return {
            "success": True,
            "tables": schema,
            "relationships": relationships
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    





# =========================
# GET ALL TABLES
# =========================
@router.get("/db/tables")
def get_all_tables(user=Depends(get_current_user)):
    query = """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
    """

    result = execute_query(query, user)

    return [row["table_name"] for row in result]


# =========================
# GET TABLE DATA
# =========================
@router.get("/db/table/{table_name}")
def get_table_data(table_name: str, user=Depends(get_current_user)):

    # 🔒 basic SQL injection protection
    if not table_name.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid table name")

    query = f'SELECT * FROM "{table_name}" LIMIT 100;'

    result = execute_query(query, user)

    return result