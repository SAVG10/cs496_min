from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.db_routes import router as db_router
from api.connect_db import router as connect_router
from routes.auth_routes import router as auth_router

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# 🔐 Gemini config
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise Exception("GOOGLE_API_KEY not set")

genai.configure(api_key=api_key)

app = FastAPI(title="CS496 Analytics Backend")

# ✅ CORS (dev mode)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Routers (structured)
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(connect_router, prefix="/db", tags=["Database"])
app.include_router(db_router, prefix="/analytics", tags=["Analytics"])
app.include_router(router, prefix="/user", tags=["User"])


@app.get("/")
def root():
    return {"status": "Backend is running"}