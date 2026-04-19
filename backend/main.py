from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.db_routes import router as db_router
from api.connect_db import router as connect_router
from routes.auth_routes import router as auth_router

from core.settings import settings
import google.generativeai as genai


# 🔐 Configure Gemini
if not settings.GOOGLE_API_KEY:
    raise Exception("GOOGLE_API_KEY not set")

genai.configure(api_key=settings.GOOGLE_API_KEY)


# 🚀 Create FastAPI app
app = FastAPI(title="CS496 Analytics Backend")


# 🌐 CORS Configuration (STRICT + SAFE)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # 🔁 IMPORTANT: replace with your actual Vercel URL later
    "https://your-frontend.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# 🔥 Explicit preflight handler (fixes NetworkError issue)
@app.options("/{full_path:path}")
async def preflight_handler():
    return {"status": "ok"}


# 📦 Routers
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(connect_router, prefix="/db", tags=["Database"])
app.include_router(db_router, prefix="/analytics", tags=["Analytics"])
app.include_router(router, prefix="/user", tags=["User"])


# ✅ Root endpoint
@app.get("/")
def root():
    return {"status": "Backend is running"}


# 🩺 Health check
@app.get("/health")
def health():
    return {"status": "ok"}