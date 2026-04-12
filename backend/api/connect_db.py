from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import psycopg2

from db.session import get_app_db_connection

router = APIRouter()


# ✅ REQUEST MODEL
class DBConnectRequest(BaseModel):
    name: str
    host: str
    port: str
    dbname: str
    username: str
    password: str


# ✅ CONNECT DB
@router.post("/connect-db")
def connect_db(request: DBConnectRequest):

    # 🔹 Step 1: Test connection
    try:
        test_conn = psycopg2.connect(
            host=request.host,
            port=request.port,
            dbname=request.dbname,
            user=request.username,
            password=request.password
        )
        test_conn.close()

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {str(e)}"
        )

    # 🔹 Step 2: Save + set active
    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        # 🔥 Insert new connection as ACTIVE
        cursor.execute("""
            INSERT INTO db_connections
            (user_id, name, host, port, dbname, username, password, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
            RETURNING id;
        """, (
            1,
            request.name,
            request.host,
            request.port,
            request.dbname,
            request.username,
            request.password
        ))

        db_id = cursor.fetchone()[0]

        # 🔥 Deactivate all others
        cursor.execute("""
            UPDATE db_connections
            SET is_active = FALSE
            WHERE user_id = 1 AND id != %s
        """, (db_id,))

        conn.commit()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save connection: {str(e)}"
        )

    finally:
        cursor.close()
        conn.close()

    return {
        "success": True,
        "data": {
            "id": db_id,
            "name": request.name
        },
        "message": "Database connected successfully"
    }


# ✅ GET ALL CONNECTIONS
@router.get("/db-connections")
def get_connections():

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, is_active
            FROM db_connections
            WHERE user_id = 1
            ORDER BY id DESC
        """)

        rows = cursor.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

    return {
        "success": True,
        "data": [
            {
                "id": row[0],
                "name": row[1],
                "is_active": row[2]
            }
            for row in rows
        ]
    }


# ✅ GET ACTIVE DB (🔥 REQUIRED FOR HEADER + REDIRECTS)
@router.get("/active-db")
def get_active_db():

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name
            FROM db_connections
            WHERE user_id = 1 AND is_active = TRUE
            LIMIT 1
        """)

        row = cursor.fetchone()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

    if not row:
        return {
            "success": True,
            "data": None
        }

    return {
        "success": True,
        "data": {
            "id": row[0],
            "name": row[1]
        }
    }


# ✅ DISCONNECT DB
@router.post("/disconnect-db")
def disconnect_db():

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE db_connections
            SET is_active = FALSE
            WHERE user_id = 1
        """)

        conn.commit()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

    return {
        "success": True,
        "message": "Database disconnected successfully"
    }