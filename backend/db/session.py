import psycopg2
import os
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()


# 🔹 APP DB (stores users, connections, history)
def get_app_db_connection():
    return psycopg2.connect(
        host=os.getenv("APP_DB_HOST"),
        port=os.getenv("APP_DB_PORT"),
        dbname=os.getenv("APP_DB_NAME"),
        user=os.getenv("APP_DB_USER"),
        password=os.getenv("APP_DB_PASSWORD")
    )


# 🔹 DEFAULT ANALYTICS DB (fallback, optional)
def get_analytics_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


# 🔥 V2: DYNAMIC CONNECTION USING db_id (SECURE)
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

        host, port, dbname, username, password = result

        return psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=username,
            password=password
        )

    finally:
        if cursor:
            cursor.close()
        if app_conn:
            app_conn.close()


# 🔥 V2: ACTIVE DB CONNECTION (PRIMARY METHOD)
def get_active_connection(user_id: int):
    """
    Returns:
        (connection, db_id)
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

        db_id, host, port, dbname, username, password = result

        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=username,
            password=password
        )

        return conn, db_id

    finally:
        if cursor:
            cursor.close()
        if app_conn:
            app_conn.close()