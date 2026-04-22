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
You are a PostgreSQL expert.

You MUST follow these rules strictly:

1. Only generate SELECT queries
2. Use ONLY the given tables and columns
3. Do NOT invent columns or tables
4. Do NOT use DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE
5. Return ONLY raw SQL (no explanation, no markdown)
6. Always LIMIT results to 20 unless explicitly specified

IMPORTANT:
- There is NO fixed primary table. Use the most relevant table(s) based on the query.
- Only use JOIN when necessary
- Do NOT guess relationships
- When ordering numeric values, ALWAYS use NULLS LAST

# 🔥 NEW: SEMANTIC MATCHING (ADDED)
- The user query may NOT exactly match column names
- You MUST infer the closest relevant columns based on meaning
- Example mappings:
  "sales" → revenue, amount, price
  "products" → item_name, product_id
  "customers" → user_id, client_id
- If exact match is not found, choose the MOST relevant column

RELATIONSHIP RULES:
- Prefer HIGH confidence relationships
- Use MEDIUM confidence only if necessary
- If no valid relationship exists → DO NOT use JOIN

STRING MATCHING RULES:
- Text comparisons MUST be case-insensitive
- ALWAYS use ILIKE instead of = for text filtering

DATA SELECTION RULES:

- Use the most relevant table for the query
- When performing aggregation (SUM, COUNT, AVG, etc.), prefer the most granular (lowest-level) table available
- If a more detailed table exists for the requested data, it MUST be used even if it requires JOINs
- When required data exists across multiple related tables, use JOINs based on the provided relationships
- Avoid using higher-level summary columns if a more detailed calculation is possible
- Only avoid JOINs when no additional detail or correctness is gained
- Always prefer the lowest-level table in the relationship chain when performing aggregations

Database schema:
{schema_text}

{relationship_text}

User request:
{natural_query}
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