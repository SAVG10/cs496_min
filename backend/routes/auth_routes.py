from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.session import get_app_db_connection
from services.auth import hash_password, verify_password, create_token

router = APIRouter()


class AuthRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(req: AuthRequest):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE email = %s",
            (req.email,)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="User already exists")

        hashed = hash_password(req.password)

        cursor.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
            (req.email, hashed)
        )

        user_id = cursor.fetchone()[0]
        conn.commit()

        token = create_token(user_id)

        return {"token": token}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@router.post("/login")
def login(req: AuthRequest):

    conn = None
    cursor = None

    try:
        conn = get_app_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, password_hash FROM users WHERE email = %s",
            (req.email,)
        )

        user = cursor.fetchone()

        if not user or not verify_password(req.password, user[1]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_token(user[0])

        return {"token": token}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()