import os
import google.generativeai as genai
from dotenv import load_dotenv

from services.schema import (
    get_schema,
    format_schema,
    get_all_relationships,
    format_relationships
)

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("models/gemini-2.5-flash")


def generate_sql(natural_query: str, selected_table: str, user_id: int):

    # 🔥 Step 0: Empty query check
    if not natural_query.strip():
        return "", "LOW", "Query is empty"

    # ✅ Step 1: Schema
    schema = get_schema(user_id)
    schema_text = format_schema(schema)

    # ✅ Step 2: Relationships
    relationships = get_all_relationships(user_id)
    relationship_text = format_relationships(relationships)

    # ✅ Step 3: Prompt (ONLY ADDITION HERE)
    prompt = f"""
You are a PostgreSQL expert. Convert the user's natural language request into a single SELECT query.

════════════════════════════════════════════
SECTION 1 — OUTPUT FORMAT
════════════════════════════════════════════

- Return ONLY raw SQL
- No markdown, no explanation, no comments
- LIMIT 20 unless user specifies otherwise
- NULLS LAST when ordering numeric values

════════════════════════════════════════════
SECTION 2 — ALLOWED OPERATIONS
════════════════════════════════════════════

- SELECT only
- No DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE

════════════════════════════════════════════
SECTION 3 — SCHEMA DISCIPLINE
════════════════════════════════════════════

- Use ONLY tables and columns from the schema below
- Do NOT invent columns or tables
- Do NOT guess relationships — use only provided ones

════════════════════════════════════════════
SECTION 4 — THE GOLDEN EXAMPLE (READ CAREFULLY)
════════════════════════════════════════════

Given this schema:
  line_items(line_item_id, service_id, line_code, service_type, description, line_total)
  service_records(service_id, invoice_number, vehicle_make, notes)
  line_subitems(subitem_id, line_item_id, description, quantity, total_price)

User asks: "show me services named warranty"

❌ WRONG QUERY (never generate this):
SELECT li.service_type, li.description, sr.invoice_number
FROM line_items AS li
JOIN service_records AS sr ON li.service_id = sr.service_id
WHERE li.description ILIKE '%warranty%'          -- WRONG: description is display-only
   OR ls.description ILIKE '%warranty%'          -- WRONG: description is display-only
   OR sr.notes ILIKE '%warranty%'                -- WRONG: notes is display-only
LIMIT 20;

✅ CORRECT QUERY (always follow this pattern):
SELECT
  li.service_type,
  li.description,           -- OK to SELECT description
  li.line_total,
  sr.invoice_number,
  sr.vehicle_make,
  ls.description AS subitem_description,
  ls.quantity,
  ls.total_price
FROM line_items AS li
JOIN service_records AS sr ON li.service_id = sr.service_id
JOIN line_subitems AS ls ON li.line_item_id = ls.line_item_id
WHERE li.service_type ILIKE 'Warranty'           -- CORRECT: filter on categorical column
LIMIT 20;

WHY THE CORRECT QUERY IS RIGHT:
- "named warranty" maps to service_type (categorical), NOT description (free text)
- description is SELECTed for display but NEVER used in WHERE
- notes is SELECTed for display but NEVER used in WHERE
- Only ONE column used in WHERE — no OR fallback chains

════════════════════════════════════════════
SECTION 5 — WHERE CLAUSE RULES (ABSOLUTE)
════════════════════════════════════════════

FORBIDDEN in WHERE (display-only columns — SELECT them freely, never filter on them):
  ✗ description
  ✗ notes
  ✗ details
  ✗ comments
  ✗ remarks
  ✗ summary
  ✗ text
  ✗ memo

ALLOWED in WHERE (categorical/structured columns — always prefer these):
  ✓ service_type
  ✓ type
  ✓ category
  ✓ status
  ✓ name
  ✓ code
  ✓ label
  ✓ tag

MANDATORY SELF-CHECK before writing WHERE:
  For each condition you are about to write, ask:
  "Is this column a free-text / description / notes column?"
  → YES: remove it from WHERE. Find the categorical equivalent instead.
  → NO: keep it.

OR IS FORBIDDEN:
  Never write: WHERE col_a ILIKE 'x' OR col_b ILIKE 'x'
  Always write: WHERE one_categorical_column ILIKE 'Value'

════════════════════════════════════════════
SECTION 6 — INTENT MAPPING
════════════════════════════════════════════

User says:                      → Filter on:
"named X"                       → name, service_type, type, category
"type X"                        → type, service_type, category
"category X"                    → category, type
"status X"                      → status
"containing X" / "search X"     → description, notes (ONLY these cases)
"with code X"                   → code, line_code

════════════════════════════════════════════
SECTION 7 — VALUE NORMALIZATION
════════════════════════════════════════════

- Normalize user values to Title Case: "warranty" → "Warranty"
- Default: exact match → ILIKE 'Warranty'
- Partial match → ILIKE '%Warranty%' ONLY if user says "contains" / "search" / "like"

════════════════════════════════════════════
SECTION 8 — JOIN RULES
════════════════════════════════════════════

- Always JOIN when relationships exist between tables
- Prefer HIGH confidence relationships
- Include all directly connected tables to enrich results
- Never JOIN without a valid relationship from the list below

════════════════════════════════════════════
SECTION 9 — COLUMN ALIASING
════════════════════════════════════════════

COLUMN ALIASING RULE (MANDATORY):

- EVERY selected column MUST have a UNIQUE alias using AS
- This applies ESPECIALLY to:
  - Aggregations (COUNT, SUM, AVG, MIN, MAX)
  - Expressions
  - Duplicate column names across tables

- NEVER return unnamed columns

- BAD:
  SELECT COUNT(*), COUNT(*) FROM table

- GOOD:
  SELECT 
    COUNT(*) AS total_count,
    COUNT(DISTINCT user_id) AS unique_users
  FROM table

- BAD:
  SELECT price, price FROM table

- GOOD:
  SELECT 
    price AS base_price,
    price AS listed_price

ALIAS NAMING RULES:

- Use descriptive, human-readable names
- Prefer snake_case
- Avoid generic names like:
  col1, column1, count1

- Use context:
  COUNT(DISTINCT tag_number) → tag_count
  COUNT(DISTINCT vehicle_make) → vehicle_make_count
  SUM(price) → total_price
  AVG(price) → avg_price

STRICT REQUIREMENT:

- If multiple columns are selected, ALL must have unique aliases
- Duplicate column names are NOT allowed under any circumstances

════════════════════════════════════════════
DATABASE SCHEMA:
════════════════════════════════════════════

{schema_text}

════════════════════════════════════════════
RELATIONSHIPS:
════════════════════════════════════════════

{relationship_text}

════════════════════════════════════════════
USER REQUEST:
════════════════════════════════════════════

{natural_query}

════════════════════════════════════════════
REMINDER BEFORE YOU WRITE THE WHERE CLAUSE:
  Check every condition — if it touches description, notes, or any free-text column → remove it.
  Use ONE categorical column only. No OR. No fallback.
════════════════════════════════════════════
"""

    # ✅ Step 4: Generate SQL
    response = model.generate_content(prompt)

    raw_text = response.text if response.text else ""

    # 🔥 CLEAN + NORMALIZE
    sql = raw_text.replace("```sql", "").replace("```", "").strip()

    sql = "\n".join(
        [line.strip() for line in sql.splitlines() if line.strip()]
    )

    print("\n🔍 GENERATED SQL:\n", sql, "\n")

    sql_upper = sql.upper()

    # 🔥 Step 4.5: Strong SQL validation
    if (
        not sql
        or not sql_upper.startswith("SELECT")
        or len(sql_upper) < 15
    ):
        return "", "LOW", "Model did not generate a valid SQL query"

    if sql_upper in ["SELECT", "SELECT;"]:
        return "", "LOW", "Incomplete SQL generated"

    query_lower = natural_query.lower()

    # 🔹 Stopwords
    stopwords = {
        "the", "is", "me", "about", "tell", "give", "show",
        "and", "or", "to", "of", "in", "on", "for", "with"
    }

    # 🔹 Schema vocabulary
    schema_words = set()
    for table, cols in schema.items():
        schema_words.add(table.lower())
        for col, _ in cols:
            schema_words.add(col.lower())

    # 🔹 Clean query words
    query_words = {
        word for word in query_lower.split()
        if word not in stopwords
    }

    # 🔥 Case 1: No meaningful words
    if not query_words:
        return "", "LOW", "Query does not contain meaningful keywords"

    # 🔹 Relevance check
    relevant = any(
        q == s or (len(q) > 3 and q in s)
        for q in query_words
        for s in schema_words
    )

    # 🔥 ❌ REMOVED HARD BLOCK
    # if not relevant:
    #     return "", "LOW", "Query does not relate to database schema"

    # 🔥 STEP 5: Query intelligence detection
    is_aggregation = any(func in sql_upper for func in [
        "SUM(", "COUNT(", "AVG(", "MIN(", "MAX("
    ])

    has_where = "WHERE" in sql_upper
    has_order = "ORDER BY" in sql_upper
    has_group_by = "GROUP BY" in sql_upper
    has_join = "JOIN" in sql_upper

    # 🔥 STEP 6: GENERIC QUERY
    if (
        "LIMIT 20" in sql_upper
        and not has_where
        and not has_order
        and not has_group_by
        and not is_aggregation
    ):
        confidence = "MEDIUM"
        reason = "Query is too broad; showing general results"

    # 🔥 STEP 7: AGGREGATION WITHOUT BREAKDOWN
    elif is_aggregation and not has_group_by:
        confidence = "MEDIUM"
        reason = "Aggregation query without grouping"

    # 🔥 STEP 8: STRONG SINGLE TABLE QUERY
    elif not has_join:
        confidence = "VERY_HIGH"
        reason = "Query directly uses a single table without joins"

    # 🔥 STEP 9: JOIN CONFIDENCE
    else:
        has_high = any(rel[-1] == "HIGH" for rel in relationships)
        has_medium = any(rel[-1] == "MEDIUM" for rel in relationships)

        if has_high:
            confidence = "HIGH"
            reason = "JOIN uses foreign key relationships"
        elif has_medium:
            confidence = "MEDIUM"
            reason = "JOIN inferred from matching column names"
        else:
            return "", "LOW", "JOIN used without valid relationship"

    # 🔥 NEW: SOFT FALLBACK (ONLY ADDITION)
    if not relevant:
        confidence = "MEDIUM"
        reason = "Semantic match used; inferred columns"

    return sql, confidence, reason


def get_model():
    return model