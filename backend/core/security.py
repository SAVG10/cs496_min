from cryptography.fernet import Fernet
from core.settings import settings

# ⚠️ Use a proper 32-byte key in production
key = settings.JWT_SECRET[:32].encode()
cipher = Fernet(key)


def encrypt(text: str) -> str:
    return cipher.encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    return cipher.decrypt(token.encode()).decode()