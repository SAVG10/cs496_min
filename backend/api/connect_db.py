from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import psycopg2

from services.auth import get_current_user
from db.session import get_app_db_connection
from core.security import encrypt  # ✅ IMPORTANT

router = APIRouter()


# ✅ REQUEST MODEL
class DBConnectRequest(BaseModel):
    name: str
    host: str
    port: int  # ✅ better as int
    dbname: str
    username: str
    password: str


# ✅ CONNECT DB
@router.post("/connect-db")
def connect_db(
    request: DBConnectRequest,
    user_id: int = Depends(get_current_user)
):
    # 🔹 Step 1: Test connection
    try:
        test_conn = psycopg2.connect(
            host=request.host,
            port=request.port,
            dbname=request.dbname,
            user=request.username,
            password=request.password,
            connect_timeout=5,
            sslmode="require"
        )
        test_conn.close()

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Connection failed: {str(e)}"
        )

    # 🔹 Step 2: Save + set active
    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        # 🔐 Encrypt password BEFORE storing
        encrypted_password = encrypt(request.password)

        # 🔥 Insert new connection as ACTIVE
        cursor.execute("""
            INSERT INTO db_connections
            (user_id, name, host, port, dbname, username, password, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
            RETURNING id;
        """, (
            user_id,
            request.name,
            request.host,
            request.port,
            request.dbname,
            request.username,
            encrypted_password  # ✅ FIXED
        ))

        db_id = cursor.fetchone()[0]

        # 🔥 Deactivate all other connections for this user
        cursor.execute("""
            UPDATE db_connections
            SET is_active = FALSE
            WHERE user_id = %s AND id != %s
        """, (user_id, db_id))

        conn.commit()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save connection: {str(e)}"
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
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
def get_connections(user_id: int = Depends(get_current_user)):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, is_active
            FROM db_connections
            WHERE user_id = %s
            ORDER BY id DESC
        """, (user_id,))

        rows = cursor.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
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


# ✅ GET ACTIVE DB
@router.get("/active-db")
def get_active_db(user_id: int = Depends(get_current_user)):

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
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
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
def disconnect_db(user_id: int = Depends(get_current_user)):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE db_connections
            SET is_active = FALSE
            WHERE user_id = %s
        """, (user_id,))

        conn.commit()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    return {
        "success": True,
        "message": "Database disconnected successfully"
    }