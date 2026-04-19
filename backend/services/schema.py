from db.session import get_active_connection


# ✅ GET SCHEMA (ACTIVE DB)
def get_schema(user_id: int):

    conn = None
    cursor = None

    try:
        conn, _ = get_active_connection(user_id)
        cursor = conn.cursor()

        query = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    schema = {}

    for table, column, dtype in rows:
        if table not in schema:
            schema[table] = []
        schema[table].append((column, dtype))

    return schema


# ✅ FORMAT SCHEMA (UNCHANGED)
def format_schema(schema: dict) -> str:
    schema_text = ""

    for table, columns in schema.items():
        schema_text += f"\nTable: {table}\nColumns:\n"
        for col, dtype in columns:
            schema_text += f"- {col} ({dtype})\n"

    return schema_text


# ✅ STEP 1: GET FOREIGN KEY RELATIONSHIPS (ACTIVE DB)
def get_foreign_key_relationships(user_id: int):

    conn = None
    cursor = None

    try:
        conn, _ = get_active_connection(user_id)
        cursor = conn.cursor()

        query = """
        SELECT
            tc.table_name AS source_table,
            kcu.column_name AS source_column,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column
        FROM
            information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY';
        """

        cursor.execute(query)
        rows = cursor.fetchall()

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return [(src_t, src_c, tgt_t, tgt_c, "HIGH") for src_t, src_c, tgt_t, tgt_c in rows]


# ✅ STEP 2: COLUMN NAME MATCHING (UNCHANGED)
def infer_relationships_from_columns(schema: dict):

    inferred = []
    tables = list(schema.keys())

    for i in range(len(tables)):
        for j in range(i + 1, len(tables)):

            t1, t2 = tables[i], tables[j]

            cols1 = {col[0] for col in schema[t1]}
            cols2 = {col[0] for col in schema[t2]}

            common = cols1.intersection(cols2)

            for col in common:
                inferred.append((t1, col, t2, col, "MEDIUM"))

    return inferred


# ✅ STEP 3: COMBINE RELATIONSHIPS (ACTIVE DB)
def get_all_relationships(user_id: int):

    schema = get_schema(user_id)

    fk_relationships = get_foreign_key_relationships(user_id)
    column_relationships = infer_relationships_from_columns(schema)

    all_rel = fk_relationships + column_relationships

    unique_rel = list(set(all_rel))

    return unique_rel


# ✅ STEP 4: FORMAT FOR LLM (UNCHANGED)
def format_relationships(relationships):

    text = "\nTable relationships:\n"

    if not relationships:
        return text + "None found.\n"

    for src_t, src_c, tgt_t, tgt_c, confidence in relationships:
        text += f"- {src_t}.{src_c} = {tgt_t}.{tgt_c} ({confidence})\n"

    return text

def get_fk_relationships_only(user_id: int):
    """
    ONLY return true foreign key relationships (for schema UI)
    """
    return get_foreign_key_relationships(user_id)