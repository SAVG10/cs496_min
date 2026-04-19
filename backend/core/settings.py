from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App DB
    APP_DB_HOST: str
    APP_DB_PORT: int
    APP_DB_NAME: str
    APP_DB_USER: str
    APP_DB_PASSWORD: str

    # Default DB (optional)
    DB_HOST: str | None = None
    DB_PORT: int | None = None
    DB_NAME: str | None = None
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None

    # Security
    JWT_SECRET: str

    # Must be a 32-byte URL-safe base64-encoded key
    FERNET_KEY: str 
     
    # External APIs
    GOOGLE_API_KEY: str

    # Environment
    ENV: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()