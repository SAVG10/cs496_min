from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib

SECRET_KEY = "super-secret-key"  # change during deployment
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

security = HTTPBearer()


# 🔐 PRE-HASH (FIXES bcrypt 72-byte limit)
def _prehash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


# 🔐 Hash password
def hash_password(password: str):
    return pwd_context.hash(_prehash(password))


# 🔍 Verify password
def verify_password(password: str, hashed: str):
    return pwd_context.verify(_prehash(password), hashed)


# 🎟️ Create JWT
def create_token(user_id: int):
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# 🔓 Decode JWT (SAFE)
def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


# 🛡️ Auth dependency
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = decode_token(credentials.credentials)

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload"
        )

    return int(user_id)