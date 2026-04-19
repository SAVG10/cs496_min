from fastapi import HTTPException
import psycopg2

from core.settings import settings
from core.security import decrypt  # 🔐 make sure this exists


# 🔹 Internal helper to create DB connections safely
def create_connection(host, port, dbname, user, password):
    try:
        return psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=5,     # ⏱️ prevent hanging
            sslmode="require"      # 🔐 required for most cloud DBs
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Failed to connect to database"
        )


# 🔹 APP DB (stores users, connections, history)
def get_app_db_connection():
    return create_connection(
        settings.APP_DB_HOST,
        settings.APP_DB_PORT,
        settings.APP_DB_NAME,
        settings.APP_DB_USER,
        settings.APP_DB_PASSWORD
    )


# 🔹 DEFAULT ANALYTICS DB (optional fallback)
def get_analytics_db_connection():
    if not settings.DB_HOST:
        raise HTTPException(status_code=400, detail="Default DB not configured")

    return create_connection(
        settings.DB_HOST,
        settings.DB_PORT,
        settings.DB_NAME,
        settings.DB_USER,
        settings.DB_PASSWORD
    )


# 🔥 V2: DYNAMIC CONNECTION USING db_id
def get_connection_from_db_id(db_id: int, user_id: int):
    app_conn = None
    cursor = None

    try:
        app_conn = get_app_db_connection()
        cursor = app_conn.cursor()

        cursor.execute("""
            SELECT host, port, dbname, username, password
            FROM db_connections
            WHERE id = %s AND user_id = %s
        """, (db_id, user_id))

        result = cursor.fetchone()

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Database not found"
            )

        host, port, dbname, username, encrypted_password = result

        # 🔐 decrypt password before use
        password = decrypt(encrypted_password)

        return create_connection(host, port, dbname, username, password)

    finally:
        if cursor:
            cursor.close()
        if app_conn:
            app_conn.close()


# 🔥 ACTIVE DB CONNECTION (PRIMARY METHOD)
def get_active_connection(user_id: int):
    """
    Returns:
        (connection, db_id)

    ⚠️ Caller MUST close connection:
        conn, db_id = get_active_connection(user_id)
        try:
            ...
        finally:
            conn.close()
    """
    app_conn = None
    cursor = None

    try:
        app_conn = get_app_db_connection()
        cursor = app_conn.cursor()

        cursor.execute("""
            SELECT id, host, port, dbname, username, password
            FROM db_connections
            WHERE user_id = %s AND is_active = TRUE
            LIMIT 1
        """, (user_id,))

        result = cursor.fetchone()

        if not result:
            raise HTTPException(
                status_code=400,
                detail="No active database selected"
            )

        db_id, host, port, dbname, username, encrypted_password = result

        # 🔐 decrypt password
        password = decrypt(encrypted_password)

        conn = create_connection(host, port, dbname, username, password)

        return conn, db_id

    finally:
        if cursor:
            cursor.close()
        if app_conn:
            app_conn.close()