from fastapi import APIRouter
from pydantic import BaseModel

from services.text_to_sql import generate_sql
from services.sql_validator import validate_sql
from services.sql_executor import execute_query
from services.schema import get_schema
from services.intent_validator import validate_intent
from services.dashboard import get_dashboard_metrics
from services.suggestions import generate_suggestions
from fastapi import HTTPException

router = APIRouter()


class AnalyzeRequest(BaseModel):
    query: str
    table: str


# ✅ MAIN ANALYZE ENDPOINT
@router.post("/analyze")
def analyze(request: AnalyzeRequest):

    # 🔥 Step 0: Intent validation (ACTIVE DB)
    try:
        schema = get_schema()
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

    is_valid_intent, message = validate_intent(request.query, schema)

    if not is_valid_intent:
        return {
            "success": False,
            "error": message
        }

    # ✅ Step 1: NL → SQL
    sql_query, confidence, reason = generate_sql(
        request.query,
        request.table
    )

    # 🔥 Step 1.5: Block invalid / irrelevant queries
    if confidence == "LOW":
        return {
            "success": False,
            "error": reason
        }

    # ✅ Step 2: Validate SQL
    allowed_tables = list(schema.keys())

    if not validate_sql(sql_query, allowed_tables):
        return {
            "success": False,
            "error": "Invalid or unsafe SQL query generated"
        }

    # ✅ Step 3: Execute (ACTIVE DB)
    try:
        data = execute_query(sql_query)
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

    # 🔥 Step 4: Data Quality Check
    if data:
        null_present = any(
            any(value is None for value in row.values())
            for row in data
        )

        if null_present:
            if confidence == "VERY_HIGH":
                confidence = "HIGH"
                reason = "Result contains NULL values; output may not be perfectly ranked"

            elif confidence == "HIGH":
                confidence = "MEDIUM"
                reason = "Result contains NULL values; some data may be missing"

    # ✅ Final Response
    return {
        "success": True,
        "sql": sql_query,
        "data": data,
        "table": request.table,
        "confidence": confidence,
        "reason": reason
    }


# ✅ DASHBOARD METRICS
@router.get("/dashboard")
def dashboard():
    return get_dashboard_metrics()


# ✅ SUGGESTIONS
@router.get("/suggestions")
def suggestions():
    return generate_suggestions()


# ✅ GET TABLES
@router.get("/tables")
def get_tables():
    try:
        schema = get_schema()
        return list(schema.keys())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ GET FULL SCHEMA
@router.get("/schema")
def fetch_schema():
    try:
        return get_schema()
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }