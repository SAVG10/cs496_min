from cryptography.fernet import Fernet
from core.settings import settings

cipher = Fernet(settings.FERNET_KEY.encode())

def encrypt(text: str) -> str:
    return cipher.encrypt(text.encode()).decode()

def decrypt(token: str) -> str:
    return cipher.decrypt(token.encode()).decode()